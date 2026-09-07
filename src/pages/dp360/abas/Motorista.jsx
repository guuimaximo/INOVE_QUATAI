import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, UserRound } from "lucide-react";
import AbaShell from "./AbaShell";
import TabelaDP from "../TabelaDP";
import CartaoDoDia, {
  BotaoPontoConferido,
  Pilula,
  aplicarRealManual,
  fmtMin,
  marcacaoAusente,
} from "../CartaoDoDia";
import {
  jornadaLiquidaDoDia,
  mensagemBateuFora,
  mensagemInterno,
  mensagemPedirExclusao,
  mensagemRevisaoMotorista,
  rotaAvisoInterno,
} from "../comunicadoTransnet";
import { lerDP360, lerTudoDP360 } from "../../../services/dp360Api";
import { GARAGEM, dentroDoLocal, distanciaM, localConhecido } from "../regrasGps";

// Porte da tela "por motorista" do DP360 (Sistemas/PONTO: app/ui/app.js `viewMotorista`
// + `renderMot`, e app/main.py `get_pessoas_lista` / `get_pontos_pessoa`).
//
// A GRADE é só LEITURA: a regra de negócio (status_ponto, motivo, alvo_*, *_sug) já vem
// calculada pelas views do Athena e chega pronta em `ponto_diario` — a tela apenas
// apresenta.
//
// O DIA CLICADO ABRE O `../CartaoDoDia`, o MESMO pop-up da Revisão e da Gordura — é o
// que a ferramenta faz (app.js:6778 chama `pontoLinha` + `pontoDetalhe`, o mesmo
// `pontoDetalhe` da Revisão). O painel próprio desta aba acabou: fontes, sugestão, Real,
// Real manual, almoço, semana, GPS com mapa, linha do tempo do caso (com o balão do que
// foi mandado e o que o colaborador pediu) e as viagens do Citatti são todos de lá.
// Quem está lendo a vida de um motorista e vê um dia torto não precisa mais sair da
// tela e reachar data + categoria + pessoa na Revisão para cravar o Real.
//
// O QUE ESTA ABA PENDURA NO CARTÃO, por prop, sem tocar no arquivo dele:
//   · `selos`     — a SITUAÇÃO do dia (`tipo_dia`/feriado) e o `motivo` da view, que é
//                   o que esta aba sabe e o cartão não;
//   · `previaAviso` — a reconstrução da carta JÁ ENVIADA (o cartão não guarda texto:
//                   `ponto_caso` só tem o carimbo). Ver o comentário do `previaAviso`;
//   · `acoesRodape` — o ✓ Ponto conferido, o MESMO botão exportado que a Revisão usa.
// O ENVIO da ocorrência (📣) NÃO sai daqui: quem monta o CSV, decide os barrados e grava
// o caso é o `ModalComunicado`, que é de cada aba de origem. Sem `aoAvisar` o cartão
// simplesmente não desenha o botão.

/* ────────────────────────────── constantes portadas ────────────────────────────── */

// LOCAIS oficiais, raios e Haversine vêm do módulo `../regrasGps` (porte de
// app/main.py). Não duplicar a lista aqui: os quatro "PIV" saíram dela em 18/08 e
// uma segunda cópia é justamente como eles voltariam sem ninguém notar.

const DIAS_SEM = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const JANELA_PADRAO_DIAS = 30; // período inicial: fim − 30 dias (a base guarda ~70 dias)

// Teto de paginação do seletor de colaborador (o gateway devolve 1000 linhas por
// página). A leitura é a `ponto_diario` INTEIRA, sem filtro de data: ~70 dias × a
// garagem passa de 40 mil linhas (é a mesma conta do Abandonos). No teto o
// `lerTudoDP360` PARA — e parava em silêncio. Como a ordem é `date_ref.desc`, quem
// some primeiro é justamente quem só aparece nos dias mais ANTIGOS: o afastado, o
// desligado, o que parou de bater ponto — exatamente quem se vai procurar aqui.
// Por isso o corte agora é dito na tela, como o Abandonos já faz.
const TETO_PAGINAS = 60;
const LINHAS_POR_PAGINA = 1000;

/* ─────────────────────────────────── helpers ──────────────────────────────────── */

// Os booleanos do lake chegam como STRING "true"/"false". Comparar com === true dava
// sempre falso e escondia feriado.
const ehVerdade = (v) => v === true || String(v ?? "").trim().toLowerCase() === "true";

const soData = (v) => String(v ?? "").slice(0, 10);

/** "0410" → "04:10"; "410" → "04:10"; "04:10" → "04:10"; vazio → "". */
function fmtHora(valor) {
  const s = String(valor ?? "").trim();
  if (!s) return "";
  if (s.includes(":")) return s.slice(0, 5);
  const d = s.replace(/\D/g, "");
  if (d.length === 3) return `0${d[0]}:${d.slice(1)}`;
  if (d.length === 4) return `${d.slice(0, 2)}:${d.slice(2)}`;
  return "";
}

