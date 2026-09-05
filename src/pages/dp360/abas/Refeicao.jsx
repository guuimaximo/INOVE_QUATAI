import { useCallback, useEffect, useMemo, useState } from "react";
import { Coffee, Download, Info, RefreshCw, Search, X } from "lucide-react";
import AbaShell from "./AbaShell";
import { lerDP360, lerTudoDP360 } from "../../../services/dp360Api";

/* ═══════════════════════════════════════════════════════════════════════════
   Refeição (Passo 1 do DP360)

   Fonte única desta aba: a tabela `ponto_intervalo` — snapshot da view
   `vw_ponto_intervalo_motorista_diario` (Athena). A REGRA de negócio é da view;
   a tela só a exibe. Nada é gravado nesta fase.

   Régua (constantes espelhadas da view e de ferramenta/simulador.py — mexeu
   aqui, confira lá):
     · 27 min  → piso do que conta como refeição
     · 360 min → jornada (medida pelo Citatti) que dispensa intervalo
     · 10 min  → tolerância entre o cartão e a sugestão, comparando SÓ o início
     · 30 min  → janela fixa que a importação grava
   ═══════════════════════════════════════════════════════════════════════════ */

const MIN_ALMOCO = 27;
const JORNADA_EXIGE_ALMOCO = 360;
const TOLERANCIA_TRANSNET_MIN = 10;
const IMPORTACAO_JANELA_MIN = 30;

// Teto de linhas por chamada aceito pelo gateway (supabase/functions/dp360-api).
const PASSO_DATAS = 5000;

/* ─────────────────────────── formatação ─────────────────────────── */

const num = (valor) => {
  const n = parseFloat(valor);
  return Number.isNaN(n) ? null : n;
};

// A view entrega `data_ref` em ISO. No app antigo isso vazava cru para a tela.
function fmtData(valor) {
  const iso = String(valor ?? "").slice(0, 10);
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!partes) return valor ? String(valor) : "—";
  return `${partes[3]}/${partes[2]}/${partes[1]}`;
}

// Minutos → "7h32" (jornada é sempre lida em horas pelo DP).
function fmtMin(valor) {
  const n = num(valor);
  if (n == null || n <= 0) return "—";
  const total = Math.round(n);
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, "0")}`;
}

const fmtDur = (valor) => {
  const n = num(valor);
  return n == null ? "—" : `${Math.round(n)} min`;
};

const fmtHora = (valor) => {
  const texto = String(valor ?? "").trim();
  return texto || "—";
};

const semAcento = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/* ─────────────────────── regra dos 27 minutos ───────────────────────
   Mesma de ferramenta/simulador.py::almoco_da_refeicao e de app.js::almocoRef.
   O CITATTI é a fonte principal. Abaixo de 27 min ele não pegou a refeição,
   pegou uma parada curta — aí vale o SST, que costuma trazer a janela certa
   (às vezes horas depois). Se nenhuma das duas alcança o piso, mostra o Citatti
   mesmo curto: vale o que a pessoa fez. */
function almocoRef(linha) {
  const citatti = num(linha.sugestao_duracao_min);
  const sst = num(linha.sugestao_sst_duracao_min);

  if (citatti != null && citatti >= MIN_ALMOCO) {
    return {
      ini: linha.sugestao_inicio,
      fim: linha.sugestao_fim,
      min: citatti,
      origem: "Citatti",
    };
  }
  if (sst != null && sst >= MIN_ALMOCO) {
    return {
      ini: linha.sugestao_sst_inicio,
      fim: linha.sugestao_sst_fim,
      min: sst,
      origem: "SST",
      detalhe:
        citatti == null
          ? "Sem Citatti nesse dia — usando SST"
          : `Citatti deu ${Math.round(citatti)} min (< ${MIN_ALMOCO}) — usando SST`,
    };
  }
  if (citatti != null) {
    return {
      ini: linha.sugestao_inicio,
      fim: linha.sugestao_fim,
      min: citatti,
      origem: "Citatti",
      detalhe: `Abaixo de ${MIN_ALMOCO} min e o SST também não alcança — vale o que ele fez`,
    };
  }
  return { ini: "", fim: "", min: null, origem: "" };
}

/* ─────────────────────────── status ───────────────────────────
   `status_almoco` vem da view. "DIVERGENTE" chega como
   "DIVERGENTE (transnet x sugestao)" — o casamento é por SUBSTRING. */
function chaveStatus(status) {
  const texto = String(status ?? "");
  if (texto.includes("DIVERGENTE")) return "DIV";
  return { SUGESTAO: "SUG", ABAIXO_27MIN: "AB", OK: "OK" }[texto] || "OUT";
}

const ESTILO_STATUS = {
  OK: ["OK", "border-emerald-200 bg-emerald-50 text-emerald-700"],
  SUG: ["Sugestão", "border-amber-200 bg-amber-50 text-amber-800"],
  DIV: ["Divergente", "border-amber-200 bg-amber-50 text-amber-800"],
  AB: ["Abaixo 27min", "border-rose-200 bg-rose-50 text-rose-700"],
  OUT: ["", "border-slate-200 bg-slate-100 text-slate-600"],
};

function PilulaStatus({ status }) {
  const chave = chaveStatus(status);
  const [rotulo, classe] = ESTILO_STATUS[chave];
  return (
    <span
      title={String(status ?? "") || "sem status"}
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold ${classe}`}
    >
      {rotulo || String(status ?? "") || "—"}
    </span>
  );
}

