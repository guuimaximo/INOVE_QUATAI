// Cliente do gateway DP360. TUDO passa pela Edge Function `dp360-api`, que
// valida a sessão do INOVE, exige Administrador e guarda a chave da base de
// ponto como secret. O navegador nunca vê credencial da base DP360.
import { supabase } from "../supabase";

const LIMITE_PAGINA = 1000;

// O supabase-js ENGOLE o corpo da resposta quando o status nao e 2xx: `error.message`
// vira sempre "Edge Function returned a non-2xx status code", que nao diz nada. O motivo
// de verdade ("acesso DP360 exclusivo para Administrador", "tabela nao liberada",
// "coluna invalida"...) vem no JSON, acessivel por `error.context`. Sem isto, qualquer
// falha na tela vira a mesma frase inutil e a gente fica adivinhando.
async function motivoReal(error) {
  const resposta = error?.context;
  if (resposta && typeof resposta.json === "function") {
    try {
      const corpo = await resposta.clone().json();
      if (corpo?.error) return `${corpo.error}${resposta.status ? ` (HTTP ${resposta.status})` : ""}`;
    } catch {
      try {
        const texto = await resposta.clone().text();
        if (texto) return texto.slice(0, 200);
      } catch { /* sem corpo legivel */ }
    }
  }
  if (resposta?.status === 401) return "sessão do INOVE expirada — saia e entre de novo";
  if (resposta?.status === 403) return "acesso à DP360 é exclusivo de Administrador";
  return error?.message || "Não foi possível consultar a base DP360.";
}

// O gateway exige o token do USUARIO (nao a anon key). Mas o INOVE deixa a pessoa
// navegando com o `user` do localStorage mesmo quando a sessao do Supabase caiu — o
// guard de rota so olha o localStorage. Resultado: a tela abre, o invoke vai sem token
// valido e TUDO devolve 401 "sessão do INOVE inválida", sem a pessoa entender por que.
// Aqui a gente tenta renovar antes de desistir; so reclama se nem o refresh salvar.
async function garantirSessao() {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) return data.session;
  } catch { /* sem sessao em memoria — tenta renovar abaixo */ }
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data?.session?.access_token) return data.session;
  } catch { /* refresh falhou — a sessao morreu de vez */ }
  return null;
}

async function chamar(body) {
  const sessao = await garantirSessao();
  if (!sessao) {
    throw new Error(
      "Sua sessão do INOVE expirou. Saia e entre de novo para abrir a DP360."
    );
  }
  const { data, error } = await supabase.functions.invoke("dp360-api", { body });
  if (error) throw new Error(await motivoReal(error));
  if (!data?.ok) throw new Error(data?.error || "Não foi possível consultar a base DP360.");
  return data;
}

/** Última atualização por fonte (aba Início). */
export async function carregarResumoDP360() {
  return chamar({ action: "overview" });
}

/**
 * Uma página de uma tabela liberada.
 * `filtros` no padrão PostgREST, por coluna:
 *   { cracha: "eq.30061089" }
 *   { date_ref: ["gte.2026-08-01", "lte.2026-08-31"] }  // intervalo
 *   { cracha: "in.(1,2,3)", latitude: "not.is.null" }
 */
export async function lerDP360(tabela, { colunas, filtros, ordem, limite, offset } = {}) {
  const dados = await chamar({
    action: "read",
    tabela,
    colunas,
    filtros,
    ordem,
    limite,
    offset,
  });
  return dados.linhas || [];
}

/**
 * Datas distintas de uma coluna, já deduplicadas NO SERVIDOR (desc).
 * Serve para montar o seletor de dia sem a tela ter de paginar a tabela toda.
 *
 * O cache é AQUI, no navegador, de propósito: descobrir os dias custa varrer
 * milhares de linhas (~5-8 s) porque o PostgREST não faz DISTINCT, e o cache em
 * memória da Edge Function não segura — cada chamada pode cair num isolate novo
 * (medido: 2 chamadas seguidas, nenhuma acertou o cache). A base só muda no
 * import diário, então guardar por sessão deixa a troca de aba instantânea.
 */
const CACHE_DATAS = new Map();
const CACHE_DATAS_MS = 10 * 60 * 1000;

export async function lerDatasDP360(tabela, coluna, filtros) {
  const chave = `${tabela}|${coluna}|${JSON.stringify(filtros || null)}`;
  const guardado = CACHE_DATAS.get(chave);
  if (guardado && Date.now() - guardado.em < CACHE_DATAS_MS) return guardado.datas;

  const dados = await chamar({ action: "datas", tabela, coluna, filtros });
  const datas = dados.datas || [];
  CACHE_DATAS.set(chave, { em: Date.now(), datas });
  return datas;
}

