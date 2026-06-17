import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import { FaSyncAlt, FaSearch, FaCarSide, FaBarcode, FaTimes } from "react-icons/fa";
import { printEtiquetasPneus } from "../../utils/pneuEtiquetaPdf";

const POSICOES = ["DD", "DE", "TEE", "TEI", "TDI", "TDE"];
const FILTROS_STORAGE_KEY = "pcm_controle_pneus_filtros_v1";
const ORIGEM_RECEBEU_SEM_PNEU = "FICOU SEM PNEU";
const LABEL_PNEU_RETIRADO = "PNEU RETIRADO";

const STATUS_PALETTE = {
  OK: { bg: "#dcfce7", border: "#16a34a", text: "#14532d", chip: "#16a34a" },
  SUCATA: { bg: "#fee2e2", border: "#dc2626", text: "#7f1d1d", chip: "#dc2626" },
  "OUTRO VEICULO": { bg: "#fef9c3", border: "#ca8a04", text: "#713f12", chip: "#ca8a04" },
  DUPLICIDADE: { bg: "#ede0d4", border: "#8b5e3c", text: "#5b341b", chip: "#8b5e3c" },
  "NAO EXISTE": { bg: "#ffedd5", border: "#ea580c", text: "#7c2d12", chip: "#ea580c" },
  ESTOQUE: { bg: "#dbeafe", border: "#2563eb", text: "#1e3a8a", chip: "#2563eb" },
  INCORRETO: { bg: "#fee2e2", border: "#dc2626", text: "#7f1d1d", chip: "#dc2626" },
};