function classeLinha(linha) {
  const chave = chaveStatus(linha.status_almoco);
  if (chave === "OK") return "bg-emerald-50/50 hover:bg-emerald-50";
  if (chave === "AB") return "bg-rose-50/50 hover:bg-rose-50";
  if (chave === "SUG" || chave === "DIV") return "bg-amber-50/50 hover:bg-amber-50";
  return "bg-white hover:bg-slate-50";
}

/* ─────────────────────────── jornada ───────────────────────────
   A jornada do Passo 1 é a do CITATTI (operação), não a do ponto: o ponto é
   justamente o que está sendo auditado. O total do ponto entra só quando não
   há Citatti no dia — e aí aparece em cinza, para não ser lido como régua. */
function CelulaJornada({ linha }) {
  const citatti = num(linha.jornada_citatti_min);
  if (citatti != null) return <span>{fmtMin(citatti)}</span>;
  const ponto = num(linha.jornada_total_min);
  if (ponto == null) return <span className="text-slate-400">—</span>;
  return (
    <span className="text-slate-400" title="Sem Citatti nesse dia — jornada pelo ponto">
      {fmtMin(ponto)}
    </span>
  );
}

/* ─────────────────────────── colunas ─────────────────────────── */

const COL_CRACHA = { chave: "cracha", rotulo: "Crachá", render: (r) => r.cracha || "—" };
const COL_NOME = {
  chave: "nm_funcionario",
  rotulo: "Nome",
  render: (r) => <span className="font-semibold text-slate-900">{r.nm_funcionario || "—"}</span>,
};
const COL_DATA = { chave: "data_ref", rotulo: "Data", render: (r) => fmtData(r.data_ref) };
const COL_JORNADA = {
  chave: "jornada",
  rotulo: "Jornada",
  numerica: true,
  render: (r) => <CelulaJornada linha={r} />,
};
const COL_STATUS = {
  chave: "status_almoco",
  rotulo: "Status",
  render: (r) => <PilulaStatus status={r.status_almoco} />,
};

// TODOS · Sugestão · Divergente — o "Realizado" aqui já é o da regra dos 27 min.
const COLUNAS_PADRAO = [
  COL_CRACHA,
  COL_NOME,
  COL_DATA,
  COL_JORNADA,
  { chave: "fonte", rotulo: "Fonte", render: (r) => r.fonte || "—" },
  { chave: "rea_ini", rotulo: "Realizado início", numerica: true, render: (r) => fmtHora(almocoRef(r).ini) },
  { chave: "rea_fim", rotulo: "Realizado fim", numerica: true, render: (r) => fmtHora(almocoRef(r).fim) },
  { chave: "rea_dur", rotulo: "Duração intervalo", numerica: true, render: (r) => fmtDur(almocoRef(r).min) },
  { chave: "imp_ini", rotulo: "Importação início", numerica: true, render: (r) => fmtHora(r.importacao_inicio) },
  { chave: "imp_fim", rotulo: "Importação fim", numerica: true, render: (r) => fmtHora(r.importacao_fim) },
  { chave: "imp_dur", rotulo: "Duração importação", numerica: true, render: (r) => fmtDur(r.importacao_duracao_min) },
  { chave: "prog_ini", rotulo: "Programado início", numerica: true, render: (r) => fmtHora(r.programado_inicio) },
  { chave: "prog_fim", rotulo: "Programado fim", numerica: true, render: (r) => fmtHora(r.programado_fim) },
  { chave: "prog_dur", rotulo: "Duração programado", numerica: true, render: (r) => fmtDur(r.programado_duracao_min) },
  COL_STATUS,
];

