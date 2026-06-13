// src/pages/pcm/PCMControlePneus.jsx
// Controle de Pneus — replica a aba CENTRAL da planilha v3.
// Para cada auditoria, mostra as 6 posicoes (DD/DE/TEE/TEI/TDI/TDE) com:
//   Base (TransNet) | Aud (INOVE) | Status colorido (OK / SUCATA / OUTRO_VEICULO / NAO_EXISTE / ESTOQUE)
// Botao "Atualizar base TransNet" dispara o bot_pneus via dispatch-bot.

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
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function Celula({ base, aud, status }) {
  const palette = STATUS_PALETTE[status] || { bg: "#f8fafc", border: "#cbd5e1", text: "#475569", chip: "#94a3b8" };
  const vazio = !base && !aud;
  return (
    <div
      className="rounded p-1.5 min-w-[110px]"
      style={{
        background: vazio ? "#f8fafc" : palette.bg,
        border: `1px solid ${vazio ? "#e2e8f0" : palette.border}`,
        color: palette.text,
      }}
    >
      <div className="text-[10px] flex items-center justify-between gap-1">
        <span className="font-mono">{base || "—"}</span>
        <span className="text-slate-500">·</span>
        <span className="font-mono font-bold">{aud || "—"}</span>
      </div>
      {status && (
        <div
          className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-center text-white rounded px-1"
          style={{ background: palette.chip }}
        >
          {status}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, cor }) {
  return (
    <div
      className="rounded-lg px-3 py-2 shadow-sm border min-w-[110px]"
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
    const { data } = await supabase
      .from("vw_pcm_controle_pneus_central")
      .select("*")
      .order("auditoria_em", { ascending: false });
    setRowsRaw(data || []);
    setCarregando(false);

    // ultima atualizacao do snapshot
    const { data: snap } = await supabase
      .from("pcm_pneus_transnet_alocacao")
      .select("snapshot_em")
      .order("snapshot_em", { ascending: false })
      .limit(1);
    setUltimaAtualizacao(snap?.[0]?.snapshot_em || null);
  }

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel("pcm_controle_pneus")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pcm_pneus_transnet_alocacao" },
        () => carregar(),
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  async function dispararBot() {
    if (disparando) return;
    setDisparando(true);
    try {
      const { error } = await supabase.functions.invoke("dispatch-bot", {
        body: { tipo: "pneus" },
      });
      if (error) {
        alert("Falha ao chamar bot: " + error.message);
      } else {
        // Bot leva ~3-5 min. Avisamos e fazemos polling.
        setTimeout(carregar, 120_000);
        setTimeout(carregar, 240_000);
      }
    } finally {
      setTimeout(() => setDisparando(false), 4000);
    }
  }

  // Pivota: 1 linha por (auditoria_id) com posicoes como objeto.
  const auditorias = useMemo(() => {
    const map = new Map();
    for (const r of rowsRaw) {
      const id = r.auditoria_id;
      if (!map.has(id)) {
        map.set(id, {
          auditoria_id: id,
          ficha: r.ficha_auditoria,
          prefixo: r.prefixo_auditoria,
          auditoria_em: r.auditoria_em,
          auditado_por: r.auditado_por,
          posicoes: {},
          troca: false,
        });
      }
      const a = map.get(id);
      a.posicoes[r.posicao] = {
        base: r.numero_fogo_base,
        aud: r.numero_fogo_aud,
        status: r.status,
      };
      if (r.troca_pos_auditoria) a.troca = true;
    }
    return [...map.values()];
  }, [rowsRaw]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return auditorias.filter((a) => {
      if (q) {
        const hay = [a.ficha, a.prefixo, a.auditado_por].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filtroStatus) {
        const has = POSICOES.some((p) => a.posicoes[p]?.status === filtroStatus);
        if (!has) return false;
      }
      return true;
    });
  }, [auditorias, busca, filtroStatus]);

  const kpis = useMemo(() => {
    let total = 0, ok = 0, sucata = 0, outro = 0, naoExiste = 0, estoque = 0;
    for (const a of auditorias) {
      for (const p of POSICOES) {
        const st = a.posicoes[p]?.status;
        if (!st) continue;
        total++;
        if (st === "OK") ok++;
        else if (st === "SUCATA") sucata++;
        else if (st === "OUTRO VEICULO") outro++;
        else if (st === "NAO EXISTE") naoExiste++;
        else if (st === "ESTOQUE") estoque++;
      }
    }
    return {
      auditorias: auditorias.length,
      total,
      ok,
      sucata,
      outro,
      naoExiste,
      estoque,
      okPct: total ? Math.round((ok / total) * 100) : 0,
    };
  }, [auditorias]);

  return (
    <div className="p-3 bg-slate-100 min-h-[calc(100vh-64px)]">
      <header className="flex items-center gap-3 flex-wrap mb-3">
        <h1 className="text-2xl font-bold text-slate-800">
          <FaCarSide className="inline mr-2 text-orange-600" />
          Controle de Pneus — Central
        </h1>
        <span className="text-xs text-slate-500">
          {ultimaAtualizacao
            ? `Snapshot TransNet: ${fmtData(ultimaAtualizacao)}`
            : "Nenhum snapshot do TransNet ainda"}
        </span>
        <button
          onClick={dispararBot}
          disabled={disparando}
          className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 text-sm"
        >
          <FaSyncAlt className={disparando ? "animate-spin" : ""} />
          {disparando ? "Disparado, aguarde ~3min…" : "Atualizar base TransNet"}
        </button>
      </header>

      <section className="flex flex-wrap gap-2 mb-3">
        <KpiCard label="Auditorias" value={kpis.auditorias} cor="#475569" />
        <KpiCard label={`OK · ${kpis.okPct}%`} value={kpis.ok} cor="#16a34a" />
        <KpiCard label="Sucata" value={kpis.sucata} cor="#dc2626" />
        <KpiCard label="Outro veículo" value={kpis.outro} cor="#ca8a04" />
        <KpiCard label="Não existe" value={kpis.naoExiste} cor="#ea580c" />
        <KpiCard label="Estoque" value={kpis.estoque} cor="#2563eb" />
      </section>

      <section className="flex gap-2 mb-2 items-center">
        <div className="relative">
          <FaSearch className="absolute left-2 top-2.5 text-slate-400 text-xs" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar ficha, prefixo, auditor…"
            className="pl-7 pr-2 py-1.5 rounded-lg border border-slate-300 text-sm w-72"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="px-2 py-1.5 rounded-lg border border-slate-300 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="OK">OK</option>
          <option value="SUCATA">SUCATA</option>
          <option value="OUTRO VEICULO">OUTRO VEICULO</option>
          <option value="NAO EXISTE">NAO EXISTE</option>
          <option value="ESTOQUE">ESTOQUE</option>
        </select>
        <span className="ml-auto text-xs text-slate-500">
          Exibindo {filtradas.length} / {auditorias.length}
        </span>
      </section>

      {carregando ? (
        <div className="grid place-items-center py-16 text-slate-500">Carregando…</div>
      ) : (
        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-2 py-2 text-left">Data</th>
                <th className="px-2 py-2 text-left">Ficha</th>
                <th className="px-2 py-2 text-left">Prefixo</th>
                {POSICOES.map((p) => (
                  <th key={p} className="px-2 py-2 text-center">{p}</th>
                ))}
                <th className="px-2 py-2 text-center">Troca pós?</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={3 + POSICOES.length + 1} className="text-center py-8 text-slate-400">
                    Nenhuma auditoria.
                  </td>
                </tr>
              )}
              {filtradas.map((a) => (
                <tr key={a.auditoria_id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-2 py-1.5 whitespace-nowrap text-slate-600">{fmtData(a.auditoria_em)}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-700">{a.ficha}</td>
                  <td className="px-2 py-1.5 font-bold text-slate-900">{a.prefixo}</td>
                  {POSICOES.map((p) => (
                    <td key={p} className="px-1 py-1">
                      <Celula base={a.posicoes[p]?.base} aud={a.posicoes[p]?.aud} status={a.posicoes[p]?.status} />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center">
                    {a.troca ? <span className="text-amber-600 font-bold">SIM</span> : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-slate-400 mt-2">
        <span className="font-bold">Base</span> = TransNet · <span className="font-bold">Aud</span> = auditoria INOVE ·{" "}
        Status: OK = bate · SUCATA = pneu inativo · OUTRO VEICULO = pneu alocado noutro carro · NAO EXISTE = não achado · ESTOQUE = ativo sem alocação.
      </p>
    </div>
  );
}
