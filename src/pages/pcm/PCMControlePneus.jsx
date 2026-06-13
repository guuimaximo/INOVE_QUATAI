import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import { FaSyncAlt, FaSearch, FaCarSide } from "react-icons/fa";

const POSICOES = ["DD", "DE", "TEE", "TEI", "TDI", "TDE"];

const STATUS_PALETTE = {
  OK: { bg: "#dcfce7", border: "#16a34a", text: "#14532d", chip: "#16a34a" },
  SUCATA: { bg: "#fee2e2", border: "#dc2626", text: "#7f1d1d", chip: "#dc2626" },
  "OUTRO VEICULO": { bg: "#fef9c3", border: "#ca8a04", text: "#713f12", chip: "#ca8a04" },
  "NAO EXISTE": { bg: "#ffedd5", border: "#ea580c", text: "#7c2d12", chip: "#ea580c" },
  ESTOQUE: { bg: "#dbeafe", border: "#2563eb", text: "#1e3a8a", chip: "#2563eb" },
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

function Celula({ base, aud, status }) {
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
      style={{
        background: vazio ? "#f8fafc" : palette.bg,
        border: `1px solid ${vazio ? "#e2e8f0" : palette.border}`,
        color: palette.text,
      }}
    >
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
  const [abaAtiva, setAbaAtiva] = useState("veiculos");
  const [rowsRaw, setRowsRaw] = useState([]);
  const [alocacoes, setAlocacoes] = useState([]);
  const [ativos, setAtivos] = useState([]);
  const [inativos, setInativos] = useState([]);
  const [estoqueRows, setEstoqueRows] = useState([]);
  const [consertos, setConsertos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [buscaFogo, setBuscaFogo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroComparacao, setFiltroComparacao] = useState("");
  const [filtroManual, setFiltroManual] = useState("");
  const [filtroDataAuditoria, setFiltroDataAuditoria] = useState("");
  const [disparando, setDisparando] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  async function carregar() {
    setCarregando(true);
    try {
      const [
        { data, error },
        { data: alocData, error: alocError },
        { data: ativosData, error: ativosError },
        { data: inativosData, error: inativosError },
        { data: estoqueData, error: estoqueError },
        { data: consertosData, error: consertosError },
      ] =
        await Promise.all([
          supabase.from("vw_pcm_controle_pneus_central").select("*"),
          supabase.from("pcm_pneus_transnet_alocacao").select("prefixo, posicao, numero_fogo, snapshot_em"),
          supabase.from("pcm_pneus_transnet_ativos").select("numero_fogo, localizacao, posicao, marca, medida"),
          supabase.from("pcm_pneus_transnet_inativos").select("numero_fogo, motivo"),
          supabase.from("pcm_estoque_pneus").select("id, ficha_estoque, numero_fogo, numero_pneu, marca, situacao, created_at").order("created_at", { ascending: false }),
          supabase.from("pcm_consertos_pneus").select("id, ficha_conserto, numero_fogo, prefixo, status, situacao_origem, created_at").order("created_at", { ascending: false }),
        ]);

      if (error) throw error;
      if (alocError) throw alocError;
      if (ativosError) throw ativosError;
      if (inativosError) throw inativosError;
      if (estoqueError) throw estoqueError;
      if (consertosError) throw consertosError;

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

  const linhasBase = useMemo(() => {
    const map = new Map();

    for (const row of rowsRaw) {
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
      item.posicoes[row.posicao] = {
        base: row.numero_fogo_base,
        aud: row.numero_fogo_aud,
        status: row.status,
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
  }, [rowsRaw]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const prefixosManuais = filtroManual
      .split(/[,\s;]+/)
      .map((item) => item.trim())
      .filter(Boolean);

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

      if (prefixosManuais.length > 0 && !prefixosManuais.includes(String(row.prefixo || "").trim())) {
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
  }, [busca, filtroStatus, filtroComparacao, filtroManual, filtroDataAuditoria, linhasBase]);

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

  const estoqueComparado = useMemo(() => {
    const latestEstoque = new Map();
    for (const item of estoqueRows) {
      const pneu = normalizarPneu(item.numero_fogo || item.numero_pneu);
      if (!pneu || latestEstoque.has(pneu)) continue;
      latestEstoque.set(pneu, item);
    }

    const consertoAberto = new Map();
    for (const item of consertos) {
      const pneu = normalizarPneu(item.numero_fogo);
      if (!pneu || consertoAberto.has(pneu)) continue;
      if (String(item.status || "").toUpperCase() === "CONCLUIDO") continue;
      consertoAberto.set(pneu, item);
    }

    const pneus = new Set([...latestEstoque.keys(), ...consertoAberto.keys()]);

    return [...pneus].map((pneu) => {
      const estoque = latestEstoque.get(pneu) || null;
      const conserto = consertoAberto.get(pneu) || null;
      const aloc = alocacoes.find((item) => normalizarPneu(item.numero_fogo) === pneu) || null;
      const ativo = ativos.find((item) => normalizarPneu(item.numero_fogo) === pneu) || null;
      const inativo = inativos.find((item) => normalizarPneu(item.numero_fogo) === pneu) || null;

      let status = "NAO EXISTE";
      let local = "Não encontrado no TransNet";

      if (inativo) {
        status = "SUCATA";
        local = inativo.motivo || "Inativo no TransNet";
      } else if (conserto) {
        status = "BORRACHARIA";
        local = `${conserto.status || "PENDENTE"}${conserto.prefixo ? ` · prefixo ${conserto.prefixo}` : ""}`;
      } else if (aloc) {
        status = "EM VEICULO";
        local = `${aloc.prefixo} · ${aloc.posicao}`;
      } else if (ativo) {
        status = "ESTOQUE OK";
        local = `${ativo.localizacao || "Ativo sem localização"}${ativo.posicao ? ` · ${ativo.posicao}` : ""}`;
      }

      return {
        pneu,
        ficha_estoque: estoque?.ficha_estoque || "",
        data_estoque: estoque?.created_at || conserto?.created_at || null,
        marca: estoque?.marca || ativo?.marca || "",
        situacao_inove: estoque?.situacao || conserto?.situacao_origem || "",
        status,
        local,
        conserto_status: conserto?.status || "",
      };
    }).sort((a, b) => String(a.pneu).localeCompare(String(b.pneu), "pt-BR", { numeric: true }));
  }, [estoqueRows, consertos, alocacoes, ativos, inativos]);

  const estoqueFiltrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const prefixosManuais = filtroManual
      .split(/[,\s;]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    return estoqueComparado.filter((row) => {
      if (q) {
        const hay = [row.pneu, row.ficha_estoque, row.marca, row.situacao_inove, row.local, row.status].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filtroStatus && row.status !== filtroStatus) return false;
      if (filtroComparacao === "CORRETO" && row.status !== "ESTOQUE OK") return false;
      if (filtroComparacao === "INCORRETO" && row.status === "ESTOQUE OK") return false;
      if (prefixosManuais.length > 0) {
        const localPrefixo = String(row.local || "").split("·")[0].trim();
        if (!prefixosManuais.includes(localPrefixo) && !prefixosManuais.includes(String(row.ficha_estoque || "").trim())) return false;
      }
      if (filtroDataAuditoria) {
        if (!row.data_estoque) return false;
        const inicio = new Date(`${filtroDataAuditoria}T00:00:00`);
        const dataEstoque = new Date(row.data_estoque);
        if (Number.isNaN(dataEstoque.getTime()) || dataEstoque < inicio) return false;
      }
      return true;
    });
  }, [estoqueComparado, busca, filtroStatus, filtroComparacao, filtroManual, filtroDataAuditoria]);

  const estoqueKpis = useMemo(() => {
    return {
      total: estoqueComparado.length,
      ok: estoqueComparado.filter((item) => item.status === "ESTOQUE OK").length,
      borracharia: estoqueComparado.filter((item) => item.status === "BORRACHARIA").length,
      emVeiculo: estoqueComparado.filter((item) => item.status === "EM VEICULO").length,
      sucata: estoqueComparado.filter((item) => item.status === "SUCATA").length,
      naoExiste: estoqueComparado.filter((item) => item.status === "NAO EXISTE").length,
    };
  }, [estoqueComparado]);

  const resultadoBuscaFogo = useMemo(() => {
    const pneu = normalizarPneu(buscaFogo);
    if (!pneu) return null;

    const matchAloc = alocacoes.find((item) => normalizarPneu(item.numero_fogo) === pneu);
    if (matchAloc) {
      return {
        status: "TRANSNET",
        texto: `Prefixo ${matchAloc.prefixo} · ${matchAloc.posicao}`,
        detalhe: "Pneu alocado em veículo no snapshot TransNet.",
        cor: "#2563eb",
      };
    }

    const matchInativo = inativos.find((item) => normalizarPneu(item.numero_fogo) === pneu);
    if (matchInativo) {
      return {
        status: "SUCATA",
        texto: "Pneu inativo / sucata",
        detalhe: matchInativo.motivo || "Registrado como inativo no TransNet.",
        cor: "#dc2626",
      };
    }

    const matchAtivo = ativos.find((item) => normalizarPneu(item.numero_fogo) === pneu);
    if (matchAtivo) {
      const local = matchAtivo.localizacao || "Local não informado";
      const posicao = matchAtivo.posicao ? ` · ${matchAtivo.posicao}` : "";
      const isVeiculo = /^\d{3}-[0-9A-Z]+$/i.test(local);
      return {
        status: isVeiculo ? "ATIVO" : "ESTOQUE",
        texto: `${local}${posicao}`,
        detalhe: [matchAtivo.marca, matchAtivo.medida].filter(Boolean).join(" · ") || "Pneu ativo no TransNet.",
        cor: isVeiculo ? "#16a34a" : "#2563eb",
      };
    }

    return {
      status: "NAO ENCONTRADO",
      texto: "Não localizado nas bases carregadas",
      detalhe: "Verifique se o número de fogo está correto.",
      cor: "#ea580c",
    };
  }, [alocacoes, ativos, inativos, buscaFogo]);

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
          onClick={dispararBot}
          disabled={disparando}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-1.5 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
        >
          <FaSyncAlt className={disparando ? "animate-spin" : ""} />
          {disparando ? "Disparado, aguarde ~3min…" : "Atualizar base TransNet"}
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
        ) : (
          <>
            <KpiCard label="Itens" value={estoqueKpis.total} cor="#475569" />
            <KpiCard label="Estoque OK" value={estoqueKpis.ok} cor="#16a34a" />
            <KpiCard label="Borracharia" value={estoqueKpis.borracharia} cor="#7c3aed" />
            <KpiCard label="Em veículo" value={estoqueKpis.emVeiculo} cor="#ca8a04" />
            <KpiCard label="Sucata" value={estoqueKpis.sucata} cor="#dc2626" />
            <KpiCard label="Não existe" value={estoqueKpis.naoExiste} cor="#ea580c" />
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
              <option value="SUCATA">SUCATA</option>
              <option value="OUTRO VEICULO">OUTRO VEICULO</option>
              <option value="NAO EXISTE">NAO EXISTE</option>
              <option value="ESTOQUE">ESTOQUE</option>
            </>
          ) : (
            <>
              <option value="ESTOQUE OK">ESTOQUE OK</option>
              <option value="BORRACHARIA">BORRACHARIA</option>
              <option value="EM VEICULO">EM VEICULO</option>
              <option value="SUCATA">SUCATA</option>
              <option value="NAO EXISTE">NAO EXISTE</option>
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
        <input
          value={filtroManual}
          onChange={(event) => setFiltroManual(event.target.value)}
          placeholder="Filtro manual: 221601, 221602"
          className="min-w-[240px] rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        />
        <input
          type="date"
          value={filtroDataAuditoria}
          onChange={(event) => setFiltroDataAuditoria(event.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          title="Auditorias a partir desta data"
        />
        <span className="ml-auto text-xs text-slate-500">
          Exibindo {abaAtiva === "veiculos" ? filtradas.length : estoqueFiltrado.length} / {abaAtiva === "veiculos" ? linhasBase.length : estoqueComparado.length}
        </span>
      </section>

      {carregando ? (
        <div className="grid place-items-center py-16 text-slate-500">Carregando…</div>
      ) : abaAtiva === "veiculos" ? (
        <div className="overflow-auto rounded-lg border border-slate-200 bg-white shadow">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
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
                  <td colSpan={3 + POSICOES.length + 1} className="py-8 text-center text-slate-400">
                    Nenhum prefixo na base TransNet.
                  </td>
                </tr>
              ) : null}

              {filtradas.map((row) => (
                <tr key={row.grupo_id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-2 py-1.5 text-slate-600">{fmtData(row.auditoria_em)}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-700">{row.ficha || "—"}</td>
                  <td className="px-2 py-1.5 font-bold text-slate-900">{row.prefixo}</td>
                  {POSICOES.map((posicao) => (
                    <td key={posicao} className="px-1 py-1">
                      <Celula
                        base={row.posicoes[posicao]?.base}
                        aud={row.posicoes[posicao]?.aud}
                        status={row.posicoes[posicao]?.status}
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
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200 bg-white shadow">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-2 py-2 text-left">Data</th>
                <th className="px-2 py-2 text-left">Ficha</th>
                <th className="px-2 py-2 text-left">Número de fogo</th>
                <th className="px-2 py-2 text-left">Marca</th>
                <th className="px-2 py-2 text-left">Situação INOVE</th>
                <th className="px-2 py-2 text-left">Status TransNet</th>
                <th className="px-2 py-2 text-left">Onde está</th>
                <th className="px-2 py-2 text-left">Conserto</th>
              </tr>
            </thead>
            <tbody>
              {estoqueFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Nenhum item de estoque encontrado.
                  </td>
                </tr>
              ) : null}
              {estoqueFiltrado.map((row) => (
                <tr key={row.pneu} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-2 py-2 text-slate-600">{fmtData(row.data_estoque)}</td>
                  <td className="px-2 py-2 font-mono text-slate-700">{row.ficha_estoque || "—"}</td>
                  <td className="px-2 py-2 font-mono text-[13px] font-bold text-slate-900">{row.pneu}</td>
                  <td className="px-2 py-2 text-slate-700">{row.marca || "—"}</td>
                  <td className="px-2 py-2 text-slate-700">{row.situacao_inove || "—"}</td>
                  <td className="px-2 py-2">
                    <span className="rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: row.status === "ESTOQUE OK" ? "#16a34a" : row.status === "BORRACHARIA" ? "#7c3aed" : row.status === "EM VEICULO" ? "#ca8a04" : row.status === "SUCATA" ? "#dc2626" : "#ea580c" }}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-slate-700">{row.local}</td>
                  <td className="px-2 py-2 text-slate-700">{row.conserto_status || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 text-[10px] text-slate-400">
        <span className="font-bold">Base</span> = TransNet · <span className="font-bold">Aud</span> = auditoria INOVE ·
        Status: OK = bate · SUCATA = pneu inativo · OUTRO VEICULO = pneu alocado noutro carro · NAO EXISTE = não achado ·
        ESTOQUE = ativo sem alocação.
      </p>
    </div>
  );
}
