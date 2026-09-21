/* A GOVERNANÇA DE ACESSO, CONFERIDA DE UMA VEZ.
 *
 * Regra do dono (21/09/2026): "se está liberado, a pessoa tem que ter acesso" — e o
 * contrário também: quem não abre a tela não lê a tabela dela.
 *
 * O INOVE tem DUAS travas que precisam concordar: o `canUserAccessPageKey`
 * (src/utils/access.js), que decide o menu, e o `pode`/`podeTabela` dos gateways
 * (supabase/functions/dp360-api e bcnt-api), que decide o dado. Quando elas discordam:
 *   FALSA NEGATIVA — o menu abre a tela e a função recusa ("Edge Function returned a
 *                    non-2xx status code"); foi o que aconteceu com a Kamilly;
 *   FOLGA          — a função responde tabela que nenhuma tela daquela pessoa alcança.
 *
 * Este script reproduz as duas travas e passa os 14 perfis reais de `app_niveis_acesso`.
 * Ele não conversa com o banco: alimente com o despejo dos perfis.
 *
 *   npx supabase db query --linked --project-ref wboelthngddvkgrvwkbu  *     -f perfis.sql -o json > perfis.json        # select nome, paginas from app_niveis_acesso
 *   node scripts/governanca_gateway.mjs
 *
 * Saída esperada: "nenhuma" nas duas listas. ANTES=1 e SEMNIVEL=1 reencenam como era antes
 * dos dois ajustes de 21/09 (útil para conferir que o teste realmente pega o erro).
 *
 * MANUTENÇÃO: ao ligar uma tela nova num gateway, acrescente a página e as tabelas em
 * TELAS aqui e rode. Se a tabela mudar de regra, mude também em ACESSO_DP360/ACESSO_BCNT.
 */
import fs from "fs";

const perfis = JSON.parse(fs.readFileSync("perfis.json", "utf8")).rows;
const mapaPerfil = Object.fromEntries(perfis.map((p) => [p.nome, p.paginas || []]));
/* As PESSOAS de verdade, quando houver despejo (o perfil é o padrão; a liberação e o
   bloqueio individuais só aparecem aqui). Sem o arquivo, roda só nos perfis. */
const usuarios = fs.existsSync("usuarios.json")
  ? JSON.parse(fs.readFileSync("usuarios.json", "utf8")).rows
  : [];

/* ── as telas: página -> tabelas que ela pede ao gateway ──────────────────── */
const PONTO = ["app_config", "ponto_diario", "ponto_caso", "ponto_conferido", "ponto_ajustes",
  "ponto_ajustes_app", "ponto_ajustes_app_hist", "ponto_ocorrencias", "ponto_real_manual",
  "ponto_reservas", "ponto_importacoes", "ponto_intervalo", "ponto_gordura", "ponto_linha99",
  "ponto_gps", "gps_carro", "viagens_qh"];
const TELAS = {
  home: ["BCNT:premiacao_diaria_atualizada"],
  checklists_central: ["BCNT:checklists", "funcionarios"],
  diesel_resumo: ["BCNT:premiacao_diaria_atualizada", "funcionarios"],
  diesel_lancamento: ["BCNT:premiacao_diaria_atualizada", "funcionarios"],
  diesel_agente: ["BCNT:arquivos", "funcionarios"],
  dp360: PONTO, dp360_abandonos: PONTO, dp360_resumo: PONTO, dp360_evidencias: PONTO,
  dp360_banco_horas: ["banco_horas"],
  guard_fraudes: ["fraude_cartao_giros", "fraude_cartao_sequencial",
    "fraude_bloqueio_cartao", "fraude_bloqueio_historico"],
  // o cadastro: as telas de Pessoas e todas as que montam o CampoMotorista
  pessoas_funcionarios: ["funcionarios"], pessoas_ferias: ["funcionarios"],
  pessoas_atestados: ["funcionarios"], pessoas_reservas: ["funcionarios"],
  pessoas_organograma: ["funcionarios"], pessoas_vagas: ["funcionarios"],
  sos_tratamento: ["funcionarios"], sos_solicitacao: ["funcionarios"],
  tratativas_tratar: ["funcionarios"], tratativas_solicitacao: ["funcionarios"],
  acidentes_lancamento: ["funcionarios"], avarias_lancamento: ["funcionarios"],
  controle_especial_lancamento: ["funcionarios"], sac_lancamento: ["funcionarios"],
  pcm_preventivas: ["funcionarios"],
};

/* ── as regras do servidor, como estão nas duas funções ───────────────────── */
const PAGINAS_DO_PONTO = ["dp360", "dp360_abandonos", "dp360_resumo", "dp360_evidencias"];
const PAGINAS_DO_GUARD = ["guard_fraudes"];
const ACESSO_DP360 = {
  funcionarios: "logado",
  banco_horas: ["dp360_banco_horas"],
  fraude_cartao_bloqueado: "admin",
  fraude_cartao_giros: PAGINAS_DO_GUARD,
  fraude_cartao_sequencial: PAGINAS_DO_GUARD,
  fraude_bloqueio_cartao: PAGINAS_DO_GUARD,
  fraude_bloqueio_historico: PAGINAS_DO_GUARD,
};
const ACESSO_BCNT = {
  "BCNT:checklists": ["checklists_central"],
  "BCNT:premiacao_diaria_atualizada": ["diesel_resumo", "diesel_lancamento", "diesel_agente", "home"],
  "BCNT:arquivos": ["diesel_agente", "diesel_resumo"],
};
const soNominal = (p) => p === "dp360" || p.startsWith("dp360_") || p.startsWith("guard_") || p.startsWith("config_");