// Abaixo 27min — aqui o "Realizado" é o valor CRU do Citatti (`sugestao_*`),
// sem a troca pelo SST: é exatamente esse número curto que está em discussão.
const COLUNAS_ABAIXO = [
  COL_CRACHA,
  COL_NOME,
  COL_DATA,
  COL_JORNADA,
  { chave: "sug_ini", rotulo: "Realizado início", numerica: true, render: (r) => fmtHora(r.sugestao_inicio) },
  { chave: "sug_fim", rotulo: "Realizado fim", numerica: true, render: (r) => fmtHora(r.sugestao_fim) },
  { chave: "sug_dur", rotulo: "Duração intervalo", numerica: true, render: (r) => fmtDur(r.sugestao_duracao_min) },
  { chave: "sugestao_origem", rotulo: "Origem", render: (r) => r.sugestao_origem || "—" },
  COL_STATUS,
];

// OK — não há o que conferir: grade reduzida, só para confirmar o motivo.
const COLUNAS_OK = [
  COL_CRACHA,
  COL_NOME,
  COL_DATA,
  COL_JORNADA,
  { chave: "jornada_origem", rotulo: "Origem jornada", render: (r) => r.jornada_origem || "—" },
  COL_STATUS,
];

const colunasDoFiltro = (filtro) =>
  filtro === "AB" ? COLUNAS_ABAIXO : filtro === "OK" ? COLUNAS_OK : COLUNAS_PADRAO;

const FILTROS = [
  ["TODOS", "Todos"],
  ["SUG", "Sugestão"],
  ["AB", "Abaixo 27min"],
  ["DIV", "Divergente"],
  ["OK", "OK"],
];

/* ─────────────────────────── leitura ───────────────────────────
   As datas mudam pouco e custam uma varredura da coluna inteira; ficam em
   cache de módulo (o app antigo fazia igual com IVDATAS). O botão Recarregar
   limpa o cache. */
let cacheDatas = null;

async function buscarDatas() {
  if (cacheDatas) return cacheDatas;
  const vistas = new Set();
  for (let pagina = 0; pagina < 12; pagina += 1) {
    const bloco = await lerDP360("ponto_intervalo", {
      colunas: "data_ref",
      ordem: "data_ref.desc",
      limite: PASSO_DATAS,
      offset: pagina * PASSO_DATAS,
    });
    bloco.forEach((linha) => {
      const dia = String(linha.data_ref ?? "").slice(0, 10);
      if (dia) vistas.add(dia);
    });
    if (bloco.length < PASSO_DATAS) break;
  }
  cacheDatas = Array.from(vistas).sort().reverse();
  return cacheDatas;
}

const buscarLinhas = (data) =>
  lerTudoDP360("ponto_intervalo", {
    filtros: { data_ref: `eq.${data}` },
    ordem: "cracha.asc",
  });

/* ─────────────────────── painel de detalhe ─────────────────────── */

