// Cliente do gateway DP360. TUDO passa pela Edge Function `dp360-api`, que
// valida a sessão do INOVE, exige Administrador e guarda a chave da base de
// ponto como secret. O navegador nunca vê credencial da base DP360.
import { supabase } from "../supabase";
import { getStoredUser } from "../utils/auth";
import { saneiaDiaDoPonto } from "../pages/dp360/diaNoTransnet.js";

/* A PAGINA E DE 1000 PORQUE O SERVIDOR CORTA EM 1000 — e isso NAO se negocia daqui.
   O gateway aceita pedir ate 5000 (`LIMITE_MAX`), mas o PostgREST da base do ponto tem
   `max-rows` 1000: pedindo 5000, volta 1000 (medido em 16/09/2026: `content-range 0-999`).
   Em 15/09 eu subi a pagina para 5000 achando que ganharia velocidade, e o efeito foi o
   contrario do pretendido: a leitura recebia 1000 < 5000, entendia "acabou" e PARAVA — as
   Ocorrencias passaram a ler so as primeiras 1000 linhas de cada tabela (a de pedidos tem
   9.202 na janela). A pagina tem de ser o tamanho que o servidor devolve de verdade.
   A velocidade vem de outro lugar: as paginas saem EM PARALELO (`PAGINAS_JUNTAS`). */
const LIMITE_PAGINA = 1000;
const PAGINAS_JUNTAS = 3;

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
  const linhas = dados.linhas || [];
  /* A REGRA DA SUGESTAO PASSA AQUI, E SO AQUI (22/09/2026) ────────────────────
   *
   * Dono: "voce nao pode ajustar 1 ou outro e sim a regra". Eram 25 leituras de
   * `ponto_diario` em nove telas (Folgas, Gordura, Motorista, Ocorrencias, Refeicao,
   * Revisao, Cartao do dia, Abandonos, Resumo). Consertar na tela significa lembrar de
   * consertar em nove lugares e errar no decimo — foi exatamente o que aconteceu com o
   * almoco inventado, que eu tirei das Ocorrencias e continuou de pe na Revisao.
   *
   * Aqui e a porta: `lerTudoDP360` tambem passa por esta funcao, entao nenhuma tela
   * precisa lembrar de nada. O dia chega saneado ou nao chega.
   *
   * Custo: uma passada por linha, sem alocar quando nao ha o que desfazer (3,5% dos dias
   * medidos). O resto volta pela mesma referencia. */
  return tabela === "ponto_diario" ? linhas.map(saneiaDiaDoPonto) : linhas;
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
  /* EM LOTES PARALELOS, e a ordem das páginas é preservada: o lote é montado, as três
     leituras saem juntas, e as linhas entram na ordem do offset. Para na PRIMEIRA página
     curta — as seguintes do mesmo lote, se houver, vêm vazias (offset além do fim).
     Exige `ordem` estável, como a leitura sequencial já exigia. */
  for (let pagina = 0; pagina < maxPaginas; pagina += PAGINAS_JUNTAS) {
    const paginas = [];
    for (let p = pagina; p < Math.min(pagina + PAGINAS_JUNTAS, maxPaginas); p += 1) paginas.push(p);
    const blocos = await Promise.all(
      paginas.map((p) => lerDP360(tabela, { ...opcoes, limite: passo, offset: p * passo })),
    );
    for (const bloco of blocos) {
      todas.push(...bloco);
      if (bloco.length < passo) return todas;
    }
  }
  return todas;
}

async function gravar(tabela, op, payload) {
  return chamar({ action: "write", tabela, op, ...payload });
}

/* O `motivo` É O NOME DA AÇÃO, como a tela a chama ("Marcação gravada", "Decisão
   desfeita", "Real cravado"). Ele não muda o que é gravado no ponto: vai para a TRILHA
   (`dp360_auditoria`), e é o que faz o histórico ser lido por gente em vez de uma lista de
   upserts. Quem não manda nada continua funcionando igual. */

/** UPSERT (merge por chave definida no servidor). */
export function upsertDP360(tabela, linhas, motivo) {
  return gravar(tabela, "upsert", { linhas: Array.isArray(linhas) ? linhas : [linhas], motivo });
}

/**
 * UPSERT QUE INSISTE (17/09/2026 — dono: "não pode dar esse problema do 400"). Usado onde a
 * gravação vem DEPOIS de algo que já aconteceu fora daqui (o comunicado saiu): falhar ali
 * deixa o dia sem o caso e o prazo de 48 h parado. Upsert é idempotente — regravar a mesma
 * linha não muda nada —, então tentar de novo é seguro. O gateway já grava em partes e
 * nomeia só o que não entrou; aqui entram as falhas de passagem (rede, função fria).
 */
