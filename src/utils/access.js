import {
  APP_ACCESS_PAGES,
  DEFAULT_LEVEL_PROFILES,
  MOBILE_NAV_PRIORITY,
  MOBILE_QUICK_LINK_PRIORITY,
} from "./accessCatalog";

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizePageKeyArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => normalizeText(item)).filter(Boolean)));
}

function pathPatternToRegex(pattern = "") {
  const escaped = String(pattern)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\:([A-Za-z0-9_]+)/g, "[^/]+");

  return new RegExp(`^${escaped}$`);
}

export function getAccessPages() {
  return APP_ACCESS_PAGES;
}

export function getAccessPageMap() {
  return APP_ACCESS_PAGES.reduce((acc, page) => {
    acc[page.key] = page;
    return acc;
  }, {});
}

export function getAccessPageByKey(pageKey) {
  return getAccessPageMap()[pageKey] || null;
}

export function getAccessPageByPath(pathname = "") {
  const cleanPath = String(pathname || "").split("?")[0] || "/";
  return (
    APP_ACCESS_PAGES.find((page) =>
      (page.patterns || [page.path]).some((pattern) => pathPatternToRegex(pattern).test(cleanPath))
    ) || null
  );
}

export function getDefaultLevelProfiles() {
  return DEFAULT_LEVEL_PROFILES.map((profile) => ({
    ...profile,
    paginas: normalizePageKeyArray(profile.paginas),
  }));
}

// Perfis que NUNCA devem ser limitados pelo que está gravado no DB.
// Sempre que adicionamos uma página nova, Administrador/Gestor passam a vê-la
// imediatamente, sem depender de migration de access_sync.
const FULL_ACCESS_PROFILES = new Set(["Administrador", "Gestor"]);

export function buildAccessProfileMap(rows = []) {
  const defaults = getDefaultLevelProfiles();
  const defaultMap = defaults.reduce((acc, row) => {
    acc[row.nome] = row;
    return acc;
  }, {});

  const map = { ...defaultMap };
  (rows || []).forEach((row) => {
    const nome = normalizeText(row?.nome);
    if (!nome) return;

    const isFullAccess = FULL_ACCESS_PROFILES.has(nome);
    const paginasFromRow = isFullAccess
      ? defaultMap[nome]?.paginas
      : (row?.paginas ?? defaultMap[nome]?.paginas);

    map[nome] = {
      ...defaultMap[nome],
      ...row,
      nome,
      paginas: normalizePageKeyArray(paginasFromRow),
      farol_liberado:
        row?.farol_liberado === true || row?.farol_liberado === false
          ? row.farol_liberado
          : defaultMap[nome]?.farol_liberado === true,
      ativo: row?.ativo === true || row?.ativo === false ? row.ativo : true,
    };
  });

  return map;
}

