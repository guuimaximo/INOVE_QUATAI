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
      className="min-w-[110px] rounded p-1.5"
      style={{
        background: vazio ? "#f8fafc" : palette.bg,
        border: `1px solid ${vazio ? "#e2e8f0" : palette.border}`,
        color: palette.text,
      }}
    >
      <div className="flex items-center justify-between gap-1 text-[10px]">
        <span className="font-mono">{base || "—"}</span>
        <span className="text-slate-500">·</span>
        <span className="font-mono font-bold">{aud || "—"}</span>
      </div>
      {status ? (
        <div
          className="mt-0.5 rounded px-1 text-center text-[9px] font-bold uppercase tracking-wide text-white"
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
  const [rowsRaw, setRowsRaw] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [disparando, setDisparando] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  async function carregar() {
    setCarregando(true);
    try {
      const { data, error } = await supabase.from("vw_pcm_controle_pneus_central").select("*");

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
      setUltimaAtualizacao(sorted?.[0]?.snapshot_em || null);
    } catch (error) {
      console.error("Erro ao carregar controle de pneus:", error);
      alert(error?.message || "Nao foi possivel carregar o controle de pneus.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel("pcm_controle_pneus")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pcm_pneus_transnet_alocacao" },
        () => carregar()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pcm_auditoria_pneus" },
        () => carregar()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pcm_troca_pneus" },
        () => carregar()
      )
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
        });
      }

      const item = map.get(key);
      item.posicoes[row.posicao] = {
        base: row.numero_fogo_base,
        aud: row.numero_fogo_aud,
        status: row.status,
      };
      if (row.troca_pos_auditoria) item.troca = true;
      if (!item.ficha && row.ficha_auditoria) item.ficha = row.ficha_auditoria;
      if (!item.auditoria_em && row.auditoria_em) item.auditoria_em = row.auditoria_em;
      if (!item.auditado_por && row.auditado_por) item.auditado_por = row.auditado_por;
      if (row.tem_auditoria) item.temAuditoria = true;
    }

    return [...map.values()];
  }, [rowsRaw]);

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

      return true;
    });
  }, [busca, filtroStatus, linhasBase]);

  const kpis = useMemo(() => {
    let auditados = 0;
    let totalStatus = 0;
    let ok = 0;
    let sucata = 0;
    let outro = 0;
    let naoExiste = 0;
    let estoque = 0;

    for (const row of linhasBase) {
      if (row.temAuditoria) auditados += 1;
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
      auditados,
      ok,
      sucata,
      outro,
      naoExiste,
      estoque,
      okPct: totalStatus ? Math.round((ok / totalStatus) * 100) : 0,
    };
  }, [linhasBase]);

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

      <section className="mb-3 flex flex-wrap gap-2">
        <KpiCard label="Base TransNet" value={kpis.base} cor="#475569" />
        <KpiCard label={`OK · ${kpis.okPct}%`} value={kpis.ok} cor="#16a34a" />
        <KpiCard label="Sucata" value={kpis.sucata} cor="#dc2626" />
        <KpiCard label="Outro veículo" value={kpis.outro} cor="#ca8a04" />
        <KpiCard label="Não existe" value={kpis.naoExiste} cor="#ea580c" />
        <KpiCard label="Estoque" value={kpis.estoque} cor="#2563eb" />
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
          <option value="OK">OK</option>
          <option value="SUCATA">SUCATA</option>
          <option value="OUTRO VEICULO">OUTRO VEICULO</option>
          <option value="NAO EXISTE">NAO EXISTE</option>
          <option value="ESTOQUE">ESTOQUE</option>
        </select>
        <span className="ml-auto text-xs text-slate-500">
          Exibindo {filtradas.length} / {linhasBase.length}
        </span>
      </section>

      {carregando ? (
        <div className="grid place-items-center py-16 text-slate-500">Carregando…</div>
      ) : (
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
                      <span className="font-bold text-amber-600">SIM</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
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