export async function upsertDP360Insistente(tabela, linhas, motivo, tentativas = 3) {
  let ultima;
  for (let i = 0; i < tentativas; i += 1) {
    try {
      return await upsertDP360(tabela, linhas, motivo);
    } catch (falha) {
      ultima = falha;
      if (i < tentativas - 1) await new Promise((ok) => setTimeout(ok, 1500 * (i + 1)));
    }
  }
  throw ultima;
}

/** INSERT append-only (histórico/log). */
export function inserirDP360(tabela, linhas, motivo) {
  return gravar(tabela, "insert", { linhas: Array.isArray(linhas) ? linhas : [linhas], motivo });
}

/**
 * UPDATE (PATCH) — muda colunas de linhas que JA EXISTEM.
 *
 * Nao e upsert: upsert com a chave errada CRIA linha, e em tabela de deteccao
 * (fraude) linha nova e ocorrencia, que so o bot insere. O servidor recusa
 * update sem filtro e recusa coluna fora da lista liberada para a tabela.
 */
export function atualizarDP360(tabela, filtros, campos, motivo) {
  return gravar(tabela, "update", { filtros, campos, motivo });
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

/* A CREDENCIAL TEM DONO (15/09/2026). O dono do sistema entrou no INOVE como Larissa e o
 * topo mostrava "Transnet · GABRIELLECARNEIRO": a credencial da sessão anterior continuava
 * na aba, e o robô sairia no nome da Gabrielle. O `logout` apaga, mas nem toda troca de
 * pessoa passa por ele (a sessão que expira por inatividade limpa o usuário e não a
 * credencial). Então ela guarda QUEM do INOVE a digitou, e só vale para essa pessoa —
 * para qualquer outra, é apagada na primeira leitura. Credencial antiga, sem dono, também
 * é apagada: a pessoa digita de novo uma vez. */
function donoAtual() {
  const u = getStoredUser();
  return String(u?.id ?? u?.usuario_id ?? u?.auth_user_id ?? "").trim();
}

export function lerCredencialTransnet() {
  try {
    const cru = window.sessionStorage.getItem(CHAVE_CREDENCIAL);
    if (!cru) return null;
    const { usuario, senha, dono } = JSON.parse(cru);
    if (!dono || String(dono) !== donoAtual()) {
      window.sessionStorage.removeItem(CHAVE_CREDENCIAL);
      return null;
    }
    return usuario && senha ? { usuario, senha } : null;
  } catch {
    return null;
  }
}

export function salvarCredencialTransnet(usuario, senha) {
  try {
    const dono = donoAtual();
    if (!dono) return; // sem pessoa logada não há de quem ser a credencial
    window.sessionStorage.removeItem(CHAVE_VALIDACAO); // credencial nova, teste novo
    window.sessionStorage.setItem(
      CHAVE_CREDENCIAL,
      JSON.stringify({ usuario: String(usuario || "").trim(), senha: String(senha || ""), dono }),
    );
  } catch {
    /* navegador sem sessionStorage: a pessoa digita de novo, e é só isso */
  }
}

export function apagarCredencialTransnet() {
  try {
    window.sessionStorage.removeItem(CHAVE_CREDENCIAL);
    window.sessionStorage.removeItem(CHAVE_VALIDACAO);
  } catch {
    /* nada a fazer */
  }
}

/* O TESTE DO LOGIN (dono, 17/09/2026: "quando colocar o usuário e senha no Transnet, quero um
 * bot de validação de login"). O resultado mora na MESMA sessão da credencial e só vale para
 * o login que foi testado: trocou de conta, o teste antigo não serve. */
const CHAVE_VALIDACAO = "dp360:transnet:validacao";

export function lerValidacaoTransnet() {
  try {
    const v = JSON.parse(window.sessionStorage.getItem(CHAVE_VALIDACAO) || "null");
    const cred = lerCredencialTransnet();
    if (!v || !cred || v.usuario !== cred.usuario) return null;
    return v;
  } catch {
    return null;
  }
}

export function gravarValidacaoTransnet(v) {
  try {
    if (v) window.sessionStorage.setItem(CHAVE_VALIDACAO, JSON.stringify(v));
    else window.sessionStorage.removeItem(CHAVE_VALIDACAO);
  } catch {
    /* sem sessionStorage: o teste vale só enquanto a tela estiver aberta */
  }
}

/** Dispara o robô `login` (bot_login.py): ele só entra no Transnet e confere se entrou. O
 *  gateway grava a credencial num par PRÓPRIO de secrets — o dos lotes não é tocado. */
export function testarLoginTransnet() {
  return dispararRoboDP360("login", {});
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
export async function evidenciasDoRun(runId, ano, mes, { semUrl = false } = {}) {
  // `semUrl`: só os nomes — é o que o quadro do lote precisa a cada poucos segundos, e
  // assinar URL de dezenas de fotos a cada volta é trabalho jogado fora
  const dados = await chamar({ action: "evidencia_run", run_id: runId, ano, mes, ...(semUrl ? { sem_url: true } : {}) });
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

/* ═══ NINGUÉM ESPERA NA FILA DO TRANSNET (22/09/2026) ═════════════════════════
 *
 * Dono, depois de eu oferecer um botão de "mandar de novo": "mas não é mandar de novo e
 * sim NÃO DAR O PROBLEMA".
 *
 * Ele está certo, e a diferença é toda: reenviar conserta o estrago depois; o que se quer é
 * que o estrago não aconteça. E dá para garantir isso sem tocar nos robôs.
 *
 * O QUE ACONTECE. Os quatro workflows do Transnet dividem `concurrency: bots-transnet` com
 * `cancel-in-progress: false`. Nesse desenho o GitHub mantém **um** run rodando e **um**
 * esperando; quando chega um terceiro, o que estava ESPERANDO é cancelado. Em 22/09 isso
 * matou dois lotes de comunicado (15:02 e 15:03) e os dez avisos não saíram.
 *
 * A CHAVE: run que já ENTROU em execução nunca é cancelado por este grupo — só morre quem
 * está na fila. Então a regra é simples: **não pôr ninguém na fila**. A tela espera o
 * Transnet ficar livre e só então dispara, e o run vai direto para execução.
 *
 * É por isso que a espera é por qualquer robô (rodando OU esperando), e não só pelos que
 * esperam: disparar enquanto um robô roda criaria exatamente a fila que mata.
 *
 * O CUSTO, dito com todas as letras: o DP espera alguns minutos com a tela aberta, em vez
 * de achar que mandou e descobrir depois que não foi. A tela mostra a espera (`aoEsperar`)
 * e o robô de quem ela está esperando. */
const OCUPANDO_A_FILA = new Set(["queued", "waiting", "pending", "requested", "in_progress"]);
const ESPERA_ENTRE_OLHADAS_MS = 6000;
const ESPERA_MAXIMA_MS = 12 * 60 * 1000;

async function esperarAFilaLivre({ aoEsperar, maximoMs = ESPERA_MAXIMA_MS }) {
  const inicio = Date.now();
  for (;;) {
    let ocupada = [];
    try {
      const runs = await statusRoboDP360(2);
      ocupada = (runs || []).filter((r) => OCUPANDO_A_FILA.has(String(r?.status ?? "").toLowerCase()));
    } catch {
      // Sem conseguir LER a fila eu não seguro o disparo: deixar de mandar por não ter
      // conseguido olhar seria trocar uma perda possível por uma perda certa.
      return;
    }
    if (!ocupada.length) return;
    const esperando = Date.now() - inicio;
    if (esperando >= maximoMs) {
      throw new Error(
        `O Transnet está ocupado há ${Math.round(esperando / 60000)} min (${ocupada[0]?.nome || "outro robô"}) ` +
        "e eu não disparei: entrar na fila agora faria este lote ser cancelado por quem vier depois. " +
        "Veja o robô que está rodando e mande quando ele terminar.",
      );
    }
    aoEsperar?.({
      segundos: Math.round(esperando / 1000),
      quem: ocupada[0]?.nome || "outro robô",
      quantos: ocupada.length,
    });
    await new Promise((ok) => setTimeout(ok, ESPERA_ENTRE_OLHADAS_MS));
  }
}

export async function dispararRoboDP360(robo, inputs, { forcar = false, aoEsperar } = {}) {
  if (!forcar) await esperarAFilaLivre({ aoEsperar });
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
export function apagarDP360(tabela, filtros, motivo) {
  return gravar(tabela, "delete", { filtros, motivo });
}

/**
 * A TRILHA DE UM CRACHÁ+DIA — quem mexeu, quando, e de quê para quê.
 *
 * A tabela mora no INOVE e só Administrador a lê direto (ela guarda crachá e nome). Quem
 * serve aqui é o gateway, que já sabe quem está pedindo e o que essa pessoa pode ver na
 * DP360 — e devolve só o daquele dia.
 */
export async function lerTrilhaDP360(cracha, dateRef, limite = 60) {
  const dados = await chamar({ action: "trilha", cracha, date_ref: dateRef, limite });
  return dados.linhas || [];
}
