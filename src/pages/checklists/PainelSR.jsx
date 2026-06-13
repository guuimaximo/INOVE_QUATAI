// src/pages/checklists/PainelSR.jsx
// Painel "Kitchen Display" das SRs em aberto no TransNet.
// 2 colunas: Mecanica (vermelho) | Eletrica (amarelo).
// Clique no card grava triado_em -> some pra todos (realtime).
// O proprio painel dispara o bot a cada AUTO_REFRESH_MS via dispatch-bot.

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabase";
import { FaWrench, FaBolt, FaSyncAlt } from "react-icons/fa";

const AUTO_REFRESH_MS = 3 * 60_000; // 3 min

function agruparPorPrefixo(arr) {
  const map = new Map();
  for (const sr of arr) {
    const key = sr.prefixo || "?";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(sr);
  }
  // Sort de cada grupo por id_reclamacao (mais antigo primeiro).
  for (const list of map.values()) {
    list.sort((a, b) => a.id_reclamacao - b.id_reclamacao);
  }
  // Sort dos grupos por prefixo crescente.
  return [...map.entries()]
    .sort(([a], [b]) => String(a).padStart(10, "0").localeCompare(String(b).padStart(10, "0")))
    .map(([prefixo, srs]) => ({ prefixo, srs }));
}

