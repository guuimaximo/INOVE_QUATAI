// src/pages/checklists/PainelSR.jsx
// Painel "Kitchen Display" das SRs em aberto no TransNet.
// 2 colunas: Mecanica (vermelho) | Eletrica (amarelo).
// Clique no card grava triado_em -> some pra todos (realtime).
// O proprio painel dispara o bot a cada AUTO_REFRESH_MS via dispatch-bot.

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabase";
import { FaWrench, FaBolt, FaSyncAlt } from "react-icons/fa";

const AUTO_REFRESH_MS = 3 * 60_000; // 3 min

function ordenarPorPrefixo(arr) {
  return [...arr].sort((a, b) => {
    const pa = String(a.prefixo || "").padStart(10, "0");
    const pb = String(b.prefixo || "").padStart(10, "0");
    return pa.localeCompare(pb);
  });
}

function CardSR({ sr, onTriar, cor }) {
  const corMap = {
    mecanica: { bg: "#fee2e2", border: "#dc2626", chip: "#dc2626" },
    eletrica: { bg: "#fef9c3", border: "#ca8a04", chip: "#ca8a04" },
  };
  const c = corMap[cor];
  return (
    <button
      onClick={() => onTriar(sr)}
      className="text-left rounded-xl p-4 shadow hover:shadow-lg transition active:scale-95"
      style={{ background: c.bg, border: `2px solid ${c.border}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-3xl font-black text-slate-900">{sr.prefixo || "?"}</div>
        <span
          className="text-xs font-semibold text-white px-2 py-1 rounded-full"
          style={{ background: c.chip }}
        >
          SR {sr.codigo}
        </span>
      </div>
      <div className="text-sm font-medium text-slate-700">{sr.motivo || "-"}</div>
      {sr.observacao && (
        <div className="text-xs text-slate-600 mt-1 line-clamp-2">{sr.observacao}</div>
      )}
    </button>
  );
}

function Coluna({ titulo, icone, cor, srs, onTriar }) {
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
          {srs.length}
        </span>
      </header>
      <div className="flex-1 min-h-0 overflow-auto bg-slate-50 rounded-b-xl p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
        {srs.length === 0 && (
          <div className="col-span-full text-center text-slate-400 py-12 text-sm">
            Nenhuma SR em aberto
          </div>
        )}
        {srs.map((sr) => (
          <CardSR key={sr.id_reclamacao} sr={sr} onTriar={onTriar} cor={cor} />
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

  async function triar(sr) {
    setSrs((prev) => prev.filter((x) => x.id_reclamacao !== sr.id_reclamacao));
    const { data: userData } = await supabase.auth.getUser();
    const quem = userData?.user?.email || "painel";
    const { error } = await supabase
      .from("solicitacao_reparo_aberta")
      .update({ triado_em: new Date().toISOString(), triado_por: quem })
      .eq("id_reclamacao", sr.id_reclamacao);
    if (error) {
      alert("Falha ao triar SR " + sr.codigo + ": " + error.message);
      carregar();
    }
  }

  const { mecanica, eletrica } = useMemo(() => {
    const m = srs.filter((s) => s.categoria === "mecanica");
    const e = srs.filter((s) => s.categoria === "eletrica");
    return { mecanica: ordenarPorPrefixo(m), eletrica: ordenarPorPrefixo(e) };
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
            srs={mecanica}
            onTriar={triar}
          />
          <Coluna
            titulo="Elétrica"
            icone={<FaBolt />}
            cor="eletrica"
            srs={eletrica}
            onTriar={triar}
          />
        </div>
      )}
    </div>
  );
}
