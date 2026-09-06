// ============================================================================
// DP360 · ABANDONOS — possíveis abandonos de emprego
//
// FONTE DA VERDADE deste arquivo (nada aqui foi inventado):
//   Sistemas/PONTO/app/main.py
//     get_abandonos ........... ~7559  (A REGRA — dias consolidados + streak)
//     _bucket ................. ~7458  (classificação da linha do cartão)
//     _abandono_nao_bate ...... ~7540  (quem cronicamente não bate ponto)
//     set_abandono_nao_bate ... ~7547  (a gravação — NÃO portada nesta fase)
//     _abandono_monitor ....... ~7522  (marcação de acompanhamento)
//     _res() .................. ~4491  → processar_ponto(ler_ponto_diario())
//                                        devolve as linhas CRUAS da ponto_diario
//   Sistemas/PONTO/app/ui/app.js
//     viewAbandonos ........... ~6622  (a tela: colunas, ordem, textos, vazio)
//     estilos .ab-* ........... app/ui/styles.css ~805-813
//
// O QUE A TELA RESPONDE: "quem sumiu?". Não é falta, não é atestado, não é
// férias — é ausência SEGUIDA e SEM NENHUMA EXPLICAÇÃO lançada no Transnet.
//
// A REGRA, EM UMA FRASE (main.py:7559): pessoa com >= 4 dias CONSECUTIVOS sem
// ponto e sem justificativa, contando SÓ dias já CONSOLIDADOS, com a contagem
// feita do dia consolidado mais recente para trás.
//
// POR QUE "CONSOLIDADO" É O CORAÇÃO DA REGRA: a batida dos dias mais recentes
// ainda não fechou no recibo. Sem esse corte, o dia de ontem apareceria vazio
// para TODO MUNDO e a tela flaggaria a garagem inteira como abandono. Um dia só
// entra na conta quando >= 30% de quem tem linha naquele dia já bateu ponto —
// é a "massa de ponto na garagem" que prova que o dia fechou.
//
// ⚠ A TELA GRAVA — e por isso só grava com TRILHA (liberado em 2026-09-06).
// Os dois botões da última coluna ("🚫 não bate ponto" e "👁 acompanhar") nasceram
// desabilitados porque a marcação decide se uma pessoa entra ou não numa lista de
// abandono, e abandono de emprego é justa causa (CLT art. 482 "e"/"i"): marcar
// errado esconde de quem precisa ver; desmarcar errado joga alguém para dentro da
// lista. O que faltava não era código, era REGISTRO DE QUEM FEZ — o `app_config`
// guarda só a lista, sem autor e sem data. Agora cada clique grava DOIS lugares:
//   1) a lista JSON no `app_config` do projeto de IMPORTAÇÃO, via gateway
//      `dp360-api` (é de onde a ferramenta desktop lê — mudar de lugar cega ela);
//   2) UMA linha em `public.dp360_auditoria` no projeto do INOVE, pelo cliente
//      `supabase` normal (a trilha é do INOVE, não da base de importação).
// Ver o bloco no fim do arquivo para o porquê da releitura antes do upsert.
// ============================================================================
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { AuthContext } from "../../context/AuthContext";
import { useAccessGovernance } from "../../context/AccessContext";
import { canUserAccessPath } from "../../utils/access";
import { lerDP360, lerTudoDP360, upsertDP360 } from "../../services/dp360Api";
import { supabase } from "../../supabase";
import AbaShell from "./abas/AbaShell";
import "./dp360.css";

/* ─────────────────────────── constantes do domínio ───────────────────────── */

// main.py:7559 — assinatura `get_abandonos(self, min_dias=4)`. É o gatilho da
// lista inteira: mudar isto muda quem é chamado para dar satisfação.
const MIN_DIAS = 4;

// main.py:7580 — `cp >= 0.3 * tot`. O dia só é consolidado quando pelo menos
// 30% de quem tem linha nele já bateu ponto.
const FRACAO_CONSOLIDADO = 0.3;

// app.js:6657 — `const grave = x.dias_sem_ponto >= 8`. Só muda a cor da linha.
const DIAS_GRAVE = 8;

// PORTE.md §4 — janela de dados de quase todas as leituras do DP360. É a mesma
// do original: `ler_ponto_diario()` (supabase_client.py:432) baixa 70 dias.
const JANELA_DIAS = 70;