function CardSR({ grupo, onTriar, cor }) {
  const corMap = {
    mecanica: { bg: "#fee2e2", border: "#dc2626", chip: "#dc2626" },
    eletrica: { bg: "#fef9c3", border: "#ca8a04", chip: "#ca8a04" },
  };
  const c = corMap[cor];
  const { prefixo, srs } = grupo;
  return (
    <button
      onClick={() => onTriar(srs)}
      className="text-left rounded-xl p-4 shadow hover:shadow-lg transition active:scale-95"
      style={{ background: c.bg, border: `2px solid ${c.border}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-3xl font-black text-slate-900">{prefixo}</div>
        <span
          className="text-xs font-semibold text-white px-2 py-1 rounded-full"
          style={{ background: c.chip }}
        >
          {srs.length > 1 ? `${srs.length} SRs` : `SR ${srs[0].codigo}`}
        </span>
      </div>
      <div className="space-y-1.5">
        {srs.map((sr) => (
          <div key={sr.id_reclamacao} className="text-sm">
            <div className="font-medium text-slate-700">
              {srs.length > 1 && (
                <span className="text-xs text-slate-500 mr-1">#{sr.codigo}</span>
              )}
              {sr.motivo || "-"}
            </div>
            {sr.observacao && (
              <div className="text-xs text-slate-600 line-clamp-2">{sr.observacao}</div>
            )}
          </div>
        ))}
      </div>
    </button>
  );
}

function Coluna({ titulo, icone, cor, grupos, totalSrs, onTriar }) {
  const palette = {
    mecanica: { header: "#dc2626", text: "white" },
    eletrica: { header: "#ca8a04", text: "white" },
  }[cor];
  return (
    <section className="flex flex-col h-full min-h-0">
      <header
        className="px-4 py-3 rounded-t-xl flex items-center gap-2 font-bold text-lg"
        style={{ background: palette.header, color: palette.text }}
      >
        {icone}
        <span>{titulo}</span>
        <span className="ml-auto bg-white/20 px-3 py-0.5 rounded-full text-sm">
          {grupos.length}
          {totalSrs !== grupos.length && (
            <span className="opacity-80"> ({totalSrs} SRs)</span>
          )}
        </span>
      </header>
      <div className="flex-1 min-h-0 overflow-auto bg-slate-50 rounded-b-xl p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
        {grupos.length === 0 && (
          <div className="col-span-full text-center text-slate-400 py-12 text-sm">
            Nenhuma SR em aberto
          </div>
        )}
        {grupos.map((g) => (
          <CardSR key={g.prefixo} grupo={g} onTriar={onTriar} cor={cor} />
        ))}
      </div>
    </section>
  );
}

function formatCountdown(ms) {
  if (ms <= 0) return "00:00";
  const total = Math.ceil(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function PainelSR() {
  const [srs, setSrs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [disparando, setDisparando] = useState(false);
  const [proximoEm, setProximoEm] = useState(AUTO_REFRESH_MS);
  const [ultimaConsulta, setUltimaConsulta] = useState(null);
  const proximaExecucaoRef = useRef(Date.now() + AUTO_REFRESH_MS);

  async function carregar() {
    const hoje = new Date().toISOString().slice(0, 10); // YYYY-MM-DD local UTC
    const { data } = await supabase
      .from("solicitacao_reparo_aberta")
      .select("*")
      .is("triado_em", null)
      .is("fechado_em", null)
      .eq("data_abertura", hoje)
      .order("prefixo", { ascending: true });
    setSrs(data || []);
    setCarregando(false);
    if (data && data.length) {
      const max = data
        .map((d) => d.ultima_consulta)
        .filter(Boolean)
        .sort()
        .pop();
      if (max) setUltimaConsulta(max);
    }
  }

  async function dispararBot(motivo = "agendado") {
    if (disparando) return;
    setDisparando(true);
    try {
      const { error } = await supabase.functions.invoke("dispatch-bot", {
        body: { tipo: "sr_aberta" },
      });
      if (error) console.error("dispatch-bot falhou", error);
      // Reagenda proxima execucao independente do resultado.
      proximaExecucaoRef.current = Date.now() + AUTO_REFRESH_MS;
      // Da uns segundos pro bot rodar e recarrega.
      setTimeout(carregar, 45_000);
    } finally {
      setDisparando(false);
    }
  }

  // Bootstrap: carrega dados + assina realtime + timer do countdown.
  useEffect(() => {
    carregar();
    const ch = supabase
      .channel("sra_painel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "solicitacao_reparo_aberta" },
        () => carregar(),
      )
      .subscribe();

    const tick = setInterval(() => {
      const restante = proximaExecucaoRef.current - Date.now();
      setProximoEm(restante);
      if (restante <= 0) {
        dispararBot("auto");
      }
    }, 1000);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function triar(srsDoGrupo) {
    const ids = srsDoGrupo.map((s) => s.id_reclamacao);
    setSrs((prev) => prev.filter((x) => !ids.includes(x.id_reclamacao)));
    const { data: userData } = await supabase.auth.getUser();
    const quem = userData?.user?.email || "painel";
    const { error } = await supabase
      .from("solicitacao_reparo_aberta")
      .update({ triado_em: new Date().toISOString(), triado_por: quem })
      .in("id_reclamacao", ids);
    if (error) {
      alert("Falha ao triar: " + error.message);
      carregar();
    }
  }

  const { mecanica, eletrica, totalMec, totalEle } = useMemo(() => {
    const m = srs.filter((s) => s.categoria === "mecanica");
    const e = srs.filter((s) => s.categoria === "eletrica");
    return {
      mecanica: agruparPorPrefixo(m),
      eletrica: agruparPorPrefixo(e),
      totalMec: m.length,
      totalEle: e.length,
    };
  }, [srs]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] p-3 gap-3 bg-slate-100">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-slate-800">Painel SR</h1>
        <div className="text-sm text-slate-600">
          Próxima atualização em <span className="font-mono font-bold text-slate-900">{formatCountdown(proximoEm)}</span>
          {ultimaConsulta && (
            <span className="ml-3 text-slate-500">
              Última: {new Date(ultimaConsulta).toLocaleTimeString("pt-BR")}
            </span>
          )}
        </div>
        <button
          onClick={() => dispararBot("manual")}
          className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-sm"
          disabled={disparando}
        >
          <FaSyncAlt className={disparando ? "animate-spin" : ""} />
          {disparando ? "Disparando..." : "Atualizar agora"}
        </button>
      </header>

      {carregando ? (
        <div className="flex-1 grid place-items-center text-slate-500">Carregando…</div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Coluna
            titulo="Mecânica"
            icone={<FaWrench />}
            cor="mecanica"
            grupos={mecanica}
            totalSrs={totalMec}
            onTriar={triar}
          />
          <Coluna
            titulo="Elétrica"
            icone={<FaBolt />}
            cor="eletrica"
            grupos={eletrica}
            totalSrs={totalEle}
            onTriar={triar}
          />
        </div>
      )}
    </div>
  );
}