function BlocoIntervalo({ titulo, inicio, fim, duracao, nota, destaque }) {
  const temJanela = String(inicio ?? "").trim() || String(fim ?? "").trim();
  return (
    <div
      className={`rounded-2xl border p-4 ${
        destaque ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="text-xs font-black uppercase tracking-wide text-slate-500">{titulo}</div>
      <div className="mt-2 text-sm font-bold tabular-nums text-slate-900">
        {temJanela ? `${fmtHora(inicio)} – ${fmtHora(fim)}` : "—"}
      </div>
      <div className="mt-0.5 text-xs font-semibold tabular-nums text-slate-600">{fmtDur(duracao)}</div>
      {nota && <div className="mt-2 text-xs leading-5 text-slate-500">{nota}</div>}
    </div>
  );
}

function PainelDetalhe({ linha, aoFechar }) {
  const aplicado = almocoRef(linha);
  const diferenca = num(linha.diferenca_transnet_min);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8"
      onClick={aoFechar}
      role="presentation"
    >
      <div
        className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8"
        onClick={(evento) => evento.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Detalhe da refeição"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-black text-slate-900">{linha.nm_funcionario || "—"}</div>
            <div className="mt-1 text-sm font-semibold text-slate-600">
              Crachá {linha.cracha || "—"} · {fmtData(linha.data_ref)} · Jornada{" "}
              <CelulaJornada linha={linha} />
            </div>
            <div className="mt-2">
              <PilulaStatus status={linha.status_almoco} />
            </div>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Fechar detalhe"
          >
            <X size={17} />
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* O batido no ponto é o que gera o "Divergente" — e no app antigo ele
              não aparecia em tela nenhuma. Mostrar aqui é melhoria proposital. */}
          <BlocoIntervalo
            titulo="Batido no ponto (Transnet)"
            inicio={linha.transnet_almoco_inicio}
            fim={linha.transnet_almoco_fim}
            duracao={linha.transnet_almoco_duracao_min}
            nota="Da 2ª e 3ª batida do cartão. É contra ele que a sugestão é comparada."
          />
          <BlocoIntervalo
            titulo="Sugestão Citatti"
            inicio={linha.sugestao_inicio}
            fim={linha.sugestao_fim}
            duracao={linha.sugestao_duracao_min}
            nota={linha.sugestao_origem ? `Origem: ${linha.sugestao_origem}` : null}
          />
          <BlocoIntervalo
            titulo="Sugestão SST"
            inicio={linha.sugestao_sst_inicio}
            fim={linha.sugestao_sst_fim}
            duracao={linha.sugestao_sst_duracao_min}
            nota={`Entra no lugar do Citatti quando ele fica abaixo de ${MIN_ALMOCO} min.`}
          />
          <BlocoIntervalo
            titulo="Programado (escala)"
            inicio={linha.programado_inicio}
            fim={linha.programado_fim}
            duracao={linha.programado_duracao_min}
          />
          <BlocoIntervalo
            titulo="Importação"
            inicio={linha.importacao_inicio}
            fim={linha.importacao_fim}
            duracao={linha.importacao_duracao_min}
            nota={`Janela fixa de ${IMPORTACAO_JANELA_MIN} min a partir do início da sugestão.`}
          />
          <BlocoIntervalo
            destaque
            titulo={`Realizado (regra dos ${MIN_ALMOCO} min)`}
            inicio={aplicado.ini}
            fim={aplicado.fim}
            duracao={aplicado.min}
            nota={
              aplicado.origem
                ? `Origem aplicada: ${aplicado.origem}${aplicado.detalhe ? ` · ${aplicado.detalhe}` : ""}`
                : "Sem intervalo utilizável nas duas fontes."
            }
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">
              Diferença cartão × sugestão
            </div>
            <div className="mt-2 text-sm font-bold tabular-nums text-slate-900">
              {diferenca == null ? "—" : `${Math.round(diferenca)} min`}
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              Compara só o INÍCIO. Acima de {TOLERANCIA_TRANSNET_MIN} min vira Divergente.
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Fonte</div>
            <div className="mt-2 text-sm font-bold text-slate-900">{linha.fonte || "—"}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              Quem decidiu o veredito do dia, conforme a view do ponto.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── legenda ─────────────────────────── */

function Legenda() {
  const item = (titulo, texto) => (
    <li key={titulo} className="leading-6">
      <span className="font-bold text-slate-800">{titulo}</span>{" "}
      <span className="text-slate-600">{texto}</span>
    </li>
  );
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
        <Info size={14} /> Como a régua funciona
      </div>
      <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
        {item(
          `Refeição mínima: ${MIN_ALMOCO} min.`,
          "Abaixo disso o Citatti pegou uma parada, não o almoço — cai para o SST; se o SST também não alcança, vale o que a pessoa fez.",
        )}
        {item(
          `Dispensa de intervalo: ${JORNADA_EXIGE_ALMOCO} min (6h).`,
          "Jornada menor que isso, medida pelo Citatti, já entra como OK — não precisa de refeição.",
        )}
        {item(
          `Tolerância cartão × sugestão: ${TOLERANCIA_TRANSNET_MIN} min.`,
          "Compara SÓ o início do intervalo. Passou disso, o dia vira Divergente.",
        )}
        {item(
          `Importação: janela fixa de ${IMPORTACAO_JANELA_MIN} min.`,
          "O arquivo grava sempre 30 min a partir do início sugerido, não a duração realizada.",
        )}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <PilulaStatus status="OK" />
        <PilulaStatus status="SUGESTAO" />
        <PilulaStatus status="DIVERGENTE (transnet x sugestao)" />
        <PilulaStatus status="ABAIXO_27MIN" />
      </div>
    </div>
  );
}

/* ─────────────────────────── tela ─────────────────────────── */

export default function Refeicao() {
  const [datas, setDatas] = useState([]);
  const [data, setData] = useState("");
  const [linhas, setLinhas] = useState([]);
  const [carregandoDatas, setCarregandoDatas] = useState(true);
  const [carregandoLinhas, setCarregandoLinhas] = useState(false);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("TODOS");
  const [busca, setBusca] = useState("");
  const [detalhe, setDetalhe] = useState(null);
  const [recarga, setRecarga] = useState(0);

  // 1) datas disponíveis (default = mais recente)
  useEffect(() => {
    let ativo = true;
    setCarregandoDatas(true);
    setErro("");
    buscarDatas()
      .then((lista) => {
        if (!ativo) return;
        setDatas(lista);
        setData((atual) => (atual && lista.includes(atual) ? atual : lista[0] || ""));
      })
      .catch((falha) => {
        if (ativo) setErro(falha.message || "Falha ao consultar as datas do intervalo.");
      })
      .finally(() => {
        if (ativo) setCarregandoDatas(false);
      });
    return () => {
      ativo = false;
    };
  }, [recarga]);

  // 2) linhas do dia escolhido
  useEffect(() => {
    if (!data) {
      setLinhas([]);
      return undefined;
    }
    let ativo = true;
    setCarregandoLinhas(true);
    setErro("");
    buscarLinhas(data)
      .then((lista) => {
        if (ativo) setLinhas(lista);
      })
      .catch((falha) => {
        if (!ativo) return;
        setLinhas([]);
        setErro(falha.message || "Falha ao consultar o intervalo desse dia.");
      })
      .finally(() => {
        if (ativo) setCarregandoLinhas(false);
      });
    return () => {
      ativo = false;
    };
  }, [data, recarga]);

  // Esc fecha o detalhe.
  useEffect(() => {
    if (!detalhe) return undefined;
    const aoTeclar = (evento) => {
      if (evento.key === "Escape") setDetalhe(null);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [detalhe]);

  const recarregar = useCallback(() => {
    cacheDatas = null;
    setDetalhe(null);
    setRecarga((n) => n + 1);
  }, []);

  // Contagens dos chips: sempre sobre o dia inteiro, não sobre a busca — é assim
  // que o DP lê "quantos ficaram para importar hoje".
  const contagens = useMemo(() => {
    const conta = { TODOS: linhas.length, SUG: 0, AB: 0, DIV: 0, OK: 0 };
    linhas.forEach((linha) => {
      const chave = chaveStatus(linha.status_almoco);
      if (conta[chave] !== undefined) conta[chave] += 1;
    });
    return conta;
  }, [linhas]);

  const visiveis = useMemo(() => {
    const termos = semAcento(busca).split(/\s+/).filter(Boolean);
    return linhas.filter((linha) => {
      if (filtro !== "TODOS" && chaveStatus(linha.status_almoco) !== filtro) return false;
      if (!termos.length) return true;
      const alvo = semAcento(`${linha.nm_funcionario ?? ""} ${linha.cracha ?? ""}`);
      return termos.every((termo) => alvo.includes(termo));
    });
  }, [linhas, filtro, busca]);

  const colunas = colunasDoFiltro(filtro);

  return (
    <AbaShell
      icone={Coffee}
      titulo="Refeição"
      resumo="Confere o intervalo de cada motorista contra a operação e prepara o que precisa ser importado. Somente leitura — nada é gravado nesta tela."
      carregando={carregandoDatas}
      erro={erro}
      acoes={
        <button
          type="button"
          onClick={recarregar}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
        >
          <RefreshCw size={16} /> Recarregar
        </button>
      }
    >
      {!datas.length ? (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
          Nenhuma data disponível em <code>ponto_intervalo</code>.
        </p>
      ) : (
        <>
          {/* filtros */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Data</span>
              <select
                value={data}
                onChange={(evento) => {
                  setData(evento.target.value);
                  setDetalhe(null);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-400"
              >
                {datas.map((dia) => (
                  <option key={dia} value={dia}>
                    {fmtData(dia)}
                  </option>
                ))}
              </select>
            </label>

            <div className="relative w-full sm:max-w-xs">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Buscar por nome ou crachá"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400"
              />
            </div>
          </div>

          {/* chips + indicador */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {FILTROS.map(([chave, rotulo]) => {
                const ativo = filtro === chave;
                return (
                  <button
                    key={chave}
                    type="button"
                    onClick={() => setFiltro(chave)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-bold transition ${
                      ativo
                        ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {rotulo}
                    <span
                      className={`rounded-full px-1.5 text-xs font-black tabular-nums ${
                        ativo ? "bg-white/20" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {contagens[chave] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="text-sm font-bold text-slate-700">
              {contagens.SUG ? (
                <span className="rounded-xl bg-amber-50 px-3 py-1.5 text-amber-800">
                  {contagens.SUG} para importar
                </span>
              ) : (
                <span className="text-slate-400">Nada para importar nesse dia</span>
              )}
            </div>
          </div>

          {/* ação */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {/* TODO(DP360 fase 5): "Gerar importação" monta o arquivo de batidas
                (`ponto2_sugerido`/`ponto3_sugerido`) e quem sobe isso no Transnet é o
                robô — não existe nesta fase, que é só de leitura. Quando entrar:
                registrar o log em `ponto_importacoes` e disparar o workflow com escopo
                explícito; nunca gravar direto no cartão a partir da tela. */}
            <button
              type="button"
              disabled
              title="Depende do robô que sobe as batidas no Transnet — ainda não portado para o INOVE."
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-sm font-bold text-slate-400"
            >
              <Download size={16} /> Gerar importação
            </button>
            <span className="text-xs font-semibold text-slate-500">
              {visiveis.length} de {linhas.length} linha{linhas.length === 1 ? "" : "s"} do dia
            </span>
          </div>

          {/* grade */}
          <div className="mt-4">
            {carregandoLinhas ? (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                Carregando o intervalo de {fmtData(data)}…
              </p>
            ) : !visiveis.length ? (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                Nada nesse dia com esse filtro.
              </p>
            ) : (
              <div className="max-h-[68vh] overflow-auto rounded-2xl border border-slate-200">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100">
                    <tr>
                      {colunas.map((coluna) => (
                        <th
                          key={coluna.chave}
                          scope="col"
                          className={`whitespace-nowrap px-3 py-2.5 text-xs font-black uppercase tracking-wide text-slate-500 ${
                            coluna.numerica ? "text-right" : "text-left"
                          }`}
                        >
                          {coluna.rotulo}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visiveis.map((linha) => (
                      <tr
                        key={`${linha.cracha}|${linha.data_ref}`}
                        onClick={() => setDetalhe(linha)}
                        onKeyDown={(evento) => {
                          if (evento.key === "Enter" || evento.key === " ") {
                            evento.preventDefault();
                            setDetalhe(linha);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        title="Abrir o detalhe do dia"
                        className={`cursor-pointer outline-none transition focus:ring-2 focus:ring-inset focus:ring-blue-400 ${classeLinha(linha)}`}
                      >
                        {colunas.map((coluna) => (
                          <td
                            key={coluna.chave}
                            className={`whitespace-nowrap px-3 py-2 text-slate-700 ${
                              coluna.numerica ? "text-right tabular-nums" : "text-left"
                            }`}
                          >
                            {coluna.render(linha)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Legenda />
        </>
      )}

      {detalhe && <PainelDetalhe linha={detalhe} aoFechar={() => setDetalhe(null)} />}
    </AbaShell>
  );
}