// Teto de paginação (1000 linhas por página no gateway). 70 dias × garagem
// inteira passa de 40 mil linhas; sem folga aqui a leitura seria truncada em
// silêncio e a streak sairia ERRADA (dia faltando = dia "não escalado").
const TETO_PAGINAS = 60;
const LINHAS_POR_PAGINA = 1000;

// Tabela de trilha, no projeto do INOVE (migration 202609061400_dp360_auditoria).
// APPEND-ONLY: a policy dá `select` e `insert` a `authenticated` e mais nada —
// não há update nem delete, nem para quem foi marcado.
const TABELA_AUDITORIA = "dp360_auditoria";

// main.py:7455 — `_DASH_CATS`. Quem está fora destas três é ignorado por
// `_bucket` (devolve None): não conta para consolidar o dia nem vira linha.
const CATEGORIAS_DASH = new Set(["MOTORISTA", "INTERNO", "APRENDIZ"]);

// main.py:7601 — os três baldes que provam que a pessoa APARECEU no dia.
// Nota: para esta tela `incorreto` e `sem_operacao` são intercambiáveis (os
// dois só dizem "bateu"); a distinção é mantida porque `_bucket` é o
// classificador compartilhado do DP360, e torto aqui fica torto em toda parte.
const COM_PONTO = new Set(["ok", "incorreto", "sem_operacao"]);

// app.js:6655 — rótulo da categoria embaixo do nome.
const ROTULO_CATEGORIA = {
  MOTORISTA: "🚍 Motorista",
  INTERNO: "🔧 Interno",
  APRENDIZ: "🎓 Aprendiz",
};

// main.py:7542 / 7552 — as chaves no `app_config` (colunas `chave` / `valor`).
const CHAVE_NAO_BATE = "abandono_nao_bate";
const CHAVE_MONITOR = "abandono_monitor";

// Só o que `_bucket` + a lista realmente leem. Pedir `*` traria o cartão
// inteiro de cada dia — 70 dias disso não sobe.
const COLUNAS = [
  "cracha",
  "date_ref",
  "categoria",
  "status_ponto",
  "te_descricao_dia",
  "classificacao",
  "jornada_transnet",
  "teve_operacao",
  "nm_funcionario",
  "nm_funcao",
  "desligado_em",
].join(",");

/* ────────────────────────────── utilidades puras ─────────────────────────── */

const txt = (valor) => String(valor ?? "").trim();

// ATENÇÃO (convenção do lake, ver Folgas.jsx): booleanos da `ponto_diario`
// chegam como STRING "true"/"false". `=== false` derruba a regra sem erro.
const ehFalso = (valor) => valor === false || txt(valor).toLowerCase() === "false";

// NUNCA `new Date().toISOString()` para uma data local (CLAUDE.md): depois das
// 21h BRT devolve o dia seguinte e a janela abriria no lugar errado.
function isoDataLocal(data) {
  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, "0"),
    String(data.getDate()).padStart(2, "0"),
  ].join("-");
}

function isoDiasAtras(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return isoDataLocal(d);
}

// app.js:3770 (fmtData) — '2026-07-14' → '14/07/2026'.
function paraBR(iso) {
  const s = txt(iso);
  if (s.length < 10) return s || "—";
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
}

// app.js:40 (bateNome) — nome por substring, crachá por substring crua.
const bateNome = (linha, termo) =>
  linha.nome.toLowerCase().includes(termo) || linha.cracha.includes(termo);

// O `valor` do app_config pode chegar como jsonb já desserializado (array) ou
// como a STRING que o `json.dumps` do original gravou. Aceita os dois.
function listaDeConfig(valor) {
  if (Array.isArray(valor)) return valor.map(txt).filter(Boolean);
  const s = txt(valor);
  if (!s) return [];
  try {
    const lido = JSON.parse(s);
    return Array.isArray(lido) ? lido.map(txt).filter(Boolean) : [];
  } catch {
    return []; // config corrompida não pode derrubar a tela
  }
}

