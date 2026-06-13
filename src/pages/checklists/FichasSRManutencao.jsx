// src/pages/checklists/FichasSRManutencao.jsx
// Tela "Fichas SR - MANUTENCAO"
// - Topo: SRs em aberto (cards) divididas em Mecanica | Eletrica.
// - Base: SRs fechadas a partir do ultimo corte das 20:00 (linhas compactas).

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import { FaWrench, FaBolt, FaSyncAlt } from "react-icons/fa";

function ultimoCorte20h() {
  const agora = new Date();
  const corte = new Date(agora);
  corte.setHours(20, 0, 0, 0);
  if (agora < corte) corte.setDate(corte.getDate() - 1);
  return corte;
}

function agruparPorPrefixo(arr) {
  const map = new Map();
  for (const sr of arr) {
    const key = sr.prefixo || "?";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(sr);
  }
  for (const list of map.values()) list.sort((a, b) => a.id_reclamacao - b.id_reclamacao);
  return [...map.entries()]
    .sort(([a], [b]) => String(a).padStart(10, "0").localeCompare(String(b).padStart(10, "0")))
    .map(([prefixo, srs]) => ({ prefixo, srs }));
}

function CardAberto({ grupo, cor }) {
  const palette = {
    mecanica: { bg: "#fee2e2", border: "#dc2626", chip: "#dc2626" },
    eletrica: { bg: "#fef9c3", border: "#ca8a04", chip: "#ca8a04" },
  }[cor];
  const { prefixo, srs } = grupo;
  return (
    <div
      className="rounded-xl p-3 shadow-sm"
      style={{ background: palette.bg, border: `2px solid ${palette.border}` }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="text-2xl font-black text-slate-900">{prefixo}</div>
        <span
          className="text-xs font-semibold text-white px-2 py-0.5 rounded-full"
          style={{ background: palette.chip }}
        >
          {srs.length > 1 ? `${srs.length} SRs` : `SR ${srs[0].codigo}`}
        </span>
      </div>
      <div className="space-y-1">
        {srs.map((sr) => (
          <div key={sr.id_reclamacao} className="text-xs">
            <span className="font-medium text-slate-700">{sr.motivo || "-"}</span>
            {sr.observacao && (
              <span className="text-slate-600"> · {sr.observacao}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ColunaAberto({ titulo, icone, cor, grupos }) {
  const palette = { mecanica: "#dc2626", eletrica: "#ca8a04" }[cor];
  return (
    <section className="flex flex-col h-full min-h-0">
      <header
        className="px-3 py-2 rounded-t-lg flex items-center gap-2 font-bold text-base text-white"
        style={{ background: palette }}
      >
        {icone}
        <span>{titulo}</span>
        <span className="ml-auto bg-white/20 px-2 py-0.5 rounded-full text-sm">
          {grupos.length}
        </span>
      </header>
      <div className="flex-1 min-h-0 overflow-auto bg-slate-50 rounded-b-lg p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 content-start">
        {grupos.length === 0 && (
          <div className="col-span-full text-center text-slate-400 py-6 text-xs">
            Nenhuma SR em aberto
          </div>
        )}
        {grupos.map((g) => (
          <CardAberto key={g.prefixo} grupo={g} cor={cor} />
        ))}
      </div>
    </section>
  );
}

function LinhaFechada({ sr }) {
  const fechado = sr.fechado_em || sr.triado_em;
  const hh = fechado
    ? new Date(fechado).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";
  const origem = sr.triado_em ? "triado" : "atendido";
  return (
    <tr className="text-xs border-b border-slate-200 hover:bg-slate-50">
      <td className="px-2 py-1 font-bold text-slate-900">{sr.prefixo}</td>
      <td className="px-2 py-1 text-slate-500">SR {sr.codigo}</td>
      <td className="px-2 py-1 text-slate-700">{sr.motivo || "-"}</td>
      <td className="px-2 py-1 text-slate-500 max-w-[200px] truncate">{sr.observacao}</td>
      <td className="px-2 py-1 text-slate-500">{hh}</td>
      <td className="px-2 py-1 text-slate-400">{origem}</td>
    </tr>
  );
}

function ColunaFechadas({ titulo, icone, cor, srs }) {
  const palette = { mecanica: "#7f1d1d", eletrica: "#854d0e" }[cor];
  return (
    <section className="flex flex-col h-full min-h-0">
      <header
        className="px-3 py-2 rounded-t-lg flex items-center gap-2 font-bold text-base text-white"
        style={{ background: palette }}
      >
        {icone}
        <span>{titulo}</span>
        <span className="ml-auto bg-white/20 px-2 py-0.5 rounded-full text-sm">
          {srs.length}
        </span>
      </header>
      <div className="flex-1 min-h-0 overflow-auto bg-slate-50 rounded-b-lg">
        {srs.length === 0 ? (
          <div className="text-center text-slate-400 py-6 text-xs">
            Nenhuma SR fechada desde 20:00
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-100 text-slate-600 text-xs sticky top-0">
              <tr>
                <th className="px-2 py-1 text-left">Prefixo</th>
                <th className="px-2 py-1 text-left">SR</th>
                <th className="px-2 py-1 text-left">Motivo</th>
                <th className="px-2 py-1 text-left">Obs</th>
                <th className="px-2 py-1 text-left">Hora</th>
                <th className="px-2 py-1 text-left">Por</th>
              </tr>
            </thead>
            <tbody>
              {srs.map((sr) => (
                <LinhaFechada key={sr.id_reclamacao} sr={sr} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default function FichasSRManutencao() {
  const [srs, setSrs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const corte = useMemo(() => ultimoCorte20h(), []);

  async function carregar() {
    setAtualizando(true);
    // Abertas: ontem + hoje, sem triagem nem fechamento.
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const desde = ontem.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("solicitacao_reparo_aberta")
      .select("*")
      .gte("data_abertura", desde);
    if (!error) setSrs(data || []);
    setCarregando(false);
    setAtualizando(false);
  }

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel("fichas_sr_manut")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "solicitacao_reparo_aberta" },
        () => carregar(),
      )
      .subscribe();
    const itv = setInterval(carregar, 60_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(itv);
    };
  }, []);

  const {
    abertasMec, abertasEle,
    fechadasMec, fechadasEle,
  } = useMemo(() => {
    const abertas = srs.filter((s) => !s.triado_em && !s.fechado_em);
    const fechadas = srs.filter((s) => {
      const t = s.triado_em || s.fechado_em;
      return t && new Date(t) >= corte;
    });
    // Fechadas: mais recentes primeiro.
    fechadas.sort((a, b) => {
      const ta = a.triado_em || a.fechado_em;
      const tb = b.triado_em || b.fechado_em;
      return String(tb).localeCompare(String(ta));
    });
    return {
      abertasMec: agruparPorPrefixo(abertas.filter((s) => s.categoria === "mecanica")),
      abertasEle: agruparPorPrefixo(abertas.filter((s) => s.categoria === "eletrica")),
      fechadasMec: fechadas.filter((s) => s.categoria === "mecanica"),
      fechadasEle: fechadas.filter((s) => s.categoria === "eletrica"),
    };
  }, [srs, corte]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] p-2 gap-2 bg-slate-100">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-slate-800">Fichas SR — Manutenção</h1>
        <span className="text-xs text-slate-500">
          Corte:{" "}
          {corte.toLocaleString("pt-BR", {
            day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
          })}
        </span>
        <button
          onClick={carregar}
          className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sm"
          disabled={atualizando}
        >
          <FaSyncAlt className={atualizando ? "animate-spin" : ""} /> Atualizar
        </button>
      </header>

      {carregando ? (
        <div className="flex-1 grid place-items-center text-slate-500">Carregando…</div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-rows-[3fr_2fr] gap-2">
          {/* Topo: abertas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 min-h-0">
            <ColunaAberto titulo="Em aberto · Mecânica" icone={<FaWrench />} cor="mecanica" grupos={abertasMec} />
            <ColunaAberto titulo="Em aberto · Elétrica" icone={<FaBolt />} cor="eletrica" grupos={abertasEle} />
          </div>
          {/* Base: fechadas a partir das 20:00 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 min-h-0">
            <ColunaFechadas titulo="Fechadas · Mecânica" icone={<FaWrench />} cor="mecanica" srs={fechadasMec} />
            <ColunaFechadas titulo="Fechadas · Elétrica" icone={<FaBolt />} cor="eletrica" srs={fechadasEle} />
          </div>
        </div>
      )}
    </div>
  );
}