export function getLevelOptions(rows = []) {
  return Object.values(buildAccessProfileMap(rows))
    .filter((row) => row?.ativo !== false)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function canAccessEstruturaFisica(user, accessProfileMap = {}) {
  if (!user?.nivel) return false;

  const explicitKeys = new Set(normalizePageKeyArray(user?.paginas_liberadas));
  if (
    explicitKeys.has("estrutura_fisica_solicitacao") ||
    explicitKeys.has("estrutura_fisica_central") ||
    explicitKeys.has("estrutura_fisica_consultar") ||
    explicitKeys.has("estrutura_fisica_tratar")
  ) {
    return true;
  }

  const profile = accessProfileMap?.[user.nivel];
  const profileKeys = new Set(normalizePageKeyArray(profile?.paginas));
  if (
    profileKeys.has("estrutura_fisica_solicitacao") ||
    profileKeys.has("estrutura_fisica_central") ||
    profileKeys.has("estrutura_fisica_consultar") ||
    profileKeys.has("estrutura_fisica_tratar")
  ) {
    return true;
  }

  return user.nivel === "RH" && user.estrutura_fisica_liberada === true;
}

// as telas que mudam QUEM vê O QUÊ: nunca abrem só pelo nível
const PAGINAS_DE_ACESSO = new Set(["config_usuarios", "config_niveis", "config_controle_dados"]);

export function canUserAccessPageKey(user, pageKey, accessProfileMap = {}) {
  const key = normalizeText(pageKey);
  if (!key) return false;
  if (!user?.nivel) return false;

  const nivelNorm = normalizeText(user.nivel).toLowerCase();
  // DP360 concentra dados pessoais e automações do ponto. Vale para o CLUSTER inteiro
  // (dp360, dp360_abandonos, dp360_banco_horas, dp360_resumo...) — a regra é por prefixo
  // de propósito: página nova do cluster nasce protegida, sem depender de alguém lembrar
  // de listar aqui. O Banco de Horas, em especial, mostra folha.
  //
  // LIBERADA POR PESSOA, E SÓ POR PESSOA (15/09/2026). O dono liberou gente em
  // Configurações → Usuários → "Liberar" e ninguém via nada: esta função ignorava a
  // liberação e devolvia "só Administrador". Agora a liberação individual vale — página a
  // página, e "Bloquear" ganha dela.
  // O NÍVEL NÃO ABRE: o perfil padrão do Gestor traz TODAS as páginas (e é de acesso
  // total, `FULL_ACCESS_PROFILES`), então honrar o perfil daria folha a todo Gestor sem
  // ninguém ter decidido isso. A mesma regra está no gateway `dp360-api`, que é quem
  // realmente guarda os dados.
  //
  // AS CONFIGURAÇÕES DE ACESSO SEGUEM A MESMA REGRA (15/09/2026). O dono entrou no
  // usuário da Larissa e viu o grupo Configurações. O perfil padrão do Gestor inclui
  // "Configurações Usuários" (a lista dele é "tudo menos Níveis"), e a tela Usuários
  // deixa editar as PÁGINAS e o NÍVEL de qualquer pessoa — inclusive o próprio. Quem
  // administra acesso é Administrador, ou alguém que ele liberou nominalmente.
  if (key === "dp360" || key.startsWith("dp360_") || PAGINAS_DE_ACESSO.has(key)) {
    if (nivelNorm === "administrador" || nivelNorm === "admin") return true;
    if (new Set(normalizePageKeyArray(user?.paginas_bloqueadas)).has(key)) return false;
    return new Set(normalizePageKeyArray(user?.paginas_liberadas)).has(key);
  }

  // INOVE Guard (guard_fraudes...): A MESMA REGRA DO CLUSTER DP360 (17/09/2026, dono: "a
  // parte de fraude nao liberou para elaine"). Até aqui só passava Administrador, porque o
  // gateway `dp360-api` também só respondia a ele: a liberação individual era ignorada nos
  // dois lados e a Elaine (Gestor, com `guard_fraudes` liberada) não via a tela. Agora a
  // liberação por pessoa vale aqui e lá — e "Bloquear" continua ganhando dela. O nível
  // sozinho não abre: o perfil do Gestor traz quase tudo, e isto é fraude de cartão.
  // O `monitoramento` fica de fora de proposito: e chave antiga, com regra propria, e mudar
  // o gate dele aqui tiraria acesso de quem ja usa.
  if (key.startsWith("guard_")) {
    if (nivelNorm === "administrador" || nivelNorm === "admin") return true;
    if (new Set(normalizePageKeyArray(user?.paginas_bloqueadas)).has(key)) return false;
    return new Set(normalizePageKeyArray(user?.paginas_liberadas)).has(key);
  }

  // Administrador sempre vê tudo — não depende de profileMap nem DB.
  if (nivelNorm === "administrador" || nivelNorm === "admin") return true;

  const explicitBlocked = new Set(normalizePageKeyArray(user?.paginas_bloqueadas));
  if (explicitBlocked.has(key)) return false;

  const page = getAccessPageByKey(key);
  if (!page) return true;

  const explicitAllowed = new Set(normalizePageKeyArray(user?.paginas_liberadas));
  if (explicitAllowed.has(key)) return true;

  const profile = accessProfileMap?.[user.nivel];
  const profileAllowed = new Set(normalizePageKeyArray(profile?.paginas));
  const hasProfileAccess = profileAllowed.has(key);

  if (page.category === "Estrutura Fisica") {
    return hasProfileAccess || canAccessEstruturaFisica(user, accessProfileMap);
  }

  return hasProfileAccess;
}

export function canUserAccessPath(user, pathname, accessProfileMap = {}) {
  const page = getAccessPageByPath(pathname);
  if (!page) return true;
  return canUserAccessPageKey(user, page.key, accessProfileMap);
}

export function canUserSeeFarol(user, accessProfileMap = {}) {
  if (!user?.nivel) return false;

  const profile = accessProfileMap?.[user.nivel];
  return profile?.farol_liberado === true;
}

export function getMobileNavItemsForUser(user, accessProfileMap = {}) {
  const pageMap = getAccessPageMap();
  const allowed = MOBILE_NAV_PRIORITY.filter((key) => canUserAccessPageKey(user, key, accessProfileMap))
    .map((key) => pageMap[key])
    .filter(Boolean)
    .slice(0, 3);

  return allowed.map((page) => ({
    key: page.key,
    label: page.label.replace(/^.*\s/, "").slice(0, 18) || page.label,
    path: page.path.includes("/:") ? page.path.split("/:")[0] : page.path,
  }));
}

export function getMobileQuickLinksForUser(user, accessProfileMap = {}) {
  const pageMap = getAccessPageMap();
  return MOBILE_QUICK_LINK_PRIORITY.filter((key) => canUserAccessPageKey(user, key, accessProfileMap))
    .map((key) => pageMap[key])
    .filter(Boolean)
    .slice(0, 4)
    .map((page) => ({
      key: page.key,
      title: page.label,
      description: `Acesso rapido para ${page.label.toLowerCase()}.`,
      path: page.path.includes("/:") ? page.path.split("/:")[0] : page.path,
    }));
}

export function summarizeEffectivePages(user, accessProfileMap = {}) {
  return APP_ACCESS_PAGES.filter((page) => canUserAccessPageKey(user, page.key, accessProfileMap)).map((page) => page.key);
}

const ACCESS_FALLBACK_PRIORITY = [
  "/painel",
  "/inove",
  "/inicio-rapido",
  "/central",
  "/tratativas-resumo",
  "/sac/central",
  "/sac/resumo",
  "/cobrancas",
  "/sos-resumo",
  "/sos-solicitacao",
  "/desempenho-diesel-resumo",
  "/diesel-tratativas",
  "/embarcados-central",
  "/pcm-resumo",
  "/pcm-controle-pneus",
  "/pcm-troca-pneus",
];

export function getDefaultAccessiblePath(user, accessProfileMap = {}) {
  for (const path of ACCESS_FALLBACK_PRIORITY) {
    if (canUserAccessPath(user, path, accessProfileMap)) {
      return path;
    }
  }

  const fallbackPage = APP_ACCESS_PAGES.find((page) => {
    const plainPath = page.path || "";
    if (!plainPath || plainPath.includes("/:")) return false;
    return canUserAccessPageKey(user, page.key, accessProfileMap);
  });

  return fallbackPage?.path || "/inicio-rapido";
}