/** Esquece as datas guardadas (usar no botão de recarregar das abas). */
export function limparCacheDatasDP360() {
  CACHE_DATAS.clear();
}

/** Lê a tabela inteira paginando (com teto de segurança para não travar a tela). */
export async function lerTudoDP360(tabela, opcoes = {}, maxPaginas = 40) {
  const passo = Math.min(opcoes.limite || LIMITE_PAGINA, LIMITE_PAGINA);
  const todas = [];
  for (let pagina = 0; pagina < maxPaginas; pagina += 1) {
    const bloco = await lerDP360(tabela, { ...opcoes, limite: passo, offset: pagina * passo });
    todas.push(...bloco);
    if (bloco.length < passo) break;
  }
  return todas;
}

async function gravar(tabela, op, payload) {
  return chamar({ action: "write", tabela, op, ...payload });
}

/** UPSERT (merge por chave definida no servidor). */
export function upsertDP360(tabela, linhas) {
  return gravar(tabela, "upsert", { linhas: Array.isArray(linhas) ? linhas : [linhas] });
}

/** INSERT append-only (histórico/log). */
export function inserirDP360(tabela, linhas) {
  return gravar(tabela, "insert", { linhas: Array.isArray(linhas) ? linhas : [linhas] });
}

/**
 * UPDATE (PATCH) — muda colunas de linhas que JA EXISTEM.
 *
 * Nao e upsert: upsert com a chave errada CRIA linha, e em tabela de deteccao
 * (fraude) linha nova e ocorrencia, que so o bot insere. O servidor recusa
 * update sem filtro e recusa coluna fora da lista liberada para a tabela.
 */
export function atualizarDP360(tabela, filtros, campos) {
  return gravar(tabela, "update", { filtros, campos });
}

/**
 * Dispara o robô que dirige o Transnet (Selenium no GitHub Actions do repo
 * DP360). O navegador não dirige o Transnet, e a credencial não passa por aqui:
 * ela é secret do workflow. O INOVE decide, o robô executa.
 *
 * `confirmar` NASCE FALSO no servidor: sem ele os quatro bots fazem ENSAIO —
 * navegam, acham o botão e não clicam. Quem quer valendo manda "true", e a
 * trilha (dp360_auditoria) guarda qual dos dois foi, com quem clicou.
 *
 * Robôs e seus inputs (o servidor recusa qualquer outro):
 *   ocorrencias  csv (cracha,data,tipo)                    · confirmar
 *   ponto        csv (cracha,entrada,alm_saida,...) · data · confirmar
 *   comunicado   csv (Empresa;Crachá;Comunicado)    · data · motivo · confirmar
 *   ajustes      modo · casos (JSON)                       · confirmar
 */
/* ── A CREDENCIAL DO TRANSNET ────────────────────────────────────────────────
 * O robô entra no Transnet com um login de GENTE, e é no nome de quem entrou que o
 * Transnet registra a ação. Então a credencial é a de quem manda — não uma conta de
 * serviço comum, que faria toda correção do mês aparecer como sendo da mesma pessoa.
 *
 * ELA MORA NO `sessionStorage`, E SÓ. Não vai para o banco do INOVE, não vai para o
 * `localStorage`, não é sincronizada com nada. Consequências, que são o desenho e não
 * efeito colateral:
 *   · a Gabi digita a dela; o Josué, na máquina dele, vê o campo VAZIO — não é permissão,
 *     é que o dado não existe em lugar nenhum comum;
 *   · fechou a aba ou saiu do INOVE, some (ver o `logout` do AuthContext);
 *   · e nenhuma tela do INOVE tem de onde ler a senha de outra pessoa, porque não há onde.
 */
const CHAVE_CREDENCIAL = "dp360:transnet";

export function lerCredencialTransnet() {
  try {
    const cru = window.sessionStorage.getItem(CHAVE_CREDENCIAL);
    if (!cru) return null;
    const { usuario, senha } = JSON.parse(cru);
    return usuario && senha ? { usuario, senha } : null;
  } catch {
    return null;
  }
}