function fabricar(nivel, paginasDoNivel, liberadas = [], bloqueadas = []) {
  const ehAdmin = /^(administrador|admin)$/i.test(nivel);
  const L = new Set(liberadas), B = new Set(bloqueadas), N = new Set(paginasDoNivel);
  // a trava da TELA (access.js)
  const veNoMenu = (p) => {
    if (soNominal(p)) return ehAdmin || (L.has(p) && !B.has(p));
    if (ehAdmin) return true;
    if (B.has(p)) return false;
    if (L.has(p)) return true;
    return N.has(p);
  };
  // a trava do SERVIDOR (gateways) — hoje o bcnt-api ainda dá "home" a todo mundo
  const podeGw = (p, { homeUniversal }) => {
    if (homeUniversal && p === "home") return true;
    if (ehAdmin) return true;
    if (B.has(p)) return false;
    if (L.has(p)) return true;
    if (soNominal(p)) return false;
    return process.env.SEMNIVEL === "1" ? false : N.has(p);
  };
  const podeTabela = (t, o) => {
    if (t.startsWith("BCNT:")) return (ACESSO_BCNT[t] ?? []).some((p) => podeGw(p, o));
    const r = ACESSO_DP360[t];
    if (r === "admin") return ehAdmin;
    if (r === "logado") return true;
    return (r ?? PAGINAS_DO_PONTO).some((p) => podeGw(p, o));
  };
  return { veNoMenu, podeTabela, ehAdmin };
}

const falsasNegativas = [], folgas = [];
for (const { nome, paginas } of perfis) {
  const g = fabricar(nome, paginas || []);
  const o = { homeUniversal: process.env.ANTES === "1" };
  // o que o MENU alcanca: uniao das tabelas das telas que a pessoa abre
  const pelasTelas = new Set();
  for (const [pagina, tabelas] of Object.entries(TELAS)) {
    if (g.veNoMenu(pagina)) tabelas.forEach((t) => pelasTelas.add(t));
  }
  // 1) falsa negativa: a tela abre e o servidor recusa a tabela dela
  for (const [pagina, tabelas] of Object.entries(TELAS)) {
    if (!g.veNoMenu(pagina)) continue;
    for (const t of tabelas) {
      if (!g.podeTabela(t, o)) falsasNegativas.push(`${nome} · ${pagina} → ${t}`);
    }
  }
  // 2) folga: o servidor responde tabela que NENHUMA tela dela alcanca
  if (!g.ehAdmin) {
    const todas = new Set(Object.values(TELAS).flat());
    for (const t of todas) {
      if (!pelasTelas.has(t) && g.podeTabela(t, o) && t !== "funcionarios") {
        folgas.push(`${nome} → ${t}`);
      }
    }
  }
}

const negativasPessoa = [], folgasPessoa = [];
for (const u of usuarios) {
  const g = fabricar(u.nivel, mapaPerfil[u.nivel] || [], u.liberadas || [], u.bloqueadas || []);
  const o = { homeUniversal: process.env.ANTES === "1" };
  const pelasTelas = new Set();
  for (const [pagina, tabelas] of Object.entries(TELAS)) {
    if (g.veNoMenu(pagina)) tabelas.forEach((t) => pelasTelas.add(t));
  }
  for (const [pagina, tabelas] of Object.entries(TELAS)) {
    if (!g.veNoMenu(pagina)) continue;
    for (const t of tabelas) {
      if (!g.podeTabela(t, o)) negativasPessoa.push(`${u.nome} (${u.nivel}) · ${pagina} → ${t}`);
    }
  }
  if (!g.ehAdmin) {
    for (const t of new Set(Object.values(TELAS).flat())) {
      if (!pelasTelas.has(t) && g.podeTabela(t, o) && t !== "funcionarios") {
        folgasPessoa.push(`${u.nome} (${u.nivel}) → ${t}`);
      }
    }
  }
}

const unico = (a) => [...new Set(a)];
if (usuarios.length) {
  console.log(`=== PESSOAS (${usuarios.length} ativas e aprovadas) ===`);
  console.log("falsa negativa: " + (unico(negativasPessoa).join(" | ") || "nenhuma"));
  console.log("folga:          " + (unico(folgasPessoa).join(" | ") || "nenhuma"));
  console.log("");
}
console.log("=== FALSA NEGATIVA (menu abre, gateway recusa) ===");
console.log(unico(falsasNegativas).join(String.fromCharCode(10)) || "  nenhuma");
console.log("=== FOLGA (servidor responde tabela que nenhuma tela dela alcanca) ===");
console.log(unico(folgas).join(String.fromCharCode(10)) || "  nenhuma");