// As duas listas a partir das linhas cruas do `app_config`. Fica separado da
// leitura porque é usado nas DUAS: a carga inicial (junto com a base) e a
// releitura depois de gravar.
function marcasDeConfig(config) {
  const porChave = new Map((config || []).map((c) => [txt(c.chave), c.valor]));
  return {
    naoBate: new Set(listaDeConfig(porChave.get(CHAVE_NAO_BATE))),
    monitorados: new Set(listaDeConfig(porChave.get(CHAVE_MONITOR))),
  };
}

const CONSULTA_MARCAS = {
  colunas: "chave,valor",
  filtros: { chave: `in.(${CHAVE_NAO_BATE},${CHAVE_MONITOR})` },
  limite: 10,
};

/* ─────────────────────── autoria e trilha (lado INOVE) ───────────────────── */

function confirmar(texto) {
  if (typeof window === "undefined" || typeof window.confirm !== "function") return false;
  return window.confirm(texto);
}

// Mesma checagem que o resto do INOVE faz antes de gravar autor (molde:
// EstruturaFisicaSolicitacao.jsx). O `user.id` pode ser o id LEGADO (inteiro da
// `usuarios_aprovadores`) de quem ainda não tem conta no `auth.users`; mandar
// isso num campo `uuid` derruba o insert inteiro com erro de tipo.
function ehUUID(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    txt(valor),
  );
}

function uuidDoUsuario(user) {
  if (ehUUID(user?.auth_user_id)) return txt(user.auth_user_id);
  if (ehUUID(user?.id)) return txt(user.id);
  return null; // usuário legado: fica só o nome, que é melhor que nada
}

// A trilha é do INOVE, então vai pelo cliente `supabase` do INOVE — NÃO pelo
// gateway `dp360-api`, que fala com o projeto de importação e nem enxerga esta
// tabela. `criado_em` fica com o `default now()` do banco de propósito: carimbo
// de instante é do servidor, não do relógio (nem do fuso) do navegador.
async function registrarAuditoria({ acao, alvo, detalhe, user }) {
  const { error } = await supabase.from(TABELA_AUDITORIA).insert({
    acao,
    alvo: txt(alvo) || null,
    detalhe: detalhe || {},
    autor_id: uuidDoUsuario(user),
    autor_nome: txt(user?.nome) || txt(user?.login) || null,
  });
  // Erro REAL do servidor, sem maquiar: "new row violates row-level security",
  // "relation does not exist" (migration não aplicada) e afins têm de aparecer.
  if (error) throw new Error(error.message || "Não foi possível registrar a auditoria.");
}

/* ──────────────────────────────── a regra ────────────────────────────────── */

// PORTE FIEL de main.py:7458 (`_bucket`). Classifica a linha do cartão num
// balde do dashboard, ou null para ignorar.
//   sem_ponto   = SEM ponto E SEM nada lançado  → é o que alimenta a streak
//   justificado = SEM ponto MAS com lançamento no Transnet (atestado, férias,
//                 afastamento, DSR, falta…) → QUEBRA a streak, e é justamente
//                 por isso que quem está de atestado nunca vira abandono.
function balde(linha) {
  const categoria = txt(linha.categoria).toUpperCase();
  if (!CATEGORIAS_DASH.has(categoria)) return null;

  const status = txt(linha.status_ponto);
  if (status === "OK") return "ok";

  if (status === "SEM_PONTO") {
    const lancado = txt(linha.te_descricao_dia);
    const classificacao = txt(linha.classificacao).toUpperCase();
    return lancado || classificacao === "AFASTADO" ? "justificado" : "sem_ponto";
  }

  if (status === "REVISAR") {
    // Motorista que bateu ponto mas não operou (sem Citatti/bilhetagem).
    if (
      categoria === "MOTORISTA" &&
      txt(linha.jornada_transnet) &&
      ehFalso(linha.teve_operacao)
    ) {
      return "sem_operacao";
    }
    return "incorreto";
  }

  return null;
}