export function salvarCredencialTransnet(usuario, senha) {
  try {
    window.sessionStorage.setItem(
      CHAVE_CREDENCIAL,
      JSON.stringify({ usuario: String(usuario || "").trim(), senha: String(senha || "") }),
    );
  } catch {
    /* navegador sem sessionStorage: a pessoa digita de novo, e é só isso */
  }
}

export function apagarCredencialTransnet() {
  try {
    window.sessionStorage.removeItem(CHAVE_CREDENCIAL);
  } catch {
    /* nada a fazer */
  }
}

/**
 * A URL da foto que o robô tirou no Transnet.
 *
 * O bucket é PRIVADO: navegador nenhum lê direto. Quem assina é a Edge Function, que já
 * exige sessão do INOVE e nível Administrador, e a assinatura vale pouco tempo — foto com
 * nome, crachá e horário de gente não fica em link aberto por aí.
 */
export async function dispararEvidenciaUrl(id) {
  const dados = await chamar({ action: "evidencia_url", ids: [id] });
  const item = (dados.urls || []).find((u) => Number(u.id) === Number(id));
  if (!item?.url) throw new Error(item?.erro || "não foi possível abrir esta evidência");
  return item.url;
}

/**
 * A prova de UM RUN, listada direto do bucket do banco do ponto.
 *
 * Desde 14/09/2026 o próprio bot sobe a foto assim que tira, e não escreve linha em
 * tabela nenhuma — o `run_id` no caminho já é o elo com o disparo. Então para mostrar a
 * prova basta listar a pasta daquele run, e é isso que o gateway faz (varrendo os quatro
 * robôs, porque a tela sabe o run e o mês, mas não quem fez).
 */
export async function evidenciasDoRun(runId, ano, mes) {
  const dados = await chamar({ action: "evidencia_run", run_id: runId, ano, mes });
  return dados.arquivos || [];
}

/**
 * "ACABOU DE SAIR UM ROBÔ" — avisado por evento, e não por chamada.
 *
 * O vigia (`roboVigia`) precisa saber disso para ler o GitHub na hora, senão o topo
 * continua dizendo "robô parado" por até dois minutos depois do disparo. Fazer cada tela
 * avisá-lo daria no mesmo até alguém criar a quinta tela de disparo e esquecer; e o
 * caminho inverso (este serviço importar o vigia) fecharia um ciclo, porque o vigia já
 * importa daqui. Um evento do `window` não tem dono nem direção.
 */
export const EVENTO_ROBO_DISPARADO = "dp360:robo-disparado";

export function dispararRoboDP360(robo, inputs) {
  // A credencial viaja no corpo da chamada, para o gateway — NUNCA como input do
  // workflow: o GitHub imprime os inputs no log da execução (medido neste projeto).
  const pedido = chamar({ action: "robo", robo, inputs, credencial: lerCredencialTransnet() });
  const avisar = () => {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENTO_ROBO_DISPARADO));
  };
  // Nos dois desfechos: o gateway pode responder erro DEPOIS de o run ter nascido, e aí o
  // robô está rodando de verdade. Este `then` também é quem trata a recusa deste ramo —
  // sem ele, a promessa derivada viraria "unhandled rejection" no console.
  pedido.then(avisar, avisar);
  return pedido;
}

/**
 * Os runs do robô no GitHub — de QUALQUER origem, inclusive os que a ferramenta
 * do PC dispara sem passar por aqui. Somente leitura: é a resposta para "tem bot
 * mexendo no Transnet agora?", que a trilha do INOVE sozinha não sabe dar.
 */
/**
 * O LOG DO RUN, COMO ELE ESTÁ AGORA — inclusive com o robô no meio do trabalho.
 *
 * O bot imprime uma linha por caso enquanto anda; o GitHub serve o log de um job em
 * andamento; então a tela não precisa esperar o robô terminar para dizer em quem ele está.
 * Vem só o FIM do arquivo: o log passa de megabyte e o que interessa é o que ele escreveu
 * desde a última olhada.
 *
 * Log indisponível devolve texto VAZIO em vez de erro. Nos primeiros segundos do run ele
 * não existe mesmo, e isso não é defeito: é cedo.
 */
export async function logRoboDP360(runId) {
  const dados = await chamar({ action: "robo_log", run_id: runId });
  return String(dados.texto || "");
}

export async function statusRoboDP360(horas = 6) {
  const dados = await chamar({ action: "robo_status", horas });
  return dados.runs || [];
}

/** DELETE — o servidor recusa sem filtro, de propósito. */
export function apagarDP360(tabela, filtros) {
  return gravar(tabela, "delete", { filtros });
}