function fmtData(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtDataCurta(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function normalizarPneu(valor) {
  const digits = String(valor || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(6, "0");
}

function normalizarPosicao(valor) {
  const texto = String(valor || "").trim().toUpperCase();
  if (texto === "DD" || texto === "DIANTEIRO DIREITO") return "DD";
  if (texto === "DE" || texto === "DIANTEIRO ESQUERDO") return "DE";
  if (texto === "TEE" || texto === "TRASEIRO EXTERNO ESQUERDO") return "TEE";
  if (texto === "TEI" || texto === "TRASEIRO INTERNO ESQUERDO") return "TEI";
  if (texto === "TDI" || texto === "TRASEIRO INTERNO DIREITO") return "TDI";
  if (texto === "TDE" || texto === "TRASEIRO EXTERNO DIREITO") return "TDE";
  return texto;
}

function calcularStatusComparacao({ baseNumero, audNumero, prefixo, posicao, alocacaoPorPneu, ativosPorPneu, inativosPorPneu }) {
  if (!audNumero) return null;
  if (normalizarPneu(baseNumero) === normalizarPneu(audNumero)) return "OK";
  const pneu = normalizarPneu(audNumero);
  if (!pneu) return "INCORRETO";
  if (inativosPorPneu.has(pneu)) return "SUCATA";
  const aloc = alocacaoPorPneu.get(pneu);
  if (aloc && (String(aloc.prefixo || "") !== String(prefixo || "") || String(aloc.posicao || "") !== String(posicao || ""))) {
    return "OUTRO VEICULO";
  }
  if (ativosPorPneu.has(pneu)) return "ESTOQUE";
  return "NAO EXISTE";
}

function isBorrachariaLocal(localizacao) {
  return /BORRACH|RECAP|CONSERT/i.test(String(localizacao || ""));
}

function isRecapadoraSituacao(situacao) {
  return /RECAP/i.test(String(situacao || ""));
}

function isRecapadoraLocal(localizacao) {
  return /EXTERNO|RECAP/i.test(String(localizacao || ""));
}

function toTime(valor) {
  const time = valor ? new Date(valor).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function normalizeSortValue(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor).toLocaleLowerCase("pt-BR");
}

async function fetchAll(factory, pageSize = 1000) {
  let from = 0;
  const rows = [];

  while (true) {
    const { data, error } = await factory().range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function SortableHeader({ label, sortKey, sort, onSort }) {
  const ativo = sort.key === sortKey;
  const seta = !ativo ? "↕" : sort.direction === "asc" ? "↑" : "↓";

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1 font-semibold hover:text-slate-900"
    >
      <span>{label}</span>
      <span className="text-[10px]">{seta}</span>
    </button>
  );
}

function lerFiltrosSalvos() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(FILTROS_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function Celula({ base, aud, status, trocaApos, detalheStatus }) {
  const palette = STATUS_PALETTE[status] || {
    bg: "#f8fafc",
    border: "#cbd5e1",
    text: "#475569",
    chip: "#94a3b8",
  };
  const vazio = !base && !aud;

  return (
    <div
      className="min-w-[178px] rounded-md px-2 py-1.5"
      title={detalheStatus || undefined}
      style={{
        background: vazio ? "#f8fafc" : palette.bg,
        border: `1px solid ${vazio ? "#e2e8f0" : palette.border}`,
        color: palette.text,
        cursor: detalheStatus ? "help" : "default",
      }}
    >
      {trocaApos ? (
        <div className="mb-1 text-right text-sm font-bold leading-none text-amber-500" title="Teve troca depois da auditoria">
          *
        </div>
      ) : null}
      <div className="grid grid-cols-[40px_1fr] items-center gap-x-2 gap-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Base</span>
        <span className="font-mono text-[13px] font-semibold leading-none">{base || "—"}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Aud</span>
        <span className="font-mono text-[13px] font-bold leading-none">{aud || "—"}</span>
      </div>
      {status ? (
        <div
          className="mt-1 rounded px-1.5 py-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-white"
          style={{ background: palette.chip }}
        >
          {status}
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({ label, value, cor }) {
  return (
    <div
      className="min-w-[110px] rounded-lg border px-3 py-2 shadow-sm"
      style={{ borderColor: cor, background: "white" }}
    >
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-xl font-bold" style={{ color: cor }}>
        {value}
      </div>
    </div>
  );
}

export default function PCMControlePneus() {
  const filtrosIniciais = lerFiltrosSalvos();
  const [abaAtiva, setAbaAtiva] = useState(filtrosIniciais.abaAtiva || "veiculos");
  const [abaEstoqueAtiva, setAbaEstoqueAtiva] = useState(filtrosIniciais.abaEstoqueAtiva || "fisico");
  const [etiquetaModalOpen, setEtiquetaModalOpen] = useState(false);
  const [etiquetaBusca, setEtiquetaBusca] = useState("");
  const [etiquetaSelecionadas, setEtiquetaSelecionadas] = useState(new Set());
  const [rowsRaw, setRowsRaw] = useState([]);
  const [trocas, setTrocas] = useState([]);
  const [alocacoes, setAlocacoes] = useState([]);
  const [ativos, setAtivos] = useState([]);
  const [inativos, setInativos] = useState([]);
  const [estoqueRows, setEstoqueRows] = useState([]);
  const [consertos, setConsertos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState(filtrosIniciais.busca || "");
  const [buscaFogo, setBuscaFogo] = useState(filtrosIniciais.buscaFogo || "");
  const [filtroStatus, setFiltroStatus] = useState(filtrosIniciais.filtroStatus || "");
  const [filtroComparacao, setFiltroComparacao] = useState(filtrosIniciais.filtroComparacao || "");
  const [somenteSelecionados, setSomenteSelecionados] = useState(!!filtrosIniciais.somenteSelecionados);
  const [prefixosSelecionados, setPrefixosSelecionados] = useState(Array.isArray(filtrosIniciais.prefixosSelecionados) ? filtrosIniciais.prefixosSelecionados : []);
  const [filtroDataAuditoria, setFiltroDataAuditoria] = useState(filtrosIniciais.filtroDataAuditoria || "");
  const [ordenacaoTabela, setOrdenacaoTabela] = useState(filtrosIniciais.ordenacaoTabela || { key: "data_estoque", direction: "desc" });
  const [disparando, setDisparando] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  async function carregar() {
    setCarregando(true);
    try {
      const [
        { data, error },
        trocasData,
        alocData,
        ativosData,
        inativosData,
        estoqueData,
        consertosData,
      ] = await Promise.all([
        supabase.from("vw_pcm_controle_pneus_central").select("*"),
        fetchAll(() =>
          supabase
            .from("pcm_troca_pneus")
            .select("id, ficha_troca, tipo_troca, prefixo_retirada, posicao_retirada, prefixo_instalacao, posicao_instalacao, numero_fogo_retirado, numero_fogo_colocado, origem_recebeu, numero_fogo_origem_recebido, numero_fogo_destino_retirado, created_at")
        ),
        fetchAll(() => supabase.from("pcm_pneus_transnet_alocacao").select("prefixo, posicao, numero_fogo, snapshot_em")),
        fetchAll(() => supabase.from("pcm_pneus_transnet_ativos").select("numero_fogo, localizacao, posicao, marca, medida")),
        fetchAll(() => supabase.from("pcm_pneus_transnet_inativos").select("numero_fogo, motivo")),
        fetchAll(() => supabase.from("pcm_estoque_pneus").select("id, ficha_estoque, numero_fogo, numero_pneu, marca, situacao, created_at").order("created_at", { ascending: false })),
        fetchAll(() => supabase.from("pcm_consertos_pneus").select("id, ficha_conserto, numero_fogo, prefixo, status, situacao_origem, created_at").order("created_at", { ascending: false })),
      ]);

      if (error) throw error;

      const sorted = [...(data || [])].sort((a, b) => {
        const prefixoA = String(a?.prefixo_base || a?.prefixo_auditoria || "").localeCompare(
          String(b?.prefixo_base || b?.prefixo_auditoria || ""),
          "pt-BR",
          { numeric: true, sensitivity: "base" }
        );
        if (prefixoA !== 0) return prefixoA;
        return String(a?.posicao || "").localeCompare(String(b?.posicao || ""), "pt-BR");
      });

      setRowsRaw(sorted);
      setTrocas(trocasData || []);
      setAlocacoes(alocData || []);
      setAtivos(ativosData || []);
      setInativos(inativosData || []);
      setEstoqueRows(estoqueData || []);
      setConsertos(consertosData || []);
      setUltimaAtualizacao(sorted?.[0]?.snapshot_em || alocData?.[0]?.snapshot_em || null);
    } catch (error) {
      console.error("Erro ao carregar controle de pneus:", error);
      alert(error?.message || "Não foi possível carregar o controle de pneus.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel("pcm_controle_pneus")
      .on("postgres_changes", { event: "*", schema: "public", table: "pcm_pneus_transnet_alocacao" }, () => carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "pcm_auditoria_pneus" }, () => carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "pcm_troca_pneus" }, () => carregar())
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      FILTROS_STORAGE_KEY,
      JSON.stringify({
        abaAtiva,
        abaEstoqueAtiva,
        busca,
        buscaFogo,
        filtroStatus,
        filtroComparacao,
        somenteSelecionados,
        prefixosSelecionados,
        filtroDataAuditoria,
        ordenacaoTabela,
      })
    );
  }, [abaAtiva, abaEstoqueAtiva, busca, buscaFogo, filtroStatus, filtroComparacao, somenteSelecionados, prefixosSelecionados, filtroDataAuditoria, ordenacaoTabela]);

  async function dispararBot() {
    if (disparando) return;
    setDisparando(true);
    try {
      const { error } = await supabase.functions.invoke("dispatch-bot", {
        body: { tipo: "pneus" },
      });
      if (error) {
        alert(`Falha ao chamar bot: ${error.message}`);
      } else {
        setTimeout(carregar, 120000);
        setTimeout(carregar, 240000);
      }
    } finally {
      setTimeout(() => setDisparando(false), 4000);
    }
  }

  function atualizarPagina() {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  const linhasBase = useMemo(() => {
    const map = new Map();
    const alocacaoPorPneu = new Map();
    const ativosPorPneu = new Map();
    const inativosPorPneu = new Map();

    for (const item of alocacoes) {
      const pneu = normalizarPneu(item.numero_fogo);
      if (!pneu || alocacaoPorPneu.has(pneu)) continue;
      alocacaoPorPneu.set(pneu, item);
    }

    for (const item of ativos) {
      const pneu = normalizarPneu(item.numero_fogo);
      if (!pneu || ativosPorPneu.has(pneu)) continue;
      ativosPorPneu.set(pneu, item);
    }

    for (const item of inativos) {
      const pneu = normalizarPneu(item.numero_fogo);
      if (!pneu || inativosPorPneu.has(pneu)) continue;
      inativosPorPneu.set(pneu, item);
    }

    const rowIndexPorPosicao = new Map();
    for (const [index, row] of rowsRaw.entries()) {
      const chave = `${String(row.prefixo_base || row.prefixo_auditoria || "").trim()}|${normalizarPosicao(row.posicao)}`;
      if (!rowIndexPorPosicao.has(chave)) {
        rowIndexPorPosicao.set(chave, { index, row });
      }
    }

    const trocasOrigemPorPosicao = new Map();
    for (const troca of trocas) {
      if (String(troca.tipo_troca || "").trim() !== "CARRO -> CARRO") continue;
      const prefixo = String(troca.prefixo_retirada || "").trim();
      const posicao = normalizarPosicao(troca.posicao_retirada);
      if (!prefixo || !posicao) continue;
      const chave = `${prefixo}|${posicao}`;
      const atual = trocasOrigemPorPosicao.get(chave);
      if (!atual || toTime(troca.created_at) > toTime(atual.created_at)) {
        trocasOrigemPorPosicao.set(chave, troca);
      }
    }

    const rowsComTrocaOrigem = [...rowsRaw];
    for (const [chave, troca] of trocasOrigemPorPosicao.entries()) {
      const rowBaseMeta = rowIndexPorPosicao.get(chave);
      if (!rowBaseMeta) continue;
      const rowBase = rowBaseMeta.row;
      const auditoriaTime = toTime(rowBase.auditoria_em);
      const trocaTime = toTime(troca.created_at);
      if (!auditoriaTime || !trocaTime || trocaTime <= auditoriaTime) continue;
      const origemRecebeu = String(troca.origem_recebeu || ORIGEM_RECEBEU_SEM_PNEU).trim();
      const semPneu = origemRecebeu === ORIGEM_RECEBEU_SEM_PNEU;
      const audVisual = semPneu ? LABEL_PNEU_RETIRADO : (troca.numero_fogo_origem_recebido || "");
      const status = semPneu
        ? "INCORRETO"
        : calcularStatusComparacao({
          baseNumero: rowBase.numero_fogo_base,
          audNumero: audVisual,
          prefixo: rowBase.prefixo_base || rowBase.prefixo_auditoria || "",
          posicao: rowBase.posicao,
          alocacaoPorPneu,
          ativosPorPneu,
          inativosPorPneu,
        });

      rowsComTrocaOrigem[rowBaseMeta.index] = {
        ...rowBase,
        ficha_auditoria: rowBase.ficha_auditoria || troca.ficha_troca || "",
        numero_fogo_aud: audVisual,
        status,
        troca_pos_auditoria: true,
        troca_ultima_em: troca.created_at || null,
        origem_troca: true,
        detalhe_troca_origem: semPneu
          ? `Troca ${troca.ficha_troca || "-"}: o carro de origem ficou sem pneu nessa posicao.`
          : `Troca ${troca.ficha_troca || "-"}: entrou o pneu ${troca.numero_fogo_origem_recebido || "-"}.`,
      };
    }

    const auditoriaPorPneu = new Map();
    for (const row of rowsComTrocaOrigem) {
      const pneu = normalizarPneu(row.numero_fogo_aud);
      if (!pneu || pneu === "000000") continue;
      if (!auditoriaPorPneu.has(pneu)) auditoriaPorPneu.set(pneu, []);
      auditoriaPorPneu.get(pneu).push({
        prefixo: row.prefixo_base || row.prefixo_auditoria || "",
        posicao: row.posicao,
      });
    }

    for (const row of rowsComTrocaOrigem) {
      const key = row.grupo_id || row.auditoria_id || row.prefixo_base || row.prefixo_auditoria;
      if (!key) continue;

      if (!map.has(key)) {
        map.set(key, {
          grupo_id: key,
          prefixo: row.prefixo_base || row.prefixo_auditoria || "",
          ficha: row.ficha_auditoria || "",
          auditoria_em: row.auditoria_em || null,
          auditado_por: row.auditado_por || "",
          temAuditoria: !!row.tem_auditoria,
          posicoes: {},
          troca: false,
          trocasDetalhes: [],
        });
      }

      const item = map.get(key);
      const prefixoAtual = row.prefixo_base || row.prefixo_auditoria || "";
      const pneuAuditoria = normalizarPneu(row.numero_fogo_aud);
      const outrasAuditoriasMesmoPneu = (auditoriaPorPneu.get(pneuAuditoria) || []).filter(
        (registro) => registro.prefixo !== prefixoAtual || registro.posicao !== row.posicao
      );
      const alocacaoAtual = alocacaoPorPneu.get(pneuAuditoria);

      let statusVisual =
        row.status ||
        ((row.numero_fogo_base && !row.numero_fogo_aud) || (!row.numero_fogo_base && row.numero_fogo_aud)
          ? "INCORRETO"
          : null);

      if (!row.numero_fogo_base && row.numero_fogo_aud) {
        statusVisual = "INCORRETO";
      }

      let detalheStatus = row.detalhe_troca_origem || "";
      if (statusVisual === "OK" && outrasAuditoriasMesmoPneu.length > 0) {
        statusVisual = "DUPLICIDADE";
        const outra = outrasAuditoriasMesmoPneu[0];
        detalheStatus = `Tambem aparece na auditoria do carro ${outra.prefixo} na posicao ${outra.posicao}.`;
      } else if (statusVisual === "OUTRO VEICULO") {
        const detalhes = [];
        if (
          alocacaoAtual &&
          (String(alocacaoAtual.prefixo || "") !== String(prefixoAtual) || String(alocacaoAtual.posicao || "") !== String(row.posicao || ""))
        ) {
          detalhes.push(`No TransNet esta no carro ${alocacaoAtual.prefixo} na posicao ${alocacaoAtual.posicao}.`);
        }
        if (outrasAuditoriasMesmoPneu.length > 0) {
          const outra = outrasAuditoriasMesmoPneu[0];
          detalhes.push(`Tambem aparece na auditoria do carro ${outra.prefixo} na posicao ${outra.posicao}.`);
        }
        detalheStatus = detalhes.join(" ");
      }

      item.posicoes[row.posicao] = {
        base: row.numero_fogo_base,
        aud: row.numero_fogo_aud,
        status: statusVisual,
        trocaApos: !!row.troca_pos_auditoria,
        referenciaEm: row.troca_ultima_em || row.auditoria_em || null,
        detalheStatus,
      };
      if (row.troca_pos_auditoria) {
        item.troca = true;
        item.trocasDetalhes.push({
          posicao: row.posicao,
          data: row.troca_ultima_em || null,
        });
      }
      if (!item.ficha && row.ficha_auditoria) item.ficha = row.ficha_auditoria;
      if (!item.auditoria_em && row.auditoria_em) item.auditoria_em = row.auditoria_em;
      if (!item.auditado_por && row.auditado_por) item.auditado_por = row.auditado_por;
      if (row.tem_auditoria) item.temAuditoria = true;
    }

    return [...map.values()].map((item) => ({
      ...item,
      trocasDetalhes: item.trocasDetalhes.sort((a, b) => {
        const da = a.data ? new Date(a.data).getTime() : 0;
        const db = b.data ? new Date(b.data).getTime() : 0;
        return db - da;
      }),
    }));
  }, [rowsRaw, trocas, alocacoes, ativos, inativos]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhasBase.filter((row) => {
      if (q) {
        const hay = [row.ficha, row.prefixo, row.auditado_por].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (filtroStatus) {
        const has = POSICOES.some((posicao) => row.posicoes[posicao]?.status === filtroStatus);
        if (!has) return false;
      }

       const statuses = POSICOES.map((posicao) => row.posicoes[posicao]?.status).filter(Boolean);
       const temAuditoria = POSICOES.some((posicao) => !!row.posicoes[posicao]?.aud);
       const todosOk = temAuditoria && statuses.length > 0 && statuses.every((status) => status === "OK");
       const temIncorreto = statuses.some((status) => status !== "OK");

      if (filtroComparacao === "CORRETO" && !todosOk) return false;
      if (filtroComparacao === "INCORRETO" && !temIncorreto) return false;

      if (somenteSelecionados && !prefixosSelecionados.includes(String(row.prefixo || "").trim())) {
        return false;
      }

      if (filtroDataAuditoria) {
        if (!row.auditoria_em) return false;
        const inicio = new Date(`${filtroDataAuditoria}T00:00:00`);
        const dataAuditoria = new Date(row.auditoria_em);
        if (Number.isNaN(dataAuditoria.getTime()) || dataAuditoria < inicio) return false;
      }

      return true;
    });
  }, [busca, filtroStatus, filtroComparacao, somenteSelecionados, prefixosSelecionados, filtroDataAuditoria, linhasBase]);

  const kpis = useMemo(() => {
    let totalStatus = 0;
    let ok = 0;
    let sucata = 0;
    let outro = 0;
    let naoExiste = 0;
    let estoque = 0;

    for (const row of linhasBase) {
      for (const posicao of POSICOES) {
        const status = row.posicoes[posicao]?.status;
        if (!status) continue;
        totalStatus += 1;
        if (status === "OK") ok += 1;
        else if (status === "SUCATA") sucata += 1;
        else if (status === "OUTRO VEICULO") outro += 1;
        else if (status === "NAO EXISTE") naoExiste += 1;
        else if (status === "ESTOQUE") estoque += 1;
      }
    }

    return {
      base: linhasBase.length,
      ok,
      sucata,
      outro,
      naoExiste,
      estoque,
      okPct: totalStatus ? Math.round((ok / totalStatus) * 100) : 0,
    };
  }, [linhasBase]);

  const auditoriaPorPneu = useMemo(() => {
    const map = new Map();
    for (const linha of linhasBase) {
      for (const posicao of POSICOES) {
        const aud = normalizarPneu(linha.posicoes[posicao]?.aud);
        if (!aud) continue;
        if (!map.has(aud)) map.set(aud, []);
        map.get(aud).push({
          prefixo: linha.prefixo,
          posicao,
          ficha: linha.ficha,
          data: linha.posicoes[posicao]?.referenciaEm || linha.auditoria_em,
        });
      }
    }
    for (const lista of map.values()) {
      lista.sort((a, b) => toTime(b.data) - toTime(a.data));
    }
    return map;
  }, [linhasBase]);

  const estoqueComparado = useMemo(() => {
    const ultimaFicha = estoqueRows.find((item) => item.ficha_estoque)?.ficha_estoque || "";
    const estoqueAtual = ultimaFicha ? estoqueRows.filter((item) => item.ficha_estoque === ultimaFicha) : [];

    const latestEstoque = new Map();
    for (const item of estoqueAtual) {
      const pneu = normalizarPneu(item.numero_fogo || item.numero_pneu);
      if (!pneu || latestEstoque.has(pneu)) continue;
      latestEstoque.set(pneu, item);
    }

    const alocacaoPorPneu = new Map();
    for (const item of alocacoes) {
      const pneu = normalizarPneu(item.numero_fogo);
      if (!pneu || alocacaoPorPneu.has(pneu)) continue;
      alocacaoPorPneu.set(pneu, item);
    }

    const ativosPorPneu = new Map();
    for (const item of ativos) {
      const pneu = normalizarPneu(item.numero_fogo);
      if (!pneu || ativosPorPneu.has(pneu)) continue;
      ativosPorPneu.set(pneu, item);
    }

    const inativosPorPneu = new Map();
    for (const item of inativos) {
      const pneu = normalizarPneu(item.numero_fogo);
      if (!pneu || inativosPorPneu.has(pneu)) continue;
      inativosPorPneu.set(pneu, item);
    }

    const consertoPorPneu = new Map();
    for (const item of consertos) {
      const pneu = normalizarPneu(item.numero_fogo);
      if (!pneu || consertoPorPneu.has(pneu)) continue;
      consertoPorPneu.set(pneu, item);
    }

    const fisicoRows = [...latestEstoque.entries()].map(([pneu, estoque]) => {
      const aloc = alocacaoPorPneu.get(pneu) || null;
      const ativo = ativosPorPneu.get(pneu) || null;
      const inativo = inativosPorPneu.get(pneu) || null;
      const auditoria = (auditoriaPorPneu.get(pneu) || [])[0] || null;

      let status = "NAO LOCALIZADO";
      let local = "Nao encontrado no TransNet";

      if (inativo) {
        const situacaoFisica = String(estoque?.situacao || "").toUpperCase();
        status = situacaoFisica.includes("SUCATA") ? "SUCATA OK" : "SUCATA";
        local = inativo.motivo || "Inativo no TransNet";
      } else if (aloc) {
        status = "EM CARRO";
        local = `${aloc.prefixo} - ${aloc.posicao}`;
      } else if (ativo && isBorrachariaLocal(ativo.localizacao)) {
        status = "BORRACHARIA";
        local = `${ativo.localizacao || "BORRACHARIA"}${ativo.posicao ? ` - ${ativo.posicao}` : ""}`;
      } else if (ativo) {
        status = "OUTRO LOCAL";
        local = `${ativo.localizacao || "Ativo"}${ativo.posicao ? ` - ${ativo.posicao}` : ""}`;
      }

      return {
        secao: "fisico",
        key: `fisico-${pneu}`,
        pneu,
        ficha_estoque: estoque?.ficha_estoque || ultimaFicha,
        data_estoque: estoque?.created_at || null,
        marca: estoque?.marca || ativo?.marca || "",
        situacao_inove: estoque?.situacao || "",
        status,
        local,
        auditoria_texto: auditoria ? `${auditoria.prefixo} - ${auditoria.posicao}` : "Nao aparece na auditoria",
      };
    });

    const borrachariaTransnet = ativos.filter((item) => isBorrachariaLocal(item.localizacao));
    const transnetRows = borrachariaTransnet.map((ativo) => {
      const pneu = normalizarPneu(ativo.numero_fogo);
      const estoque = latestEstoque.get(pneu) || null;
      const auditorias = auditoriaPorPneu.get(pneu) || [];
      const auditoria = auditorias[0] || null;

      let status = "NAO LOCALIZADO";
      let detalhe = "Nao consta nem no estoque fisico nem na auditoria.";

      if (estoque) {
        status = "NO ESTOQUE";
        detalhe = `Consta no estoque fisico (${estoque.ficha_estoque || ultimaFicha}).`;
      } else if (auditoria) {
        status = "EM CARRO";
        detalhe = `Aparece na auditoria do carro ${auditoria.prefixo} na posicao ${auditoria.posicao}.`;
      }

      return {
        secao: "transnet",
        key: `transnet-${pneu}`,
        pneu,
        data_estoque: ativo.updated_at || ativo.created_at || null,
        marca: ativo.marca || "",
        situacao_inove: estoque?.situacao || "",
        status,
        local: `${ativo.localizacao || "BORRACHARIA"}${ativo.posicao ? ` - ${ativo.posicao}` : ""}`,
        auditoria_texto: auditoria ? `${auditoria.prefixo} - ${auditoria.posicao}` : "Nao aparece na auditoria",
        ficha_estoque: estoque?.ficha_estoque || "",
        detalhe,
      };
    });

    const recapadoraRows = ativos
      .filter((item) => isRecapadoraLocal(item.localizacao))
      .map((ativo) => {
        const pneu = normalizarPneu(ativo.numero_fogo);
        const estoque = latestEstoque.get(pneu) || null;
        const inativo = inativosPorPneu.get(pneu) || null;
        const auditoria = (auditoriaPorPneu.get(pneu) || [])[0] || null;
        const conserto = consertoPorPneu.get(pneu) || null;
        const evidencias = [];
        if (estoque) {
          evidencias.push({
            tipo: "EM ESTOQUE FISICO",
            data: estoque.created_at,
            texto: `Ficha ${estoque.ficha_estoque || ultimaFicha}${estoque.situacao ? ` - ${estoque.situacao}` : ""}`,
          });
        }
        if (auditoria) {
          evidencias.push({
            tipo: "EM AUDITORIA",
            data: auditoria.data,
            texto: `Carro ${auditoria.prefixo} - ${auditoria.posicao}`,
          });
        }
        evidencias.sort((a, b) => toTime(b.data) - toTime(a.data));
        const ultimaEvidencia = evidencias[0] || null;

        let status = "SO TRANSNET";
        let local = "Nao aparece em auditoria nem estoque fisico";
        if (inativo) {
          status = "SUCATA";
          local = inativo.motivo || "Inativo no TransNet";
        } else if (ultimaEvidencia) {
          status = ultimaEvidencia.tipo;
          local = ultimaEvidencia.texto;
        }

        return {
          secao: "recapadora",
          key: `recapadora-${pneu}`,
          pneu,
          local_transnet: `${ativo.localizacao || "EXTERNO"}${ativo.posicao ? ` - ${ativo.posicao}` : ""}`,
          ficha_estoque: estoque?.ficha_estoque || ultimaFicha,
          data_estoque: estoque?.created_at || null,
          ultima_referencia_em: ultimaEvidencia?.data || null,
          marca: estoque?.marca || ativo?.marca || "",
          situacao_inove: estoque?.situacao || "",
          status,
          local,
          auditoria_texto: auditoria ? `${auditoria.prefixo} - ${auditoria.posicao}` : "Nao aparece na auditoria",
          ficha_conserto: conserto?.ficha_conserto || "",
          status_conserto: conserto?.status || "",
          origem_conserto: conserto?.situacao_origem || "",
        };
      });

    const sucataRows = [...inativosPorPneu.entries()].map(([pneu, inativo]) => {
      const estoque = latestEstoque.get(pneu) || null;
      const auditorias = auditoriaPorPneu.get(pneu) || [];
      const auditoria = auditorias[0] || null;

      // Cruzamentos possiveis: so com fontes do INOVE. TransNet x TransNet
      // (alocacao / ativos) e impossivel — um pneu nunca esta inativo e ativo
      // simultaneamente no proprio TransNet.
      let status = "SO SUCATA";
      let local = inativo?.motivo || "Inativo no TransNet";

      if (estoque) {
        status = "EM ESTOQUE FISICO";
        local = `Ficha ${estoque.ficha_estoque || ultimaFicha}${estoque.situacao ? ` - ${estoque.situacao}` : ""}`;
      } else if (auditoria) {
        status = "EM AUDITORIA";
        local = `Carro ${auditoria.prefixo} - ${auditoria.posicao}`;
      }

      return {
        secao: "sucata",
        key: `sucata-${pneu}`,
        pneu,
        motivo: inativo?.motivo || "",
        marca: estoque?.marca || "",
        ficha_estoque: estoque?.ficha_estoque || "",
        situacao_inove: estoque?.situacao || "",
        status,
        local,
        auditoria_texto: auditoria ? `${auditoria.prefixo} - ${auditoria.posicao}` : "Nao aparece na auditoria",
      };
    });

    return {
      fisico: fisicoRows.sort((a, b) => String(a.pneu).localeCompare(String(b.pneu), "pt-BR", { numeric: true })),
      transnet: transnetRows.sort((a, b) => String(a.pneu).localeCompare(String(b.pneu), "pt-BR", { numeric: true })),
      recapadora: recapadoraRows.sort((a, b) => String(a.pneu).localeCompare(String(b.pneu), "pt-BR", { numeric: true })),
      sucata: sucataRows.sort((a, b) => String(a.pneu).localeCompare(String(b.pneu), "pt-BR", { numeric: true })),
    };
  }, [estoqueRows, alocacoes, ativos, inativos, consertos, auditoriaPorPneu]);

  const estoqueFisicoFiltrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return estoqueComparado.fisico.filter((row) => {
      if (q) {
        const hay = [row.pneu, row.ficha_estoque, row.marca, row.situacao_inove, row.local, row.status, row.auditoria_texto].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filtroStatus && row.status !== filtroStatus) return false;
      if (filtroComparacao === "CORRETO" && !["BORRACHARIA", "SUCATA OK"].includes(row.status)) return false;
      if (filtroComparacao === "INCORRETO" && ["BORRACHARIA", "SUCATA OK"].includes(row.status)) return false;
      if (filtroDataAuditoria) {
        if (!row.data_estoque) return false;
        const inicio = new Date(`${filtroDataAuditoria}T00:00:00`);
        const dataEstoque = new Date(row.data_estoque);
        if (Number.isNaN(dataEstoque.getTime()) || dataEstoque < inicio) return false;
      }
      return true;
    });
  }, [estoqueComparado, busca, filtroStatus, filtroComparacao, filtroDataAuditoria]);

  const estoqueTransnetFiltrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return estoqueComparado.transnet.filter((row) => {
      if (q) {
        const hay = [row.pneu, row.marca, row.local, row.status, row.auditoria_texto, row.detalhe, row.ficha_estoque].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filtroStatus && row.status !== filtroStatus) return false;
      if (filtroComparacao === "CORRETO" && row.status !== "NO ESTOQUE") return false;
      if (filtroComparacao === "INCORRETO" && row.status === "NO ESTOQUE") return false;
      return true;
    });
  }, [estoqueComparado, busca, filtroStatus, filtroComparacao]);

  const recapadoraFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return estoqueComparado.recapadora.filter((row) => {
      if (q) {
        const hay = [
          row.pneu,
          row.ficha_estoque,
          row.ficha_conserto,
          row.marca,
          row.situacao_inove,
          row.status,
          row.local,
          row.auditoria_texto,
          row.status_conserto,
          row.origem_conserto,
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filtroStatus && row.status !== filtroStatus) return false;
      if (filtroComparacao === "CORRETO" && row.status !== "SO TRANSNET") return false;
      if (filtroComparacao === "INCORRETO" && row.status === "SO TRANSNET") return false;
      if (filtroDataAuditoria) {
        const dataBase = row.ultima_referencia_em || row.data_estoque;
        if (!dataBase) return false;
        const inicio = new Date(`${filtroDataAuditoria}T00:00:00`);
        const dataEstoque = new Date(dataBase);
        if (Number.isNaN(dataEstoque.getTime()) || dataEstoque < inicio) return false;
      }
      return true;
    });
  }, [estoqueComparado, busca, filtroStatus, filtroComparacao, filtroDataAuditoria]);

  const sucataFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return estoqueComparado.sucata.filter((row) => {
      if (q) {
        const hay = [
          row.pneu,
          row.motivo,
          row.marca,
          row.ficha_estoque,
          row.situacao_inove,
          row.status,
          row.local,
          row.auditoria_texto,
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filtroStatus && row.status !== filtroStatus) return false;
      if (filtroComparacao === "CORRETO" && row.status !== "SO SUCATA") return false;
      if (filtroComparacao === "INCORRETO" && row.status === "SO SUCATA") return false;
      return true;
    });
  }, [estoqueComparado, busca, filtroStatus, filtroComparacao]);

  const estoqueKpis = useMemo(() => {
    return {
      fisicoTotal: estoqueComparado.fisico.length,
      fisicoBorracharia: estoqueComparado.fisico.filter((item) => ["BORRACHARIA", "SUCATA OK"].includes(item.status)).length,
      fisicoDivergente: estoqueComparado.fisico.filter((item) => !["BORRACHARIA", "SUCATA OK"].includes(item.status)).length,
      transnetTotal: estoqueComparado.transnet.length,
      transnetNoEstoque: estoqueComparado.transnet.filter((item) => item.status === "NO ESTOQUE").length,
      transnetEmCarro: estoqueComparado.transnet.filter((item) => item.status === "EM CARRO").length,
      transnetNaoLocalizado: estoqueComparado.transnet.filter((item) => item.status === "NAO LOCALIZADO").length,
    };
  }, [estoqueComparado]);

  const recapadoraKpis = useMemo(() => {
    return {
      total: estoqueComparado.recapadora.length,
      soTransnet: estoqueComparado.recapadora.filter((item) => item.status === "SO TRANSNET").length,
      auditoria: estoqueComparado.recapadora.filter((item) => item.status === "EM AUDITORIA").length,
      estoqueFisico: estoqueComparado.recapadora.filter((item) => item.status === "EM ESTOQUE FISICO").length,
      sucata: estoqueComparado.recapadora.filter((item) => item.status === "SUCATA").length,
      outros: estoqueComparado.recapadora.filter((item) => !["SO TRANSNET", "EM AUDITORIA", "EM ESTOQUE FISICO", "SUCATA"].includes(item.status)).length,
    };
  }, [estoqueComparado]);

  function onSortTabela(key) {
    setOrdenacaoTabela((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key.includes("data") ? "desc" : "asc" }
    );
  }

  function ordenarLinhas(rows) {
    const { key, direction } = ordenacaoTabela || {};
    if (!key) return rows;
    const factor = direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (["data_estoque", "ultima_referencia_em"].includes(key)) {
        return (toTime(a[key]) - toTime(b[key])) * factor;
      }
      return normalizeSortValue(a[key]).localeCompare(normalizeSortValue(b[key]), "pt-BR", {
        numeric: true,
        sensitivity: "base",
      }) * factor;
    });
  }

  const estoqueFisicoOrdenado = useMemo(() => ordenarLinhas(estoqueFisicoFiltrado), [estoqueFisicoFiltrado, ordenacaoTabela]);
  const estoqueTransnetOrdenado = useMemo(() => ordenarLinhas(estoqueTransnetFiltrado), [estoqueTransnetFiltrado, ordenacaoTabela]);
  const recapadoraOrdenada = useMemo(() => ordenarLinhas(recapadoraFiltrada), [recapadoraFiltrada, ordenacaoTabela]);
  const sucataOrdenada = useMemo(() => ordenarLinhas(sucataFiltrada), [sucataFiltrada, ordenacaoTabela]);

  const sucataKpis = useMemo(() => {
    return {
      total: estoqueComparado.sucata.length,
      somenteSucata: estoqueComparado.sucata.filter((item) => item.status === "SO SUCATA").length,
      estoqueFisico: estoqueComparado.sucata.filter((item) => item.status === "EM ESTOQUE FISICO").length,
      auditoria: estoqueComparado.sucata.filter((item) => item.status === "EM AUDITORIA").length,
      carro: estoqueComparado.sucata.filter((item) => item.status === "EM CARRO").length,
      outros: estoqueComparado.sucata.filter((item) => !["SO SUCATA", "EM ESTOQUE FISICO", "EM AUDITORIA", "EM CARRO"].includes(item.status)).length,
    };
  }, [estoqueComparado]);

  function togglePrefixoSelecionado(prefixo) {
    setPrefixosSelecionados((current) =>
      current.includes(prefixo) ? current.filter((item) => item !== prefixo) : [...current, prefixo]
    );
  }

  const resultadoBuscaFogo = useMemo(() => {
    const pneu = normalizarPneu(buscaFogo);
    if (!pneu) return null;

    const ultimaFichaBusca = estoqueRows.find((item) => item.ficha_estoque)?.ficha_estoque || "";
    const estoqueBusca = (ultimaFichaBusca
      ? estoqueRows.filter((item) => item.ficha_estoque === ultimaFichaBusca)
      : estoqueRows
    ).find((item) => normalizarPneu(item.numero_fogo || item.numero_pneu) === pneu);
    const auditoriasBusca = auditoriaPorPneu.get(pneu) || [];

    const matchAloc = alocacoes.find((item) => normalizarPneu(item.numero_fogo) === pneu);
    if (matchAloc) {
      return {
        status: "TRANSNET",
        texto: `Prefixo ${matchAloc.prefixo} - ${matchAloc.posicao}`,
        detalhe: "Pneu alocado em veiculo no snapshot TransNet.",
        cor: "#2563eb",
      };
    }

    const matchInativo = inativos.find((item) => normalizarPneu(item.numero_fogo) === pneu);
    if (matchInativo) {
      return {
        status: "SUCATA",
        texto: "Pneu inativo / sucata",
        detalhe: [
          matchInativo.motivo || "Registrado como inativo no TransNet.",
          estoqueBusca ? `Fisico: ficha ${estoqueBusca.ficha_estoque || ultimaFichaBusca} - ${estoqueBusca.situacao || "sem situacao"}.` : "",
          auditoriasBusca[0] ? `Auditoria: carro ${auditoriasBusca[0].prefixo} - ${auditoriasBusca[0].posicao}.` : "",
        ].filter(Boolean).join(" "),
        cor: "#dc2626",
      };
    }

    const matchAtivo = ativos.find((item) => normalizarPneu(item.numero_fogo) === pneu);
    if (matchAtivo) {
      const local = matchAtivo.localizacao || "Local nao informado";
      const posicao = matchAtivo.posicao ? ` - ${matchAtivo.posicao}` : "";
      const isVeiculo = /^\d{3}-[0-9A-Z]+$/i.test(local);
      return {
        status: isVeiculo ? "ATIVO" : "ESTOQUE",
        texto: `${local}${posicao}`,
        detalhe: [matchAtivo.marca, matchAtivo.medida].filter(Boolean).join(" - ") || "Pneu ativo no TransNet.",
        cor: isVeiculo ? "#16a34a" : "#2563eb",
      };
    }

    if (estoqueBusca) {
      const situacao = String(estoqueBusca.situacao || "").toUpperCase();
      const ehSucata = situacao.includes("SUCATA");
      return {
        status: ehSucata ? "SUCATA FISICA" : "ESTOQUE FISICO",
        texto: `Ficha ${estoqueBusca.ficha_estoque || ultimaFichaBusca || "sem ficha"}`,
        detalhe: [
          estoqueBusca.situacao ? `Situacao: ${estoqueBusca.situacao}.` : "",
          estoqueBusca.marca ? `Marca: ${estoqueBusca.marca}.` : "",
          auditoriasBusca[0] ? `Auditoria: carro ${auditoriasBusca[0].prefixo} - ${auditoriasBusca[0].posicao}.` : "",
        ].filter(Boolean).join(" "),
        cor: ehSucata ? "#dc2626" : "#7c3aed",
      };
    }

    if (auditoriasBusca[0]) {
      return {
        status: "AUDITORIA",
        texto: `Carro ${auditoriasBusca[0].prefixo} - ${auditoriasBusca[0].posicao}`,
        detalhe: "Encontrado na auditoria, sem localizacao atual nas bases TransNet carregadas.",
        cor: "#475569",
      };
    }

    return {
      status: "NAO ENCONTRADO",
      texto: "Nao localizado nas bases carregadas",
      detalhe: "Verifique se o numero de fogo esta correto.",
      cor: "#ea580c",
    };
  }, [alocacoes, ativos, inativos, buscaFogo, estoqueRows, auditoriaPorPneu]);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-100 p-3">
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-800">
          <FaCarSide className="mr-2 inline text-orange-600" />
          Controle de Pneus — Central
        </h1>
        <span className="text-xs text-slate-500">
          {ultimaAtualizacao ? `Snapshot TransNet: ${fmtData(ultimaAtualizacao)}` : "Nenhum snapshot do TransNet ainda"}
        </span>
        <button
          type="button"
          onClick={atualizarPagina}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          <FaSyncAlt />
          Atualizar pagina
        </button>
        <button
          onClick={dispararBot}
          disabled={disparando}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-1.5 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
        >
          <FaSyncAlt className={disparando ? "animate-spin" : ""} />
          {disparando ? "Disparado, aguarde ~3min" : "Atualizar base TransNet"}
        </button>
      </header>

      <section className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAbaAtiva("veiculos")}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${abaAtiva === "veiculos" ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-300"}`}
        >
          Veículos
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva("estoque")}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${abaAtiva === "estoque" ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-300"}`}
        >
          Estoque
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva("recapadora")}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${abaAtiva === "recapadora" ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-300"}`}
        >
          Recapadora
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva("sucata")}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${abaAtiva === "sucata" ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-300"}`}
        >
          Sucata TransNet
        </button>
      </section>

      <section className="mb-3 flex flex-wrap gap-2">
        {abaAtiva === "veiculos" ? (
          <>
            <KpiCard label="Base TransNet" value={kpis.base} cor="#475569" />
            <KpiCard label={`OK · ${kpis.okPct}%`} value={kpis.ok} cor="#16a34a" />
            <KpiCard label="Sucata" value={kpis.sucata} cor="#dc2626" />
            <KpiCard label="Outro veículo" value={kpis.outro} cor="#ca8a04" />
            <KpiCard label="Não existe" value={kpis.naoExiste} cor="#ea580c" />
            <KpiCard label="Estoque" value={kpis.estoque} cor="#2563eb" />
          </>
        ) : abaAtiva === "estoque" ? (
          abaEstoqueAtiva === "fisico" ? (
            <>
              <KpiCard label="Fisico estoque" value={estoqueKpis.fisicoTotal} cor="#475569" />
              <KpiCard label="Fisico ok" value={estoqueKpis.fisicoBorracharia} cor="#7c3aed" />
              <KpiCard label="Fisico divergente" value={estoqueKpis.fisicoDivergente} cor="#dc2626" />
            </>
          ) : (
            <>
              <KpiCard label="TransNet borracharia" value={estoqueKpis.transnetTotal} cor="#2563eb" />
              <KpiCard label="TransNet no estoque" value={estoqueKpis.transnetNoEstoque} cor="#16a34a" />
              <KpiCard label="TransNet no carro" value={estoqueKpis.transnetEmCarro} cor="#ca8a04" />
              <KpiCard label="TransNet nao localizado" value={estoqueKpis.transnetNaoLocalizado} cor="#ea580c" />
            </>
          )
        ) : abaAtiva === "recapadora" ? (
          <>
            <KpiCard label="Na recapadora" value={recapadoraKpis.total} cor="#475569" />
            <KpiCard label="So TransNet" value={recapadoraKpis.soTransnet} cor="#16a34a" />
            <KpiCard label="Em auditoria" value={recapadoraKpis.auditoria} cor="#2563eb" />
            <KpiCard label="Em estoque fisico" value={recapadoraKpis.estoqueFisico} cor="#ca8a04" />
            <KpiCard label="Sucata" value={recapadoraKpis.sucata} cor="#dc2626" />
            <KpiCard label="Outros" value={recapadoraKpis.outros} cor="#7c3aed" />
          </>
        ) : (
          <>
            <KpiCard label="Total sucata" value={sucataKpis.total} cor="#475569" />
            <KpiCard label="So sucata" value={sucataKpis.somenteSucata} cor="#dc2626" />
            <KpiCard label="Em estoque fisico" value={sucataKpis.estoqueFisico} cor="#16a34a" />
            <KpiCard label="Em auditoria" value={sucataKpis.auditoria} cor="#2563eb" />
            <KpiCard label="Em carro" value={sucataKpis.carro} cor="#ca8a04" />
            <KpiCard label="Outros locais" value={sucataKpis.outros} cor="#7c3aed" />
          </>
        )}
        <div className="min-w-[340px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Buscar número de fogo</div>
          <div className="relative">
            <FaSearch className="absolute left-2 top-2.5 text-xs text-slate-400" />
            <input
              value={buscaFogo}
              onChange={(event) => setBuscaFogo(event.target.value)}
              placeholder="Ex.: 508013"
              className="w-full rounded-lg border border-slate-300 py-1.5 pl-7 pr-2 text-sm"
            />
          </div>
          {resultadoBuscaFogo ? (
            <div className="mt-2 rounded-md border px-2 py-1.5" style={{ borderColor: resultadoBuscaFogo.cor }}>
              <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: resultadoBuscaFogo.cor }}>
                {resultadoBuscaFogo.status}
              </div>
              <div className="text-sm font-semibold text-slate-800">{resultadoBuscaFogo.texto}</div>
              <div className="text-xs text-slate-500">{resultadoBuscaFogo.detalhe}</div>
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-400">Digite um número de fogo para localizar o pneu.</div>
          )}
        </div>
      </section>

      <section className="mb-2 flex items-center gap-2">
        <div className="relative">
          <FaSearch className="absolute left-2 top-2.5 text-xs text-slate-400" />
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar ficha, prefixo, auditor..."
            className="w-72 rounded-lg border border-slate-300 py-1.5 pl-7 pr-2 text-sm"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(event) => setFiltroStatus(event.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Todos os status</option>
          {abaAtiva === "veiculos" ? (
            <>
              <option value="OK">OK</option>
              <option value="DUPLICIDADE">DUPLICIDADE</option>
              <option value="SUCATA">SUCATA</option>
              <option value="OUTRO VEICULO">OUTRO VEICULO</option>
              <option value="INCORRETO">INCORRETO</option>
              <option value="NAO EXISTE">NAO EXISTE</option>
              <option value="ESTOQUE">ESTOQUE</option>
            </>
          ) : abaAtiva === "sucata" ? (
            <>
              <option value="SO SUCATA">SO SUCATA</option>
              <option value="EM ESTOQUE FISICO">EM ESTOQUE FISICO</option>
              <option value="EM AUDITORIA">EM AUDITORIA</option>
              <option value="EM CARRO">EM CARRO</option>
              <option value="EM BORRACHARIA">EM BORRACHARIA</option>
              <option value="OUTRO LOCAL">OUTRO LOCAL</option>
            </>
          ) : abaAtiva === "recapadora" ? (
            <>
              <option value="SO TRANSNET">SO TRANSNET</option>
              <option value="EM AUDITORIA">EM AUDITORIA</option>
              <option value="EM ESTOQUE FISICO">EM ESTOQUE FISICO</option>
              <option value="SUCATA">SUCATA</option>
              <option value="OUTRO LOCAL">OUTRO LOCAL</option>
            </>
          ) : (
            <>
              <option value="BORRACHARIA">BORRACHARIA</option>
              <option value="EM CARRO">EM CARRO</option>
              <option value="OUTRO LOCAL">OUTRO LOCAL</option>
              <option value="SUCATA">SUCATA</option>
              <option value="SUCATA OK">SUCATA OK</option>
              <option value="NO ESTOQUE">NO ESTOQUE</option>
              <option value="NAO LOCALIZADO">NAO LOCALIZADO</option>
            </>
          )}
        </select>
        <select
          value={filtroComparacao}
          onChange={(event) => setFiltroComparacao(event.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Todos resultados</option>
          <option value="CORRETO">Correto</option>
          <option value="INCORRETO">Incorreto</option>
        </select>
        <button
          type="button"
          onClick={() => setSomenteSelecionados((current) => !current)}
          className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${somenteSelecionados ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-600"}`}
        >
          {somenteSelecionados ? "Manual ligado" : "Filtro manual"}
        </button>
        <input
          type="date"
          value={filtroDataAuditoria}
          onChange={(event) => setFiltroDataAuditoria(event.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          title="Auditorias a partir desta data"
        />
        <span className="ml-auto text-xs text-slate-500">
          Exibindo {abaAtiva === "veiculos"
            ? filtradas.length
            : abaAtiva === "estoque"
              ? (abaEstoqueAtiva === "fisico" ? estoqueFisicoFiltrado.length : estoqueTransnetFiltrado.length)
              : abaAtiva === "recapadora"
                ? recapadoraFiltrada.length
                : sucataFiltrada.length} / {abaAtiva === "veiculos"
            ? linhasBase.length
            : abaAtiva === "estoque"
              ? (abaEstoqueAtiva === "fisico" ? estoqueComparado.fisico.length : estoqueComparado.transnet.length)
              : abaAtiva === "recapadora"
                ? estoqueComparado.recapadora.length
                : estoqueComparado.sucata.length}
        </span>
      </section>

      {carregando ? (
        <div className="grid place-items-center py-16 text-slate-500">Carregando…</div>
      ) : abaAtiva === "veiculos" ? (
        <div className="max-h-[calc(100vh-260px)] overflow-auto rounded-lg border border-slate-200 bg-white shadow">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 shadow-sm">
              <tr>
                <th className="px-2 py-2 text-center">Flag</th>
                <th className="px-2 py-2 text-left">Data</th>
                <th className="px-2 py-2 text-left">Ficha</th>
                <th className="px-2 py-2 text-left">Prefixo</th>
                {POSICOES.map((posicao) => (
                  <th key={posicao} className="px-2 py-2 text-center">
                    {posicao}
                  </th>
                ))}
                <th className="px-2 py-2 text-center">Troca pós?</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={4 + POSICOES.length + 1} className="py-8 text-center text-slate-400">
                    Nenhum prefixo na base TransNet.
                  </td>
                </tr>
              ) : null}

              {filtradas.map((row) => (
                <tr key={row.grupo_id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => togglePrefixoSelecionado(row.prefixo)}
                      className={`rounded px-2 py-1 text-xs font-bold ${prefixosSelecionados.includes(row.prefixo) ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}
                      title="Selecionar prefixo no filtro manual"
                    >
                      ⚑
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-slate-600">{fmtData(row.auditoria_em)}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-700">{row.ficha || "—"}</td>
                  <td className={`px-2 py-1.5 font-bold ${POSICOES.some((posicao) => {
                    const status = row.posicoes[posicao]?.status;
                    return status && status !== "OK";
                  }) ? "text-red-600" : "text-slate-900"}`}>{row.prefixo}</td>
                  {POSICOES.map((posicao) => (
                    <td key={posicao} className="px-1 py-1">
                      <Celula
                        base={row.posicoes[posicao]?.base}
                        aud={row.posicoes[posicao]?.aud}
                        status={row.posicoes[posicao]?.status}
                        trocaApos={row.posicoes[posicao]?.trocaApos}
                        detalheStatus={row.posicoes[posicao]?.detalheStatus}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center">
                    {row.troca ? (
                      <div className="space-y-1 text-left">
                        {row.trocasDetalhes.map((item) => (
                          <div key={`${row.grupo_id}-${item.posicao}-${item.data || "sem-data"}`} className="rounded bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                            {item.posicao} · {fmtDataCurta(item.data)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : abaAtiva === "estoque" ? (
        <div className="space-y-3">
          <section className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAbaEstoqueAtiva("fisico")}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${abaEstoqueAtiva === "fisico" ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-300"}`}
            >
              Fisico x TransNet
            </button>
            <button
              type="button"
              onClick={() => setAbaEstoqueAtiva("transnet")}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${abaEstoqueAtiva === "transnet" ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-300"}`}
            >
              TransNet borracharia
            </button>
            <button
              type="button"
              onClick={() => { setEtiquetaBusca(""); setEtiquetaSelecionadas(new Set()); setEtiquetaModalOpen(true); }}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <FaBarcode />
              Gerador de etiqueta
            </button>
          </section>

          {abaEstoqueAtiva === "fisico" ? (
            <div className="rounded-lg border border-slate-200 bg-white shadow">
              <div className="border-b border-slate-200 px-3 py-2">
                <div className="text-sm font-bold text-slate-800">Fogos na borracharia pelo fisico x TransNet</div>
                <div className="text-xs text-slate-500">Baseado na ultima ficha de estoque fisico.</div>
              </div>
              <div className="max-h-[calc(100vh-340px)] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 shadow-sm">
                    <tr>
                      <th className="px-2 py-2 text-left"><SortableHeader label="Data" sortKey="data_estoque" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                      <th className="px-2 py-2 text-left"><SortableHeader label="Ficha" sortKey="ficha_estoque" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                      <th className="px-2 py-2 text-left"><SortableHeader label="Numero de fogo" sortKey="pneu" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                      <th className="px-2 py-2 text-left"><SortableHeader label="Marca" sortKey="marca" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                      <th className="px-2 py-2 text-left"><SortableHeader label="Situacao fisica" sortKey="situacao_inove" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                      <th className="px-2 py-2 text-left"><SortableHeader label="Status TransNet" sortKey="status" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                      <th className="px-2 py-2 text-left"><SortableHeader label="Onde esta no TransNet" sortKey="local" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                      <th className="px-2 py-2 text-left"><SortableHeader label="Auditoria" sortKey="auditoria_texto" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {estoqueFisicoOrdenado.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          Nenhum fogo do estoque fisico encontrado.
                        </td>
                      </tr>
                    ) : null}
                    {estoqueFisicoOrdenado.map((row) => (
                      <tr key={row.key} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="whitespace-nowrap px-2 py-2 text-slate-600">{fmtData(row.data_estoque)}</td>
                        <td className="px-2 py-2 font-mono text-slate-700">{row.ficha_estoque || "-"}</td>
                        <td className="px-2 py-2 font-mono text-[13px] font-bold text-slate-900">{row.pneu}</td>
                        <td className="px-2 py-2 text-slate-700">{row.marca || "-"}</td>
                        <td className="px-2 py-2 text-slate-700">{row.situacao_inove || "-"}</td>
                        <td className="px-2 py-2">
                          <span className="rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: row.status === "BORRACHARIA" ? "#7c3aed" : row.status === "SUCATA OK" ? "#16a34a" : row.status === "EM CARRO" ? "#ca8a04" : row.status === "OUTRO LOCAL" ? "#2563eb" : row.status === "SUCATA" ? "#dc2626" : "#ea580c" }}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-slate-700">{row.local}</td>
                        <td className="px-2 py-2 text-slate-700">{row.auditoria_texto}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white shadow">
              <div className="border-b border-slate-200 px-3 py-2">
                <div className="text-sm font-bold text-slate-800">Fogos que constam no TransNet como borracharia</div>
                <div className="text-xs text-slate-500">Aqui mostramos se pelo fisico eles estao no estoque, em algum carro na auditoria ou nao aparecem em lugar nenhum.</div>
              </div>
              <div className="max-h-[calc(100vh-340px)] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 shadow-sm">
                    <tr>
                      <th className="px-2 py-2 text-left"><SortableHeader label="Numero de fogo" sortKey="pneu" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                      <th className="px-2 py-2 text-left"><SortableHeader label="Marca" sortKey="marca" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                      <th className="px-2 py-2 text-left"><SortableHeader label="Local TransNet" sortKey="local" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                      <th className="px-2 py-2 text-left"><SortableHeader label="Status confronto" sortKey="status" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                      <th className="px-2 py-2 text-left"><SortableHeader label="Estoque fisico" sortKey="ficha_estoque" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                      <th className="px-2 py-2 text-left"><SortableHeader label="Auditoria" sortKey="auditoria_texto" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                      <th className="px-2 py-2 text-left"><SortableHeader label="Detalhe" sortKey="detalhe" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {estoqueTransnetOrdenado.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          Nenhum fogo da borracharia no TransNet encontrado.
                        </td>
                      </tr>
                    ) : null}
                    {estoqueTransnetOrdenado.map((row) => (
                      <tr key={row.key} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-2 py-2 font-mono text-[13px] font-bold text-slate-900">{row.pneu}</td>
                        <td className="px-2 py-2 text-slate-700">{row.marca || "-"}</td>
                        <td className="px-2 py-2 text-slate-700">{row.local}</td>
                        <td className="px-2 py-2">
                          <span className="rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: row.status === "NO ESTOQUE" ? "#16a34a" : row.status === "EM CARRO" ? "#ca8a04" : "#ea580c" }}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-2 py-2 font-mono text-slate-700">{row.ficha_estoque || "-"}</td>
                        <td className="px-2 py-2 text-slate-700">{row.auditoria_texto}</td>
                        <td className="px-2 py-2 text-slate-700">{row.detalhe}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : abaAtiva === "recapadora" ? (
        <div className="rounded-lg border border-slate-200 bg-white shadow">
          <div className="border-b border-slate-200 px-3 py-2">
            <div className="text-sm font-bold text-slate-800">Pneus na recapadora</div>
            <div className="text-xs text-slate-500">Mostra os pneus da ultima ficha fisica com situacao ligada a recapagem e onde eles aparecem no TransNet.</div>
          </div>
          <div className="max-h-[calc(100vh-340px)] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 shadow-sm">
                <tr>
                  <th className="px-2 py-2 text-left"><SortableHeader label="Ultima data" sortKey="ultima_referencia_em" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                  <th className="px-2 py-2 text-left"><SortableHeader label="Local TransNet" sortKey="local_transnet" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                  <th className="px-2 py-2 text-left"><SortableHeader label="Numero de fogo" sortKey="pneu" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                  <th className="px-2 py-2 text-left"><SortableHeader label="Marca" sortKey="marca" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                  <th className="px-2 py-2 text-left"><SortableHeader label="Situacao fisica" sortKey="situacao_inove" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                  <th className="px-2 py-2 text-left"><SortableHeader label="Status confronto" sortKey="status" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                  <th className="px-2 py-2 text-left"><SortableHeader label="Onde aparece" sortKey="local" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                  <th className="px-2 py-2 text-left"><SortableHeader label="Auditoria" sortKey="auditoria_texto" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                  <th className="px-2 py-2 text-left"><SortableHeader label="Ficha conserto" sortKey="ficha_conserto" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                  <th className="px-2 py-2 text-left"><SortableHeader label="Status conserto" sortKey="status_conserto" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                </tr>
              </thead>
              <tbody>
                {recapadoraOrdenada.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Nenhum pneu da recapadora encontrado.
                    </td>
                  </tr>
                ) : null}
                {recapadoraOrdenada.map((row) => (
                  <tr key={row.key} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-2 py-2 text-slate-600">{fmtData(row.ultima_referencia_em || row.data_estoque)}</td>
                    <td className="px-2 py-2 text-slate-700">{row.local_transnet || "-"}</td>
                    <td className="px-2 py-2 font-mono text-[13px] font-bold text-slate-900">{row.pneu}</td>
                    <td className="px-2 py-2 text-slate-700">{row.marca || "-"}</td>
                    <td className="px-2 py-2 text-slate-700">{row.situacao_inove || "-"}</td>
                    <td className="px-2 py-2">
                      <span className="rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: row.status === "SO TRANSNET" ? "#16a34a" : row.status === "EM AUDITORIA" ? "#2563eb" : row.status === "EM ESTOQUE FISICO" ? "#ca8a04" : row.status === "SUCATA" ? "#dc2626" : "#7c3aed" }}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-slate-700">{row.local}</td>
                    <td className="px-2 py-2 text-slate-700">{row.auditoria_texto}</td>
                    <td className="px-2 py-2 font-mono text-slate-700">{row.ficha_conserto || "-"}</td>
                    <td className="px-2 py-2 text-slate-700">{row.status_conserto || row.origem_conserto || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white shadow">
          <div className="border-b border-slate-200 px-3 py-2">
            <div className="text-sm font-bold text-slate-800">Fogos em sucata no TransNet</div>
            <div className="text-xs text-slate-500">Lista todos os fogos marcados como inativos/sucata e mostra se eles tambem aparecem em outras bases.</div>
          </div>
          <div className="max-h-[calc(100vh-340px)] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 shadow-sm">
                <tr>
                  <th className="px-2 py-2 text-left"><SortableHeader label="Numero de fogo" sortKey="pneu" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                  <th className="px-2 py-2 text-left"><SortableHeader label="Motivo" sortKey="motivo" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                  <th className="px-2 py-2 text-left"><SortableHeader label="Marca" sortKey="marca" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                  <th className="px-2 py-2 text-left"><SortableHeader label="Status confronto" sortKey="status" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                  <th className="px-2 py-2 text-left"><SortableHeader label="Onde aparece" sortKey="local" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                  <th className="px-2 py-2 text-left"><SortableHeader label="Ficha estoque" sortKey="ficha_estoque" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                  <th className="px-2 py-2 text-left"><SortableHeader label="Situacao fisica" sortKey="situacao_inove" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                  <th className="px-2 py-2 text-left"><SortableHeader label="Auditoria" sortKey="auditoria_texto" sort={ordenacaoTabela} onSort={onSortTabela} /></th>
                </tr>
              </thead>
              <tbody>
                {sucataOrdenada.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Nenhum fogo em sucata encontrado.
                    </td>
                  </tr>
                ) : null}
                {sucataOrdenada.map((row) => (
                  <tr key={row.key} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-2 py-2 font-mono text-[13px] font-bold text-slate-900">{row.pneu}</td>
                    <td className="px-2 py-2 text-slate-700">{row.motivo || "-"}</td>
                    <td className="px-2 py-2 text-slate-700">{row.marca || "-"}</td>
                    <td className="px-2 py-2">
                      <span
                        className="rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
                        style={{
                          background:
                            row.status === "SO SUCATA" ? "#dc2626" :
                            row.status === "EM ESTOQUE FISICO" ? "#16a34a" :
                            row.status === "EM AUDITORIA" ? "#2563eb" :
                            row.status === "EM CARRO" ? "#ca8a04" :
                            row.status === "EM BORRACHARIA" ? "#7c3aed" :
                            "#475569"
                        }}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-slate-700">{row.local}</td>
                    <td className="px-2 py-2 font-mono text-slate-700">{row.ficha_estoque || "-"}</td>
                    <td className="px-2 py-2 text-slate-700">{row.situacao_inove || "-"}</td>
                    <td className="px-2 py-2 text-slate-700">{row.auditoria_texto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-2 text-[10px] text-slate-400">
        <span className="font-bold">Base</span> = TransNet · <span className="font-bold">Aud</span> = auditoria INOVE ·
        Status: OK = bate · SUCATA = pneu inativo · OUTRO VEICULO = pneu alocado noutro carro · NAO EXISTE = não achado ·
        ESTOQUE = ativo sem alocação.
      </p>

      {etiquetaModalOpen ? (() => {
        const buscaNorm = String(etiquetaBusca || "").replace(/\D/g, "");
        const fonteRows = estoqueFisicoFiltrado || [];
        const matches = buscaNorm
          ? fonteRows.filter((r) => String(r.pneu || "").replace(/\D/g, "").includes(buscaNorm)).slice(0, 12)
          : [];
        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">PCM · Estoque</div>
                  <h2 className="text-lg font-semibold text-slate-900">Gerador de etiquetas</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEtiquetaModalOpen(false)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <FaTimes />
                </button>
              </div>
              <div className="space-y-4 overflow-y-auto px-5 py-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-800">Todo o estoque físico atual</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Imprime uma etiqueta pra cada pneu da última ficha de estoque ({fonteRows.length} pneu(s)).
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      printEtiquetasPneus(fonteRows);
                      setEtiquetaModalOpen(false);
                    }}
                    disabled={!fonteRows.length}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <FaBarcode /> Gerar todas
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-800">Selecionar pneus</div>
                  <div className="mt-1 text-xs text-slate-500">Busque e marque os pneus desejados (digite parte do número).</div>
                  <input
                    type="text"
                    value={etiquetaBusca}
                    onChange={(e) => setEtiquetaBusca(e.target.value)}
                    placeholder="Ex: 001828"
                    inputMode="numeric"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  {buscaNorm ? (
                    matches.length ? (
                      <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                        {matches.map((r) => {
                          const k = r.key || r.pneu;
                          const checked = etiquetaSelecionadas.has(k);
                          return (
                            <li
                              key={k}
                              onClick={() => setEtiquetaSelecionadas((prev) => {
                                const next = new Set(prev);
                                if (next.has(k)) next.delete(k); else next.add(k);
                                return next;
                              })}
                              className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-blue-50 ${checked ? "bg-blue-50" : ""}`}
                            >
                              <input type="checkbox" checked={checked} readOnly className="accent-blue-600 shrink-0" />
                              <div className="min-w-0 text-xs">
                                <div className="font-mono font-bold text-slate-900">{r.pneu}</div>
                                <div className="truncate text-slate-500">
                                  {r.marca || "Sem marca"} · {r.situacao_inove || "-"} · {r.local || ""}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-white p-3 text-center text-xs text-slate-500">
                        Nenhum pneu encontrado com esse número no estoque atual.
                      </div>
                    )
                  ) : null}

                  {etiquetaSelecionadas.size > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const selecionados = fonteRows.filter((r) => etiquetaSelecionadas.has(r.key || r.pneu));
                        if (selecionados.length) {
                          printEtiquetasPneus(selecionados);
                          setEtiquetaModalOpen(false);
                        }
                      }}
                      className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      <FaBarcode /> Gerar {etiquetaSelecionadas.size} etiqueta{etiquetaSelecionadas.size > 1 ? "s" : ""}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="flex justify-end border-t border-slate-200 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setEtiquetaModalOpen(false)}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}