// PORTE FIEL de main.py:7559 (`get_abandonos`). Roda em memória sobre as linhas
// cruas da `ponto_diario` — exatamente como o original, que recebe
// `_res()["linhas"]` (= a lista devolvida por `ler_ponto_diario()`, sem
// transformação: `processar_ponto` só a repassa em `["linhas"]`).
function calcularAbandonos(linhas, naoBate, monitorados) {
  // ── 1) Dias CONSOLIDADOS: dia com massa de ponto na garagem (>= 30% bateu).
  const porDia = new Map(); // dia → [linhas com balde, linhas que bateram]
  for (const linha of linhas) {
    const dia = txt(linha.date_ref).slice(0, 10);
    if (!dia) continue;
    const b = balde(linha);
    if (b === null) continue;
    const acumulado = porDia.get(dia) || [0, 0];
    acumulado[0] += 1;
    if (COM_PONTO.has(b)) acumulado[1] += 1;
    porDia.set(dia, acumulado);
  }

  const consolidados = [...porDia.entries()]
    .filter(([, [total, comPonto]]) => total > 0 && comPonto >= FRACAO_CONSOLIDADO * total)
    .map(([dia]) => dia)
    .sort(); // ISO ordena como texto — do mais antigo ao mais recente
  if (!consolidados.length) return { linhas: [], ate: "", nDias: 0 };

  const setConsolidado = new Set(consolidados);

  // ── 2) Por crachá: dia → balde (só dias consolidados) + a linha de referência.
  // ATENÇÃO: o crachá é agrupado CRU (só trim), como no original. Não normalize
  // para 8 dígitos aqui: o lake tem a mesma pessoa com 7 e 8 dígitos, e juntar
  // as duas formas mudaria a streak — é decisão da regra, não desta tela.
  const porCracha = new Map();
  const meta = new Map();
  const desligados = new Set();

  for (const linha of linhas) {
    const dia = txt(linha.date_ref).slice(0, 10);
    if (!setConsolidado.has(dia)) continue;
    const cracha = txt(linha.cracha);
    if (!cracha) continue;

    // DESVIO DELIBERADO E DOCUMENTADO do original (main.py:7602):
    // lá o teste é `meta[cr].desligado_em`, e `meta` acaba sendo a linha que
    // vier por ÚLTIMO na iteração — depende da ordem, e a coluna não vem
    // preenchida em todas as linhas (o próprio app.js:6228 varre os 7 dias
    // atrás do primeiro `desligado_em` não vazio, prova de que ela falha).
    // Aqui: desligado em QUALQUER linha → fora da lista. O erro possível passa
    // a ser "não listar um desligado", nunca "acusar de abandono quem já saiu"
    // — que é o lado que machuca.
    if (txt(linha.desligado_em)) desligados.add(cracha);

    let dias = porCracha.get(cracha);
    if (!dias) {
      dias = new Map();
      porCracha.set(cracha, dias);
    }
    dias.set(dia, balde(linha));
    // As linhas chegam em `date_ref.desc`: a PRIMEIRA vista é a mais recente,
    // então é dela que saem nome/categoria/função exibidos.
    if (!meta.has(cracha)) meta.set(cracha, linha);
  }

  // ── 3) Streak de `sem_ponto` a partir do dia consolidado MAIS RECENTE.
  const saida = [];
  for (const [cracha, dias] of porCracha) {
    if (desligados.has(cracha)) continue;
    const ref = meta.get(cracha) || {};

    let streak = 0;
    let desde = "";
    let ultimoPonto = "";
    for (let i = consolidados.length - 1; i >= 0; i -= 1) {
      const dia = consolidados[i];
      const b = dias.get(dia);
      if (b === "sem_ponto") {
        streak += 1;
        desde = dia;
      } else if (COM_PONTO.has(b)) {
        ultimoPonto = dia; // apareceu: fim da contagem
        break;
      } else if (b === "justificado") {
        break; // atestado / férias / afastamento → NÃO é abandono
      }
      // sem linha nesse dia (não escalado) → ignora: nem conta nem quebra.
    }

    if (streak >= MIN_DIAS) {
      saida.push({
        cracha,
        nome: txt(ref.nm_funcionario) || txt(ref.nome),
        categoria: txt(ref.categoria).toUpperCase(),
        funcao: txt(ref.nm_funcao),
        diasSemPonto: streak,
        desde,
        ultimoPonto,
        monitorado: monitorados.has(cracha),
        naoBate: naoBate.has(cracha),
      });
    }
  }

  // main.py:7614 — marcados como "não bate ponto" por último; depois mais dias
  // primeiro; depois nome.
  saida.sort(
    (a, b) =>
      (a.naoBate ? 1 : 0) - (b.naoBate ? 1 : 0) ||
      b.diasSemPonto - a.diasSemPonto ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );

  return { linhas: saida, ate: consolidados[consolidados.length - 1], nDias: consolidados.length };
}

