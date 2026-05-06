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

    map[nome] = {
      ...defaultMap[nome],
      ...row,
      nome,
      paginas: normalizePageKeyArray(row?.paginas ?? defaultMap[nome]?.paginas),
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

export function canUserAccessPageKey(user, pageKey, accessProfileMap = {}) {
  const key = normalizeText(pageKey);
  if (!key) return false;
  if (!user?.nivel) return false;

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
  "/cobrancas",
  "/sos-resumo",
  "/sos-solicitacao",
  "/desempenho-diesel-resumo",
  "/diesel-tratativas",
  "/embarcados-central",
  "/pcm-resumo",
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