/** Minutos (pode passar de 1440 em turno que cruza a meia-noite) → "HH:MM". */
function min2hm(valor) {
  if (valor === null || valor === undefined || valor === "") return "";
  const n = Number(valor);
  if (!Number.isFinite(n)) return "";
  const m = ((Math.round(n) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Faixa "05:00 – 14:00" das colunas Operação e Escala. Devolve VAZIO quando as duas
 * pontas faltam: na grade, vazio é o que manda a linha para o fim da ordenação — um
 * "— – —" seria texto e subiria na frente de 04:10.
 */
function faixaHoras(ini, fim) {
  return ini || fim ? `${ini || "—"} – ${fim || "—"}` : "";
}

/** "2026-08-04" → "04/08/2026". */
function fmtData(iso) {
  const d = soData(iso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d || "—";
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

function diaSemana(iso) {
  const d = soData(iso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  const [y, m, dd] = d.split("-").map(Number);
  const dt = new Date(y, m - 1, dd);
  return Number.isNaN(dt.getTime()) ? "" : DIAS_SEM[dt.getDay()];
}

/** Soma dias SEM passar por toISOString (que devolve UTC e vira o dia seguinte à noite). */
function somarDias(iso, n) {
  const d = soData(iso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const [y, m, dd] = d.split("-").map(Number);
  const dt = new Date(y, m - 1, dd);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/* ────────────────────────────────── GPS ───────────────────────────────────────── */

// ATENÇÃO — RÉGUA DIFERENTE DA REVISÃO, DE PROPÓSITO.
// A grade "por motorista" do app original usa a régua SIMPLES: a batida vale se estiver
// a até 100 m de um LOCAL CONHECIDO (garagem/terminal/estação). Ela NÃO mede contra a
// posição operacional do veículo, e portanto não tem "não medido" nem regra de reserva —
// veja `get_pontos_pessoa` em app/main.py:7390-7403 ("mesma lógica do get_gps_flags" no
// comentário, mas o código de fato só usa `_local_conhecido` + `_local_dentro`).
// A régua completa (veículo 500 m, reserva, não medido) é a da Revisão, em `reguaLocal`.
// Aqui só trocamos o código duplicado pelas funções do módulo — a semântica da coluna
// GPS continua exatamente a mesma.
//
// ISTO É SÓ DA COLUNA DA GRADE. O pop-up do dia é o `../CartaoDoDia` e ele roda a régua
// COMPLETA por conta própria (`gpsAuto`: lê `ponto_gps` + `gps_carro` do crachá×dia e
// aplica `regrasGps`, com a reserva do INOVE ligando a tolerância de dia sem carro).
// Duas leituras, duas réguas — mas cada uma na tela em que o original a usa.

function fmtDistancia(metros) {
  const d = Number(metros) || 0;
  return d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d} m`;
}

/** Normaliza uma linha de `ponto_gps` já com o local conhecido resolvido. */
function analisarBatidaGps(linha) {
  const lat = Number(linha.latitude);
  const lon = Number(linha.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const perto = localConhecido(lat, lon);
  return {
    dia: soData(linha.date_ref),
    hora: String(linha.hora ?? "").slice(0, 5),
    local: perto?.nome || "",
    distLocal: perto?.distancia ?? null,
    dentro: !!perto && dentroDoLocal(perto.nome, perto.distancia),
    distGaragem: distanciaM(lat, lon, GARAGEM.lat, GARAGEM.lon),
  };
}

/** Agrega as batidas com GPS por dia: total, quantas fora, maior distância da garagem. */
function agregarGpsPorDia(linhas) {
  const mapa = {};
  for (const bruta of linhas) {
    const b = analisarBatidaGps(bruta);
    if (!b || !b.dia) continue;
    const acc = mapa[b.dia] || (mapa[b.dia] = { total: 0, fora: 0, dist: 0, hora: "" });
    acc.total += 1;
    if (!b.dentro) {
      acc.fora += 1;
      if (b.distGaragem > acc.dist) {
        acc.dist = b.distGaragem;
        acc.hora = b.hora;
      }
    }
  }
  return mapa;
}

/* ─────────────────────── cartão de ponto e situação do dia ────────────────────── */

const horaOuVazio = (v) => fmtHora(v);
const temHora = (v) => /^\d{1,2}:\d{2}$/.test(String(v || ""));
const temRegistro = (v) => /\b\d{1,2}:\d{2}\b/.test(String(v || ""));

/**
 * As 4 posições do cartão: entrada · saída almoço · volta almoço · saída.
 * Porte do `cartoesAviso().atual` do app antigo — reduzir só às pontas escondia batidas
 * existentes e produzia falso "Sem ponto".
 */
function cartaoAtual(x) {
  const bruto = String(x.batidas_limpas || x.depois || x.antes || "");
  const brutoQuatro = (bruto.match(/\b\d{1,2}:\d{2}\b/g) || []).slice(0, 4);
  const almocoLancado = [horaOuVazio(x.alvo_alm_saida), horaOuVazio(x.alvo_alm_volta)];

  // Se as duas únicas batidas são exatamente o almoço que o DP já lançou, elas NÃO são as
  // pontas do cartão: entrada e saída seguem vazias.
  const soAlmocoLancado =
    brutoQuatro.length === 2 &&
    almocoLancado.every(Boolean) &&
    brutoQuatro[0] === almocoLancado[0] &&
    brutoQuatro[1] === almocoLancado[1];
  if (soAlmocoLancado) return ["", brutoQuatro[0], brutoQuatro[1], ""];

  // `ponto_diario.saida` é a 4ª posição do cartão importado; em cartão com inserção ela
  // pode não ser a saída do dia. Lê pelas marcações tipadas (E/S) quando existirem.
  const marcacoes = [...String(x.todas_batidas || "").matchAll(/\b([ES])\s*(\d{1,2}:\d{2})/gi)].map(
    (m) => ({ tipo: m[1].toUpperCase(), hora: horaOuVazio(m[2]) }),
  );
  let tipado = [];
  const iEnt = marcacoes.findIndex((m) => m.tipo === "E");
  const iAlmSai = marcacoes.findIndex((m, i) => i > iEnt && m.tipo === "S");
  const iAlmVolta = marcacoes.findIndex((m, i) => i > iAlmSai && m.tipo === "E");
  const iSai = marcacoes.reduce((ult, m, i) => (i > iAlmVolta && m.tipo === "S" ? i : ult), -1);
  if (iEnt >= 0 && iSai >= 0) {
    const temAlmoco = iAlmSai >= 0 && iAlmVolta >= 0;
    tipado = [
      marcacoes[iEnt].hora,
      temAlmoco ? marcacoes[iAlmSai].hora : "",
      temAlmoco ? marcacoes[iAlmVolta].hora : "",
      marcacoes[iSai].hora,
    ];
  }

  const apurado = [x.entrada, x.saida_almoco, x.volta_almoco, x.saida].map(horaOuVazio);
  const atual = tipado[0] && tipado[3] ? tipado : apurado[0] && apurado[3] ? apurado : brutoQuatro;
  return [0, 1, 2, 3].map((i) => atual[i] || "");
}

/** A sugestão é o alvo canônico; `*_sug` só entra quando o alvo não foi publicado. */
function cartaoSugestao(x) {
  return [
    horaOuVazio(x.alvo_entrada || x.entrada_sug),
    horaOuVazio(x.alvo_alm_saida || x.almoco_saida_sug),
    horaOuVazio(x.alvo_alm_volta || x.almoco_volta_sug),
    horaOuVazio(x.alvo_saida || x.saida_sug),
  ];
}

function temPonto(x) {
  if (cartaoAtual(x).some(temHora)) return true;
  if ([x.todas_batidas, x.batidas_limpas, x.antes, x.depois].some(temRegistro)) return true;
  return [x.entrada, x.saida, x.saida_almoco, x.volta_almoco].some((h) => temHora(fmtHora(h)));
}

/**
 * Precedência da situação (não inverter):
 *  1. `tipo_dia`/`te_descricao_dia` preenchido → o texto do RH manda;
 *  2. `eh_feriado`;
 *  3. nenhuma batida → "Sem ponto";
 *  4. `status_ponto` — mas "SEM_PONTO" com batida no cartão vira "REVISAR": a tela não
 *     pode chamar de sem ponto só porque o status salvo ainda não foi reprocessado.
 */
function situacaoDoDia(x) {
  const td = String(x.tipo_dia ?? "").toUpperCase();
  const desc = String(x.te_descricao_dia ?? "").trim();
  if (td || desc) {
    const tom = /FALTA/.test(td)
      ? "falta"
      : /ATEST/.test(td)
        ? "atest"
        : /FERIAS|AFAST|LICEN|SUSPENS|INSS|MATERN|PATERN/.test(td)
          ? "afast"
          : /COMP/.test(td)
            ? "comp"
            : /FOLGA|DSR/.test(td)
              ? "folga"
              : /FERIADO/.test(td)
                ? "feriado"
                : "just";
    return { tom, texto: desc || td.replace(/_/g, " ") };
  }
  if (ehVerdade(x.eh_feriado)) return { tom: "feriado", texto: "Feriado" };
  if (!temPonto(x)) return { tom: "sem", texto: "Sem ponto" };
  const status = x.status_ponto === "SEM_PONTO" ? "REVISAR" : x.status_ponto || "REVISAR";
  return { tom: status === "OK" ? "ok" : "rev", texto: status };
}

// Cores da pílula por tom — as MESMAS da ferramenta (`.mot-tag` em app/ui/styles.css):
// ok verde, revisar/afastamento âmbar, sem ponto/falta vermelho, folga/compensação azul,
// feriado roxo, justificativa neutra.
const TONS = {
  ok: "ok",
  rev: "warn",
  falta: "danger",
  atest: "warn",
  afast: "warn",
  comp: "accent",
  folga: "accent",
  feriado: "res",
  just: "mute",
  sem: "danger",
};

// A linha inteira só é pintada quando pede atenção; o resto fica branco como no original.
// FIDELIDADE: a ferramenta original (renderMot) NAO pinta linha nesta tela — so o
// hover. O estado do dia ja e dito pela pilula da coluna Situacao. Pintar aqui foi
// uma "melhoria" que fazia a tela deixar de parecer a ferramenta.
const LINHA = {};

/* ────────────────────────── crachá: 7 ou 8 dígitos no lake ────────────────────── */

function variantesCracha(cracha) {
  const cr = String(cracha || "").trim();
  if (!cr) return [];
  const vs = new Set([cr, cr.replace(/^0+/, ""), cr.padStart(8, "0")]);
  return [...vs].filter((v) => /^[A-Za-z0-9_-]+$/.test(v));
}

const filtroCracha = (cracha) => `in.(${variantesCracha(cracha).join(",")})`;

/* ──────────────────────────── pedacinhos de interface ─────────────────────────── */

function Vazio() {
  return <span className="dp-faint">—</span>;
}

/** Cartão de 4 posições; `destaque[i]` marca a posição que a sugestão quer mudar. */
function LinhaCartao({ horas, destaque }) {
  if (!horas.some(Boolean)) return <Vazio />;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {horas.map((h, i) => (
        <span key={i} className={`dp-chip${destaque?.[i] ? " new" : h ? "" : " none"}`}>
          {h || "—"}
        </span>
      ))}
    </span>
  );
}

function PilulaSituacao({ situacao }) {
  return <span className={`dp-pill ${TONS[situacao.tom] || TONS.just}`}>{situacao.texto}</span>;
}

function PilulaGps({ gps }) {
  if (!gps || !gps.total) return <Vazio />;
  if (!gps.fora) {
    return (
      <span
        className="dp-pill ok"
        title={`Todas as ${gps.total} batidas em local conhecido (garagem/terminal).`}
      >
        ✓ local
      </span>
    );
  }
  const txt = fmtDistancia(gps.dist);
  return (
    <span
      className="dp-pill danger dp-num"
      title={`${gps.fora} de ${gps.total} batida(s) FORA de local conhecido. Mais longe: ${txt} da garagem${gps.hora ? ` às ${gps.hora}` : ""}.`}
    >
      📍 {gps.fora}/{gps.total} · {txt}
    </span>
  );
}

/* ───────────── o que ESTA aba pendura no cabeçalho do CartaoDoDia ─────────────
   O cartão mostra o `status_ponto` e o diagnóstico do MOTOR (fantasma, cartão que não
   fecha). O que ele não tem é o que só esta grade lê: `tipo_dia`/`te_descricao_dia`
   (FOLGA, ATESTADO, FÉRIAS, AFASTAMENTO…) e `eh_feriado` — e é justamente isso que
   explica um dia vazio na vida de uma pessoa. Sem a pílula, o cartão de um dia de
   férias abre parecendo um dia de trabalho sem ponto.

   Duas pílulas no máximo, com o MESMO texto e o MESMO tom da coluna Situação da grade
   (`situacaoDoDia` + `TONS`, nada recalculado aqui):
     · a SITUAÇÃO, só quando diz algo diferente do `status_ponto` que o cartão já
       mostra — repetir "REVISAR" ao lado de "REVISAR" é ruído;
     · o MOTIVO da view, encurtado como na grade e inteiro no `title`. */
function SelosDoDia({ dia }) {
  const situacao = situacaoDoDia(dia);
  const motivo = String(dia.motivo ?? "").trim();
  const repetido = situacao.texto === String(dia.status_ponto ?? "").trim();
  return (
    <>
      {!repetido && (
        <Pilula texto={situacao.texto} tom={TONS[situacao.tom] || TONS.just} titulo={motivo} />
      )}
      {dia.status_ponto === "REVISAR" && motivo && (
        <Pilula texto={motivo.split(" (")[0]} tom="mute" titulo={motivo} />
      )}
    </>
  );
}

/* ─────────────────────────────────── a aba ────────────────────────────────────── */

export default function Motorista() {
  const [pessoas, setPessoas] = useState([]);
  const [faixa, setFaixa] = useState({ min: "", max: "" });
  const [carregandoBase, setCarregandoBase] = useState(true);
  const [erro, setErro] = useState("");

  const [busca, setBusca] = useState("");
  const [cracha, setCracha] = useState("");
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");

  const [dias, setDias] = useState([]);
  const [gpsBrutos, setGpsBrutos] = useState([]);
  const [casos, setCasos] = useState([]);
  // O Real manual do DP não vem na `ponto_diario`: é tabela à parte, e quem junta as
  // duas é o overlay `aplicarRealManual` — a MESMA leitura que a Revisão e a Gordura
  // fazem antes de abrir o cartão. Sem ela o bloco "4 · Real manual do DP" abriria
  // VAZIO num dia já cravado, e quem estivesse olhando cravaria por cima.
  const [reaisManuais, setReaisManuais] = useState([]);
  const [carregandoDias, setCarregandoDias] = useState(false);
  const [diaAberto, setDiaAberto] = useState("");
  const [recarga, setRecarga] = useState(0);
  // O seletor de colaborador bateu no teto de paginação? (ver TETO_PAGINAS)
  const [truncado, setTruncado] = useState(false);

  /* 1) lista de pessoas (distinct por crachá em `ponto_diario`) + faixa de datas. */
  useEffect(() => {
    let ativo = true;
    setCarregandoBase(true);
    setErro("");

    (async () => {
      // A faixa vem de duas consultas de 1 linha — barato e exato, sem varrer a tabela.
      const [maisNova, maisAntiga] = await Promise.all([
        lerDP360("ponto_diario", { colunas: "date_ref", ordem: "date_ref.desc", limite: 1 }),
        lerDP360("ponto_diario", { colunas: "date_ref", ordem: "date_ref.asc", limite: 1 }),
      ]);
      const dmax = soData(maisNova?.[0]?.date_ref);
      const dmin = soData(maisAntiga?.[0]?.date_ref);

      // Só as colunas leves do seletor: `ponto_diario` tem uma linha por pessoa por dia e
      // a janela é de ~70 dias — trazer o cartão inteiro aqui seria dezenas de MB.
      const linhas = await lerTudoDP360(
        "ponto_diario",
        { colunas: "cracha,nm_funcionario,categoria", ordem: "date_ref.desc,cracha" },
        TETO_PAGINAS,
      );

      if (!ativo) return;
      // O TETO NÃO PODE PASSAR CALADO. `lerTudoDP360` para na última página e devolve o
      // que deu — sem sinal, o seletor simplesmente não tem a pessoa e quem procura
      // conclui que ela não existe na base. Mesmo aviso do Abandonos.
      setTruncado(linhas.length >= TETO_PAGINAS * LINHAS_POR_PAGINA);
      const vistos = new Map();
      for (const l of linhas) {
        const cr = String(l.cracha ?? "").trim();
        if (!cr || vistos.has(cr)) continue;
        vistos.set(cr, {
          cracha: cr,
          nome: String(l.nm_funcionario ?? "").trim(),
          categoria: String(l.categoria ?? "").toUpperCase(),
        });
      }
      const lista = [...vistos.values()].sort((a, b) =>
        (a.nome || "").localeCompare(b.nome || "", "pt-BR"),
      );
      setPessoas(lista);
      setFaixa({ min: dmin, max: dmax });
      const base = dmax || dmin;
      if (base) {
        setFim((v) => v || base);
        setIni((v) => {
          if (v) return v;
          const trinta = somarDias(base, -JANELA_PADRAO_DIAS);
          return dmin && trinta < dmin ? dmin : trinta;
        });
      }
    })()
      .catch((falha) => {
        if (ativo) setErro(falha?.message || "Falha ao consultar a base DP360.");
      })
      .finally(() => {
        if (ativo) setCarregandoBase(false);
      });

    return () => {
      ativo = false;
    };
  }, [recarga]);

  const pessoa = useMemo(
    () => pessoas.find((p) => p.cracha === cracha) || null,
    [pessoas, cracha],
  );

  /** Resolve o texto digitado (nome, crachá ou "nome · crachá") num crachá da lista. */
  const resolverCracha = useCallback(
    (texto) => {
      const t = String(texto || "").trim();
      if (!t) return "";
      const numero = t.match(/([0-9]{3,})\s*$/);
      if (numero && pessoas.some((p) => p.cracha === numero[1])) return numero[1];
      const achado =
        pessoas.find((p) => `${p.nome} · ${p.cracha}` === t) ||
        pessoas.find((p) => p.cracha === t) ||
        pessoas.find((p) => (p.nome || "").toLowerCase() === t.toLowerCase());
      return achado ? achado.cracha : "";
    },
    [pessoas],
  );

  // Só troca quando o texto RESOLVE numa pessoa da lista (ou quando o campo é limpo).
  // Reagir a cada tecla derrubaria a tabela no meio da digitação de um nome.
  useEffect(() => {
    if (!busca.trim()) {
      if (cracha) setCracha("");
      return;
    }
    const resolvido = resolverCracha(busca);
    if (resolvido && resolvido !== cracha) setCracha(resolvido);
  }, [busca, resolverCracha, cracha]);

  /* 2) dias do período + GPS + casos do colaborador escolhido. */
  useEffect(() => {
    if (!cracha || !ini || !fim) {
      setDias([]);
      setGpsBrutos([]);
      setCasos([]);
      setReaisManuais([]);
      return undefined;
    }
    let ativo = true;
    setCarregandoDias(true);
    setErro("");
    const alvo = filtroCracha(cracha);
    // O gateway indexa os filtros por coluna, então `date_ref` só aceita UM operador.
    // Corta o fim no cliente — a janela inteira da base tem ~70 dias.
    const dentroDoPeriodo = (linha) => {
      const d = soData(linha.date_ref);
      return d && d >= ini && d <= fim;
    };

    Promise.all([
      lerTudoDP360("ponto_diario", {
        filtros: { cracha: alvo, date_ref: `gte.${ini}` },
        ordem: "date_ref.asc",
      }),
      lerTudoDP360("ponto_gps", {
        colunas: "date_ref,hora,latitude,longitude",
        filtros: { cracha: alvo, date_ref: `gte.${ini}`, latitude: "not.is.null" },
        ordem: "date_ref.asc,hora.asc",
      }),
      lerTudoDP360("ponto_caso", {
        filtros: { cracha: alvo, date_ref: `gte.${ini}` },
        ordem: "date_ref.asc",
      }),
      // O Real manual do DP, para o overlay do cartão. DEGRADA SEM DERRUBAR: é a única
      // leitura NOVA desta aba e, se o gateway recusar a tabela ou a coluna, um 400
      // dentro do `Promise.all` mataria a aba inteira (o histórico da pessoa) por causa
      // de um bloco do pop-up. Sem ela o cartão abre sem o Real cravado — pior que ter,
      // melhor que aba morta.
      lerTudoDP360("ponto_real_manual", {
        filtros: { cracha: alvo, date_ref: `gte.${ini}` },
      }).catch(() => []),
    ])
      .then(([linhasDia, linhasGps, linhasCaso, linhasRm]) => {
        if (!ativo) return;
        setDias(
          linhasDia
            .filter(dentroDoPeriodo)
            .sort((a, b) => soData(a.date_ref).localeCompare(soData(b.date_ref))),
        );
        setGpsBrutos(linhasGps.filter(dentroDoPeriodo));
        setCasos(linhasCaso.filter(dentroDoPeriodo));
        setReaisManuais(linhasRm.filter(dentroDoPeriodo));
      })
      .catch((falha) => {
        if (!ativo) return;
        setErro(falha?.message || "Falha ao consultar a base DP360.");
        setDias([]);
        setGpsBrutos([]);
        setCasos([]);
        setReaisManuais([]);
      })
      .finally(() => {
        if (ativo) setCarregandoDias(false);
      });

    return () => {
      ativo = false;
    };
  }, [cracha, ini, fim, recarga]);

  const gpsPorDia = useMemo(() => agregarGpsPorDia(gpsBrutos), [gpsBrutos]);

  const realManualPorDia = useMemo(() => {
    const mapa = {};
    for (const rm of reaisManuais) {
      const d = soData(rm.date_ref);
      if (d) mapa[d] = rm;
    }
    return mapa;
  }, [reaisManuais]);

  const casoPorDia = useMemo(() => {
    const mapa = {};
    for (const c of casos) {
      const d = soData(c.date_ref);
      if (d) mapa[d] = c;
    }
    return mapa;
  }, [casos]);

  const contadores = useMemo(() => {
    const c = { total: dias.length, ponto: 0, folga: 0, afast: 0, sem: 0 };
    for (const dia of dias) {
      const { tom } = situacaoDoDia(dia);
      if (tom === "ok" || tom === "rev") c.ponto += 1;
      else if (tom === "folga" || tom === "comp" || tom === "feriado") c.folga += 1;
      else if (tom === "afast" || tom === "atest") c.afast += 1;
      else if (tom === "sem" || tom === "falta") c.sem += 1;
    }
    return c;
  }, [dias]);

  const diaSelecionado = useMemo(
    () => dias.find((d) => soData(d.date_ref) === diaAberto) || null,
    [dias, diaAberto],
  );

  const casoDoDia = casoPorDia[diaAberto] || null;

  /* ---- a linha que vai para o cartão ----
     O overlay do Real manual é aplicado AQUI, e não em `dias`: a GRADE continua
     mostrando a `ponto_diario` crua, exatamente como mostrava antes desta mudança.
     (Consequência conhecida e deixada de propósito: num dia com Real cravado, a coluna
     Sugestão da grade segue mostrando a sugestão da view enquanto o cartão mostra o
     Real. Corrigir isso é mexer no que a aba mostra sobre a pessoa — decisão do dono,
     não desta mudança.) */
  const linhaDoCartao = useMemo(
    () =>
      diaSelecionado
        ? aplicarRealManual(diaSelecionado, realManualPorDia[diaAberto] || null)
        : null,
    [diaSelecionado, realManualPorDia, diaAberto],
  );

  /* ---- releitura de UM dia depois de o cartão gravar ----
     Mesma disciplina da Revisão (`recarregarLinha`): nada de estado otimista — relê a
     `ponto_diario` CRUA, o `ponto_real_manual` e o `ponto_caso` daquele crachá×dia e
     troca as três coleções. A linha crua é o que permite DESFAZER o overlay quando o
     Real manual é apagado; reaproveitar a linha já sobrescrita deixaria `entrada_sug`/
     `alvo_*` com o valor antigo do DP. Como `diaSelecionado` sai de `dias`, o cartão
     aberto recebe a linha nova sozinho. */
  const recarregarDia = useCallback(async (crachaLinha, dia) => {
    const filtros = { cracha: filtroCracha(crachaLinha), date_ref: `eq.${dia}` };
    const [diario, rms, listaCasos] = await Promise.all([
      lerDP360("ponto_diario", { filtros, limite: 5 }),
      lerDP360("ponto_real_manual", { filtros, limite: 5 }).catch(() => []),
      lerDP360("ponto_caso", { filtros, limite: 5 }),
    ]);
    const nova = diario?.[0] || null;
    if (nova) setDias((ls) => ls.map((l) => (soData(l.date_ref) === dia ? nova : l)));
    const trocar = (lista, achado) => {
      const outros = lista.filter((x) => soData(x.date_ref) !== dia);
      return achado ? [...outros, achado] : outros;
    };
    setReaisManuais((ls) => trocar(ls, rms?.[0] || null));
    setCasos((ls) => trocar(ls, listaCasos?.[0] || null));
  }, []);

  /* ---- A CARTA QUE JÁ SAIU, no balão da linha do tempo do cartão ----
     app.js:5084-5091: aberto o dia, se há aviso enviado o balão mostra "o que mandamos".
     O texto tem de ser RECONSTRUÍDO — o Transnet não devolve a mensagem e o `ponto_caso`
     guarda só o carimbo. Quem diz qual modelo saiu é o `tipo`/`origem` do caso, gravados
     NO ENVIO e congelados (`marcarReavisos`), nunca a leitura de hoje: um dia já
     corrigido mostraria o texto errado.

     SÓ RECONSTRUÇÃO, NUNCA PRÉVIA (a Revisão faz as duas). Esta aba não envia nada — sem
     `aoAvisar` não há botão 📣 — e uma prévia de "o que vai sair" prometeria um envio que
     não existe aqui.

     A MONTAGEM DA CARTA NÃO É REESCRITA: são as MESMAS funções de `../comunicadoTransnet`
     que o disparo usa, e o modelo continua saindo do `app_config` dentro do cartão. O que
     está duplicado da Revisão é o ROTEAMENTO (o `if (enviado)` dela) — só porque ele mora
     dentro do componente dela e este arquivo é o único que esta mudança pode tocar. O
     lugar dele é `comunicadoTransnet`, como um `previaDoCasoEnviado(linha, caso, gps)`
     compartilhado pelas três abas.

     O QUE NÃO DÁ PARA RECONSTRUIR AQUI: a carta da GORDURA (`origem='gordura'`). Ela é
     montada por `mensagemGordura`, que vive dentro da aba Gordura, não é exportada e lê a
     linha de `ponto_gordura` com as quatro camadas aplicadas — que esta aba não carrega.
     Copiá-la seria a segunda montagem da mesma carta, exatamente o erro que o cartão
     compartilhado veio consertar. Nesses dias o balão fica vazio, como já ficava. */
  const previaAviso = useMemo(() => {
    const linha = linhaDoCartao;
    if (!linha || !String(casoDoDia?.aviso_enviado_em ?? "").trim()) return null;
    if (String(casoDoDia.origem ?? "").trim().toLowerCase() === "gordura") return null;

    const tipo = String(casoDoDia.tipo ?? "").trim().toLowerCase();
    const categoria = String(linha.categoria || pessoa?.categoria || "").toUpperCase();
    const ehInterno = categoria.startsWith("INTERNO") || categoria.startsWith("APREND");

    if (tipo === "fora") {
      const gps = gpsPorDia[diaAberto];
      if (!gps?.fora) return null;
      return {
        chave: "aviso_fora",
        rotulo: "avisar que bateu fora",
        // `mensagemBateuFora` lê o resumo da Revisão (`resumoGps`): a batida mais
        // distante e quantas ficaram fora. Aqui o resumo é o da régua SIMPLES desta aba,
        // que mede da GARAGEM — o mesmo número que a Revisão usa quando o veículo não
        // tem âncora medida, e o mesmo que o modelo oficial escreve ("a {DISTANCIA} da
        // garagem"). Onde havia âncora, a carta que saiu trazia a distância do veículo:
        // o pedido é o mesmo, o número pode divergir.
        montar: (tpl) =>
          mensagemBateuFora(tpl, linha, {
            fora: gps.fora,
            maiorDistancia: gps.dist,
            horaMaisLonge: gps.hora,
          }),
      };
    }

    if (tipo === "exclusao") {
      return {
        chave: "pedir_exclusao",
        rotulo: "pedir exclusão da batida",
        montar: (tpl) => mensagemPedirExclusao(tpl, linha),
      };
    }

    if (ehInterno && ["almoco", "curta", "incompleto"].includes(tipo)) {
      // {DIVERGENCIA}/{JORNADA} recebem o mesmo valor (main.py `enviar_aviso_interno`).
      // No modelo "curta" ele é a jornada líquida DO DIA — que é o que `rotaAvisoInterno`
      // devolve nesse ramo, e sai daqui pelas mesmas duas funções exportadas. Nos outros
      // dois é a frase do que falta, e ela só vale se a rota de hoje ainda é a mesma que
      // foi avisada; se mudou, o modelo vai sem a frase em vez de ir com a frase errada.
      const rota = rotaAvisoInterno(linha, null);
      const divergencia =
        tipo === "curta"
          ? fmtMin(jornadaLiquidaDoDia(linha))
          : rota.modelo === tipo
            ? rota.divergencia
            : "";
      return {
        chave: `interno_${tipo}`,
        rotulo: "aviso de interno/aprendiz",
        montar: (tpl) => mensagemInterno(tpl, linha, divergencia),
      };
    }

    // Cerco/registro incompleto de motorista. A ponta cobrada é a CONGELADA no caso; só
    // quando ela não foi gravada é que vale a leitura de hoje (`marcacaoAusente`, a
    // função exportada do cartão — a mesma que a Revisão usa).
    const ponta = String(casoDoDia.ponta ?? "").trim().toLowerCase();
    const falta =
      ponta === "ambos"
        ? "ENTRADA E SAÍDA"
        : ponta === "entrada"
          ? "ENTRADA"
          : ponta === "saida"
            ? "SAÍDA"
            : marcacaoAusente(linha);
    if (!falta) return null;
    return {
      chave: "ocorrencia_motorista",
      rotulo: "enviar ocorrência",
      montar: (tpl) => mensagemRevisaoMotorista(tpl, linha, falta),
    };
  }, [linhaDoCartao, casoDoDia, pessoa, gpsPorDia, diaAberto]);

  /* ─────────────────────────── colunas da grade ───────────────────────────
     MESMAS colunas, MESMA ordem e MESMO conteúdo de célula da tabela que estava
     escrita à mão aqui. A divisão de trabalho é a da TabelaDP:
       · `valor` é o que ORDENA e o que vai para o CSV — sempre dado (data, hora,
         número, texto), nunca JSX; ordenar "GPS" pelo chip pintado ordenaria pelo
         emoji, e "Ponto batido" pelo elemento React;
       · `render` é só a pinta da célula (chips, pílulas, negrito).
     A grade só ordena: o filtro de pessoa e o período seguem na barra da aba.     */
  const colunas = useMemo(
    () => [
      {
        id: "data",
        titulo: "Data",
        classe: "dp-num",
        largura: 120,
        valor: (d) => fmtData(soData(d.date_ref)),
        render: (d) => <b>{fmtData(soData(d.date_ref))}</b>,
      },
      {
        id: "dia",
        titulo: "Dia",
        classe: "dp-muted",
        largura: 110,
        valor: (d) => diaSemana(soData(d.date_ref)),
      },
      {
        id: "ponto",
        titulo: "Ponto batido",
        largura: 250,
        // Só as posições preenchidas, em HH:MM zero-padded: ordena pela entrada e o
        // CSV sai com o cartão cru em vez dos chips.
        valor: (d) => cartaoAtual(d).filter(Boolean).join(" "),
        render: (d) => <LinhaCartao horas={cartaoAtual(d)} />,
      },
      {
        id: "jornada",
        titulo: "Jornada",
        classe: "dp-num",
        largura: 100,
        valor: (d) => d.jornada_horas || "", // "10h09" — a grade já sabe ordenar
        render: (d) => d.jornada_horas || <Vazio />,
      },
      {
        id: "operacao",
        titulo: "Operação",
        classe: "dp-num",
        largura: 150,
        valor: (d) => faixaHoras(min2hm(d.operacao_ini_min), min2hm(d.operacao_fim_min)),
        render: (d) =>
          faixaHoras(min2hm(d.operacao_ini_min), min2hm(d.operacao_fim_min)) || <Vazio />,
      },
      {
        id: "escala",
        titulo: "Escala",
        classe: "dp-num",
        largura: 150,
        valor: (d) =>
          faixaHoras(
            fmtHora(d.programado_entrada || d.esc_entrada),
            fmtHora(d.programado_saida || d.esc_saida),
          ),
        render: (d) =>
          faixaHoras(
            fmtHora(d.programado_entrada || d.esc_entrada),
            fmtHora(d.programado_saida || d.esc_saida),
          ) || <Vazio />,
      },
      {
        id: "sugestao",
        titulo: "Sugestão",
        largura: 250,
        valor: (d) => cartaoSugestao(d).filter(Boolean).join(" "),
        render: (d) => {
          const atual = cartaoAtual(d);
          const sugestao = cartaoSugestao(d);
          if (!sugestao.some(Boolean)) return <Vazio />;
          return (
            <LinhaCartao
              horas={sugestao}
              destaque={sugestao.map((v, i) => !!v && v !== atual[i])}
            />
          );
        },
      },
      {
        id: "gps",
        titulo: "📍 GPS",
        largura: 180,
        // NÚMERO, não o texto do chip: a maior distância da garagem entre as batidas
        // FORA de local conhecido (0 = todas dentro, vazio = nenhuma batida com GPS).
        // Ordenar "📍 2/5 · 1.2 km" como texto ordenaria pelo 2 e misturaria m com km.
        valor: (d) => {
          const gps = gpsPorDia[soData(d.date_ref)];
          if (!gps || !gps.total) return "";
          return gps.fora ? gps.dist : 0;
        },
        render: (d) => <PilulaGps gps={gpsPorDia[soData(d.date_ref)]} />,
      },
      {
        id: "situacao",
        titulo: "Situação",
        largura: 250,
        valor: (d) => situacaoDoDia(d).texto,
        render: (d) => (
          <>
            <PilulaSituacao situacao={situacaoDoDia(d)} />
            {d.status_ponto === "REVISAR" && d.motivo && (
              <div
                className="dp-faint"
                style={{
                  fontSize: 11,
                  marginTop: 2,
                  maxWidth: 220,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={String(d.motivo)}
              >
                {String(d.motivo).split(" (")[0]}
              </div>
            )}
          </>
        ),
      },
    ],
    [gpsPorDia],
  );

  // Barra de filtros no formato da ferramenta: pessoa + "de … até …" + recarregar.
  // Os campos herdam o estilo de `.dp-viewbar input` — nada de classe visual aqui.
  const filtros = (
    <>
      <span className="dp-faint" aria-hidden="true" style={{ display: "inline-flex" }}>
        <UserRound size={15} />
      </span>
      <input
        id="dp360-mot-pessoa"
        list="dp360-mot-lista"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        autoComplete="off"
        placeholder="Nome ou crachá…"
        aria-label="Colaborador"
        style={{ flex: "1 1 240px", minWidth: 200, maxWidth: 420 }}
      />
      <datalist id="dp360-mot-lista">
        {pessoas.map((p) => (
          <option key={p.cracha} value={`${p.nome} · ${p.cracha}`} />
        ))}
      </datalist>

      <label className="dp-muted" htmlFor="dp360-mot-ini">
        De
      </label>
      <input
        id="dp360-mot-ini"
        type="date"
        value={ini}
        min={faixa.min || undefined}
        max={faixa.max || undefined}
        onChange={(e) => setIni(e.target.value)}
      />
      <label className="dp-muted" htmlFor="dp360-mot-fim">
        Até
      </label>
      <input
        id="dp360-mot-fim"
        type="date"
        value={fim}
        min={faixa.min || undefined}
        max={faixa.max || undefined}
        onChange={(e) => setFim(e.target.value)}
      />

      <button
        type="button"
        className="dp-btn"
        onClick={() => setRecarga((n) => n + 1)}
        style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <RefreshCw size={14} /> Recarregar
      </button>
    </>
  );

  const resumo = (
    <>
      <div>
        Histórico individual dia a dia: ponto batido, escala, operação, sugestão, GPS e a trilha
        do caso. Clique no dia para abrir o cartão dele — o mesmo da Revisão.
        {pessoa ? (
          <>
            {" — "}
            <b>{pessoa.nome}</b> · crachá <span className="dp-num">{pessoa.cracha}</span>
            {pessoa.categoria ? ` · ${pessoa.categoria}` : ""}
          </>
        ) : null}
        {/* SUMIR GENTE DO SELETOR EM SILÊNCIO É PIOR QUE DEMORAR. */}
        {truncado && (
          <>
            {" "}
            <span
              className="dp-pill danger"
              title="A leitura do seletor parou no teto de paginação — pode haver colaborador de fora da lista, em geral quem só aparece nos dias mais antigos. Recarregue ou estreite o período."
            >
              lista de colaboradores truncada — recarregue
            </span>
          </>
        )}
      </div>
      {!!dias.length && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0 2px" }}>
          <span className="dp-pill mute dp-num">{contadores.total} dias</span>
          <span className="dp-pill ok dp-num">{contadores.ponto} c/ ponto</span>
          <span className="dp-pill accent dp-num">{contadores.folga} folga/feriado</span>
          <span className="dp-pill warn dp-num">{contadores.afast} afast/atest</span>
          <span className="dp-pill danger dp-num">{contadores.sem} sem ponto/falta</span>
        </div>
      )}
    </>
  );

  // Sem colaborador escolhido não há grade nenhuma a mostrar (nem o ⚙/CSV dela): o
  // convite ocupa a área inteira, como antes. "Carregando" e "nenhum registro" passaram
  // a ser os estados da própria TabelaDP, com o MESMO texto de sempre.
  const aviso = !cracha ? "Selecione um colaborador para ver os pontos do período." : "";

  return (
    <AbaShell filtros={filtros} resumo={resumo} carregando={carregandoBase} erro={erro}>
      {aviso ? (
        <div className="dp-muted" style={{ textAlign: "center", padding: "56px 20px" }}>
          {aviso}
        </div>
      ) : (
        <TabelaDP
          chave="mot"
          colunas={colunas}
          linhas={dias}
          idLinha={(dia) => soData(dia.date_ref)}
          classeLinha={(dia) => LINHA[situacaoDoDia(dia).tom] || ""}
          aoClicarLinha={(dia) => setDiaAberto(soData(dia.date_ref))}
          nomeCsv={`motorista_${pessoa?.cracha || cracha}_${ini}_a_${fim}`}
          carregando={carregandoDias}
          mensagemCarregando="Carregando os dias do período…"
          vazio="Nenhum registro nesse período para esse colaborador."
        />
      )}

      {/* O CARTÃO DO DIA é o compartilhado (`../CartaoDoDia`) — o MESMO que a Revisão e
          a Gordura abrem, como na ferramenta (app.js:6778). Ele traz de graça a semana,
          as fontes, o Real manual, o GPS com a régua completa, as viagens do Citatti e a
          linha do tempo do caso, onde vivem "o que ele pediu" (lido lá dentro, direto da
          `ponto_ajustes_app`) e o balão da carta. */}
      {linhaDoCartao && (
        <CartaoDoDia
          linha={linhaDoCartao}
          caso={casoDoDia}
          // Esta aba não carrega GPS por dia com a régua da Revisão (a coluna da grade
          // usa a régua simples, de propósito). Mesmo caso da Gordura: o cartão lê
          // `ponto_gps`/`gps_carro` deste crachá×dia e roda `regrasGps` sozinho.
          gpsAuto
          aoFechar={() => setDiaAberto("")}
          aoRecarregar={recarregarDia}
          previaAviso={previaAviso}
          // Sem `aoAvisar` não há botão 📣; este texto é o que a linha do tempo mostra no
          // lugar da prévia, e ele precisa dizer a verdade desta aba — não "nada a pedir".
          impedimentoAviso="O comunicado não sai desta aba: o envio é da Revisão (motorista/interno) ou da Gordura."
          selos={<SelosDoDia dia={linhaDoCartao} />}
          acoesRodape={
            <BotaoPontoConferido
              linha={linhaDoCartao}
              caso={casoDoDia}
              aoRecarregar={recarregarDia}
            />
          }
          rodapeInfo={
            <>
              <b>Real manual</b> e <b>✓ Ponto conferido</b> ficam na base do DP e podem ser
              desfeitos. O <b>envio da ocorrência</b> não sai daqui: ele é da Revisão
              (motorista/interno) ou da Gordura.
            </>
          }
        />
      )}
    </AbaShell>
  );
}