/* ────────────────────────────────── a tela ───────────────────────────────── */

export default function DP360Abandonos() {
  const { user } = useContext(AuthContext);
  const { profileMap } = useAccessGovernance();
  const podeAcessar = canUserAccessPath(user, "/dp360-abandonos", profileMap);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState({ linhas: [], ate: "", nDias: 0 });
  const [truncado, setTruncado] = useState(false);
  const [termo, setTermo] = useState("");
  const [mostraNaoBate, setMostraNaoBate] = useState(false);
  const [recarga, setRecarga] = useState(0);

  // `${chave}|${cracha}` enquanto grava — trava os dois botões da linha (e só
  // deles) para o duplo-clique não virar dois upserts.
  const [gravando, setGravando] = useState("");
  const [aviso, setAviso] = useState(null); // { tom: "ok"|"warn"|"danger", texto }

  // As linhas CRUAS da `ponto_diario` da última carga. Depois de marcar alguém, o
  // que mudou foi a lista do `app_config` — não o cartão de ponto de ninguém. Reler
  // só as marcações e recalcular sobre estas linhas evita rebaixar 70 dias × a
  // garagem inteira (até 60 páginas de 1000) a cada clique, e continua vindo do
  // banco: nada de estado otimista.
  const linhasRef = useRef([]);

  useEffect(() => {
    if (!podeAcessar) return undefined;
    let vivo = true;
    setCarregando(true);
    setErro("");

    (async () => {
      try {
        const desde = isoDiasAtras(JANELA_DIAS);
        const [config, linhas] = await Promise.all([
          // As duas marcações vivem no `app_config` (chave/valor), como no
          // original. Falhar aqui não pode derrubar a lista — por isso o catch.
          lerDP360("app_config", CONSULTA_MARCAS).catch(() => []),
          lerTudoDP360(
            "ponto_diario",
            {
              colunas: COLUNAS,
              filtros: { date_ref: `gte.${desde}` },
              ordem: "date_ref.desc,cracha",
            },
            TETO_PAGINAS,
          ),
        ]);
        if (!vivo) return;

        const { naoBate, monitorados } = marcasDeConfig(config);

        linhasRef.current = linhas;
        setTruncado(linhas.length >= TETO_PAGINAS * LINHAS_POR_PAGINA);
        setResultado(calcularAbandonos(linhas, naoBate, monitorados));
      } catch (falha) {
        if (vivo) setErro(falha?.message || "Não foi possível ler a base DP360.");
      } finally {
        if (vivo) setCarregando(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [podeAcessar, recarga]);

  const recarregar = useCallback(() => {
    setAviso(null);
    setRecarga((n) => n + 1);
  }, []);

  /* ─────────────────────────── a gravação (porte) ───────────────────────────
     main.py:7547 `set_abandono_nao_bate` e main.py:7529 `set_abandono_monitor`
     — a MESMA função nos dois, mudando só a chave. Sequência de um clique:

       1. RELÊ o `valor` da chave (não usa o que a tela carregou na abertura);
       2. UPSERT da lista INTEIRA no `app_config` (não existe update parcial);
       3. INSERT na trilha `dp360_auditoria`, no banco do INOVE;
       4. RELÊ as marcações do banco e recalcula — nada de pintar otimista.

     Passo 3 depois do 2 de propósito: trilha que registra o que não aconteceu é
     pior que trilha nenhuma. Se o passo 3 falhar, a marcação JÁ VALE e a tela
     diz isso na cara, em amarelo, com o erro do servidor.                     */

  const recarregarMarcas = useCallback(async () => {
    const config = await lerDP360("app_config", CONSULTA_MARCAS);
    const { naoBate, monitorados } = marcasDeConfig(config);
    setResultado(calcularAbandonos(linhasRef.current, naoBate, monitorados));
  }, []);

  const alternarMarca = useCallback(
    async (linha, chave, ligar) => {
      const cracha = txt(linha.cracha);
      if (!cracha || gravando) return;

      const rotulo = chave === CHAVE_NAO_BATE ? "não bate ponto" : "acompanhamento";
      const quem = `${linha.nome || "sem nome"} · crachá ${cracha} · ${linha.diasSemPonto} dias sem ponto`;
      const ok = confirmar(
        [
          ligar ? `Marcar “${rotulo}”:` : `Tirar a marcação “${rotulo}” de:`,
          quem,
          "",
          `Grava a lista ${chave} no app_config da base de ponto (é de lá que a`,
          "ferramenta do DP lê) e registra a ação, com o seu nome, em dp360_auditoria.",
          chave === CHAVE_NAO_BATE && ligar
            ? "\nMarcado assim, some da lista de possíveis abandonos."
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      if (!ok) return;

      setGravando(`${chave}|${cracha}`);
      setAviso(null);
      try {
        // 1) RELEITURA IMEDIATAMENTE ANTES DO UPSERT. Sem isto, duas abas abertas
        // (ou dois computadores) gravam cada uma a lista que leram na abertura e a
        // última apaga a marcação da outra — em silêncio, porque o upsert dá 200.
        const atual = await lerDP360("app_config", {
          colunas: "chave,valor",
          filtros: { chave: `eq.${chave}` },
          limite: 1,
        });
        const lista = new Set(listaDeConfig(atual?.[0]?.valor));
        if (ligar) lista.add(cracha);
        else lista.delete(cracha);

        // 2) `json.dumps(sorted(cur))` do original → STRING JSON, ordenada. Tem de
        // ser string mesmo: a ferramenta desktop faz `json.loads(valor)` e, se
        // gravássemos um array de verdade num `valor` jsonb, ela receberia uma
        // lista, o `json.loads` estouraria, o `except` devolveria set() e a
        // ferramenta passaria a NÃO ENXERGAR marcação nenhuma.
        await upsertDP360("app_config", { chave, valor: JSON.stringify([...lista].sort()) });

        // 3) trilha — o que faltava para liberar o botão.
        let falhaTrilha = "";
        try {
          await registrarAuditoria({
            acao: chave, // 'abandono_nao_bate' | 'abandono_monitor'
            alvo: cracha,
            detalhe: { ligar, nome: linha.nome || null, dias: linha.diasSemPonto },
            user,
          });
        } catch (falha) {
          falhaTrilha = falha?.message || "erro desconhecido";
        }

        // 4) relê do banco (marcações) e recalcula sobre as linhas já carregadas.
        await recarregarMarcas();

        setAviso(
          falhaTrilha
            ? {
                tom: "warn",
                texto: `Marcação gravada, mas a trilha de auditoria NÃO foi registrada: ${falhaTrilha}`,
              }
            : {
                tom: "ok",
                texto: `✓ ${ligar ? "marcado" : "desmarcado"} “${rotulo}” · ${cracha} · registrado em ${TABELA_AUDITORIA}`,
              },
        );
      } catch (falha) {
        setAviso({
          tom: "danger",
          texto: falha?.message || `Não foi possível gravar ${chave}.`,
        });
      } finally {
        setGravando("");
      }
    },
    [gravando, user, recarregarMarcas],
  );

  // app.js:6644-6650 — busca, depois a separação entre lista e marcados.
  const { visiveis, marcados, nPessoas } = useMemo(() => {
    const q = termo.trim().toLowerCase();
    const filtradas = q ? resultado.linhas.filter((x) => bateNome(x, q)) : resultado.linhas;
    const comMarca = filtradas.filter((x) => x.naoBate);
    const vis = mostraNaoBate ? filtradas : filtradas.filter((x) => !x.naoBate);
    return {
      visiveis: vis,
      marcados: comMarca,
      nPessoas: vis.filter((x) => !x.naoBate).length,
    };
  }, [resultado.linhas, termo, mostraNaoBate]);

  if (!podeAcessar) {
    return (
      <div className="dp360 -m-4 sm:-m-6">
        <div className="dp-topbar">
          <div className="dp-brand">
            <div className="dp-brand-mark">DP</div>
            <div>
              <div className="dp-brand-title">Abandonos</div>
              <div className="dp-brand-sub">acesso restrito</div>
            </div>
          </div>
        </div>
        <div className="dp-viewbar">
          <div className="dp-vazio" style={{ flex: 1 }}>
            Sem acesso à DP360. Peça ao administrador para liberar
            <span className="dp-mono"> /dp360-abandonos </span>
            no seu perfil do INOVE.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dp360 -m-4 sm:-m-6">
      <div className="dp-topbar">
        <div className="dp-brand">
          <div className="dp-brand-mark">DP</div>
          <div>
            <div className="dp-brand-title">Abandonos</div>
            <div className="dp-brand-sub">
              {MIN_DIAS}+ dias seguidos sem ponto e sem justificativa ·{" "}
              {user?.nome || "Usuário"}
            </div>
          </div>
        </div>
      </div>

      <AbaShell
        carregando={carregando}
        erro={erro}
        filtros={
          <>
            <div className="dp-busca">
              <Search size={14} />
              <input
                type="search"
                value={termo}
                onChange={(evento) => setTermo(evento.target.value)}
                placeholder="buscar por nome ou crachá…"
              />
            </div>

            {marcados.length > 0 && (
              <button
                type="button"
                className={`dp-chip-f${mostraNaoBate ? " on" : ""}`}
                onClick={() => setMostraNaoBate((v) => !v)}
                title="Quem cronicamente não bate ponto — fora da lista pra não poluir"
              >
                🚫 {marcados.length} não bate(m) ponto
                <span className="n">{mostraNaoBate ? "ocultar" : "mostrar"}</span>
              </button>
            )}

            <button type="button" className="dp-btn" onClick={recarregar}>
              <RefreshCw size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              Atualizar
            </button>
          </>
        }
        resumo={
          <>
            <b className="dp-num">{nPessoas}</b> pessoa(s), até{" "}
            <b className="dp-mono">{resultado.ate ? paraBR(resultado.ate) : "—"}</b> (último dia com
            ponto fechado){" "}
            <span className="dp-faint">
              · atestado/férias/DSR não contam · desligado não entra ·{" "}
              <span className="dp-num">{resultado.nDias}</span> dia(s) consolidado(s) nos últimos{" "}
              <span className="dp-num">{JANELA_DIAS}</span> · marcar/desmarcar fica registrado em{" "}
              <span className="dp-mono">{TABELA_AUDITORIA}</span> com o seu nome.
            </span>
            {truncado && (
              <>
                {" "}
                <span className="dp-pill danger" title="A janela foi cortada no teto de paginação">
                  leitura truncada — recarregue
                </span>
              </>
            )}
            {aviso && (
              <>
                {" "}
                <span className={`dp-pill ${aviso.tom}`}>{aviso.texto}</span>
              </>
            )}
          </>
        }
      >
        {visiveis.length === 0 ? (
          <div className="dp-viewbar">
            <div className="dp-vazio" style={{ flex: 1 }}>
              {marcados.length
                ? "Só sobraram os marcados como “não bate ponto”. 👍"
                : termo.trim()
                  ? "Ninguém bate com a busca."
                  : "Nenhum possível abandono no período consolidado. 👍"}
            </div>
          </div>
        ) : (
          <div className="dp-tabela-wrap">
            <table className="dp-tabela">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Sem ponto</th>
                  <th>Desde</th>
                  <th>Último ponto</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {visiveis.map((linha) => {
                  // app.js:6657 — 8+ dias é o corte visual da gravidade.
                  const grave = linha.diasSemPonto >= DIAS_GRAVE;
                  const classeLinha = linha.naoBate ? "" : grave ? "row-sem" : "row-sug";
                  return (
                    <tr
                      key={linha.cracha}
                      className={classeLinha}
                      style={linha.naoBate ? { opacity: 0.55 } : undefined}
                    >
                      <td>
                        <b>{linha.nome || "—"}</b>
                        <div className="dp-faint" style={{ fontSize: 12 }}>
                          <span className="dp-mono">{linha.cracha}</span> ·{" "}
                          {ROTULO_CATEGORIA[linha.categoria] || linha.categoria || "—"}
                          {linha.funcao ? ` · ${linha.funcao}` : ""}
                          {linha.monitorado ? " · 👁 monitorado" : ""}
                        </div>
                      </td>
                      <td>
                        <span className={`dp-pill ${linha.naoBate ? "mute" : grave ? "danger" : "warn"}`}>
                          <span className="dp-num">{linha.diasSemPonto}</span> dias
                        </span>
                      </td>
                      <td className="dp-mono">{linha.desde ? paraBR(linha.desde) : "—"}</td>
                      <td className="dp-mono">
                        {linha.ultimoPonto ? (
                          paraBR(linha.ultimoPonto)
                        ) : (
                          <span
                            className="dp-faint"
                            title="Nenhum dia com ponto dentro da janela consolidada"
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td>
                        {/* Os dois botões gravam: lista no `app_config` + linha na
                            trilha. `gravando` trava a linha inteira enquanto isso. */}
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="dp-btn"
                            disabled={!!gravando}
                            title={
                              linha.monitorado
                                ? "Tirar do acompanhamento (abandono_monitor)"
                                : "Acompanhar este caso (abandono_monitor) — não some da lista"
                            }
                            onClick={() =>
                              alternarMarca(linha, CHAVE_MONITOR, !linha.monitorado)
                            }
                          >
                            {gravando === `${CHAVE_MONITOR}|${linha.cracha}`
                              ? "gravando…"
                              : linha.monitorado
                                ? "👁 parar"
                                : "👁 acompanhar"}
                          </button>
                          <button
                            type="button"
                            className="dp-btn"
                            disabled={!!gravando}
                            title={
                              linha.naoBate
                                ? "Devolver para a lista de possíveis abandonos"
                                : "Quem cronicamente não bate ponto — sai da lista de abandonos"
                            }
                            onClick={() =>
                              alternarMarca(linha, CHAVE_NAO_BATE, !linha.naoBate)
                            }
                          >
                            {gravando === `${CHAVE_NAO_BATE}|${linha.cracha}`
                              ? "gravando…"
                              : linha.naoBate
                                ? "↩ voltar"
                                : "🚫 não bate ponto"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AbaShell>
    </div>
  );
}

// ============================================================================
// ONDE A MARCAÇÃO MORA, E POR QUE A GRAVAÇÃO É DESSE JEITO
//
// A marcação NÃO é uma coluna: é uma LISTA JSON de crachás guardada no
// `app_config` da base de PONTO (colunas `chave` / `valor`), sob duas chaves:
//
//     chave = "abandono_nao_bate"  →  valor = "[\"30061089\",\"30074512\"]"
//     chave = "abandono_monitor"   →  valor = idem (acompanhamento)
//
// É o mesmo lugar de onde a ferramenta desktop lê (main.py:7540 / 7522). Mudar
// de lugar — inclusive "melhorar" para uma tabela nova — CEGA a ferramenta: ela
// continuaria lendo o `app_config` e mostrando a lista antiga.
//
// ⚠ LEITURA-MODIFICAÇÃO-ESCRITA: não existe UPDATE parcial numa lista JSON — o
// upsert regrava a lista INTEIRA. Se a tela usasse a lista que carregou na
// abertura, duas abas (ou dois computadores) fariam cada uma o seu upsert e a
// última apagaria a marcação da outra, com 200 e sem nenhum aviso. Por isso
// `alternarMarca` RELÊ o `valor` no clique, imediatamente antes de gravar.
// Isso encurta a janela de corrida para o tempo de uma ida ao gateway, mas não
// a fecha: PostgREST não faz compare-and-set. Fechar de verdade pediria uma
// coluna de versão no `app_config` (e a ferramenta desktop teria de respeitá-la)
// — decisão que não cabe a esta tela. O que a tela garante é que uma perda
// dessas fica RASTREÁVEL: cada clique deixa a sua linha em `dp360_auditoria`,
// então dá para reconstruir quem marcou o quê e quando, mesmo que a lista
// tenha sido sobrescrita.
//
// AINDA VALE VALIDAR (não é código, é processo):
//  1. Conferir a lista contra o RH: nenhum desligado e nenhum afastado longo
//     pode estar sendo listado como abandono (a regra depende de o Transnet ter
//     o lançamento; lançamento atrasado = falso positivo).
//  2. Definir QUEM pode marcar. Hoje a tela é admin-only pelo `access.js`, mas
//     esconder alguém da lista de abandono é decisão de DP, não de TI. Com a
//     trilha, ao menos dá para responder "quem escondeu".
// ============================================================================
