// src/pages/checklists/FichasSRManutencao.jsx
// Tela "Fichas SR - MANUTENCAO"
// - Topo: SRs em aberto (cards) divididas em Mecanica | Eletrica.
// - Base: SRs fechadas a partir do ultimo corte das 20:00 (linhas compactas).

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabase";
import { FaWrench, FaBolt, FaSyncAlt } from "react-icons/fa";

const AUTO_REFRESH_MS = 3 * 60_000; // 3 min

function formatCountdown(ms) {
  if (ms <= 0) return "00:00";
  const total = Math.ceil(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

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

function CardAberto({ grupo, cor, onFechar }) {
  const palette = {
    mecanica: { bg: "#fee2e2", border: "#dc2626", chip: "#dc2626" },
    eletrica: { bg: "#fef9c3", border: "#ca8a04", chip: "#ca8a04" },
  }[cor];
  const { prefixo, srs } = grupo;
  return (
    <button
      onClick={() => onFechar(grupo)}
      className="text-left rounded-xl p-3 shadow-sm hover:shadow-md active:scale-95 transition"
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
    </button>
  );
}

function ColunaAberto({ titulo, icone, cor, grupos, onFechar, comPlaca = false }) {
  const palette = { mecanica: "#dc2626", eletrica: "#ca8a04" }[cor];
  return (
    <section className="flex flex-col h-full min-h-0">
      <header
        className="px-3 py-2 rounded-t-lg flex items-center gap-2 font-bold text-base text-white"
        style={{ background: palette }}
      >
        {icone}
        <span>{titulo}</span>
        {comPlaca && (
          <span className="ml-1 text-[10px] uppercase tracking-wider bg-green-500/90 px-2 py-0.5 rounded">
            chegou
          </span>
        )}
        <span className="ml-auto bg-white/20 px-2 py-0.5 rounded-full text-sm">
          {grupos.length}
        </span>
      </header>
      <div
        className="flex-1 min-h-0 overflow-auto rounded-b-lg p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 content-start"
        style={{ background: comPlaca ? "#ecfdf5" : "#f8fafc" }}
      >
        {grupos.length === 0 && (
          <div className="col-span-full text-center text-slate-400 py-6 text-xs">
            {comPlaca ? "Nenhum carro chegou ainda" : "Nenhuma SR em aberto"}
          </div>
        )}
        {grupos.map((g) => (
          <CardAberto key={g.prefixo} grupo={g} cor={cor} onFechar={onFechar} />
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
  let origem = "—";
  if (sr.fechado_em) origem = sr.fechado_por || "auto";
  else if (sr.triado_em) origem = "auxiliar";
  return (
    <tr className="text-xs border-b border-slate-200 hover:bg-slate-50">
      <td className="px-2 py-1 font-bold text-slate-900">{sr.prefixo}</td>
      <td className="px-2 py-1 text-slate-500">SR {sr.codigo}</td>
      <td className="px-2 py-1 text-slate-700">{sr.motivo || "-"}</td>
      <td className="px-2 py-1 text-slate-500 max-w-[200px] truncate">{sr.observacao}</td>
      <td className="px-2 py-1 text-slate-500">{hh}</td>
      <td className="px-2 py-1 text-slate-400 truncate max-w-[120px]">{origem}</td>
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
  const [grupoFechando, setGrupoFechando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [disparando, setDisparando] = useState(false);
  const [proximoEm, setProximoEm] = useState(AUTO_REFRESH_MS);
  const proximaExecucaoRef = useRef(Date.now() + AUTO_REFRESH_MS);
  const corte = useMemo(() => ultimoCorte20h(), []);

  async function dispararBot() {
    if (disparando) return;
    setDisparando(true);
    try {
      const { error } = await supabase.functions.invoke("dispatch-bot", {
        body: { tipo: "sr_aberta" },
      });
      if (error) console.error("dispatch-bot falhou", error);
      proximaExecucaoRef.current = Date.now() + AUTO_REFRESH_MS;
      setTimeout(carregar, 45_000);
    } finally {
      setDisparando(false);
    }
  }

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
    const tickTimer = setInterval(() => {
      const restante = proximaExecucaoRef.current - Date.now();
      setProximoEm(restante);
      if (restante <= 0) dispararBot();
    }, 1000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(itv);
      clearInterval(tickTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmarFechar() {
    if (!grupoFechando) return;
    setSalvando(true);
    const ids = grupoFechando.srs.map((s) => s.id_reclamacao);
    const { data: userData } = await supabase.auth.getUser();
    const quem = userData?.user?.email || "manutencao";
    // Otimista: tira da tela.
    setSrs((prev) =>
      prev.map((s) =>
        ids.includes(s.id_reclamacao)
          ? { ...s, fechado_em: new Date().toISOString(), fechado_por: quem }
          : s,
      ),
    );
    const { error } = await supabase
      .from("solicitacao_reparo_aberta")
      .update({ fechado_em: new Date().toISOString(), fechado_por: quem })
      .in("id_reclamacao", ids);
    setSalvando(false);
    setGrupoFechando(null);
    if (error) {
      alert("Falha ao fechar: " + error.message);
      carregar();
    }
  }

  const {
    semPlacaMec, semPlacaEle,
    comPlacaMec, comPlacaEle,
    fechadasMec, fechadasEle,
  } = useMemo(() => {
    // SEM PLACA: aberta no TransNet, ainda nao triada pelo auxiliar.
    const semPlaca = srs.filter((s) => !s.triado_em && !s.fechado_em);
    // COM PLACA: auxiliar ja colocou a placa, manutencao pode comecar.
    const comPlaca = srs.filter((s) => s.triado_em && !s.fechado_em);
    // FECHADAS: depois do corte das 20h.
    const fechadas = srs.filter(
      (s) => s.fechado_em && new Date(s.fechado_em) >= corte,
    );
    fechadas.sort((a, b) => String(b.fechado_em).localeCompare(String(a.fechado_em)));
    return {
      semPlacaMec: agruparPorPrefixo(semPlaca.filter((s) => s.categoria === "mecanica")),
      semPlacaEle: agruparPorPrefixo(semPlaca.filter((s) => s.categoria === "eletrica")),
      comPlacaMec: agruparPorPrefixo(comPlaca.filter((s) => s.categoria === "mecanica")),
      comPlacaEle: agruparPorPrefixo(comPlaca.filter((s) => s.categoria === "eletrica")),
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
        <div className="text-sm text-slate-600 ml-2">
          Próx. atualização em{" "}
          <span className="font-mono font-bold text-slate-900">
            {formatCountdown(proximoEm)}
          </span>
        </div>
        <button
          onClick={() => dispararBot()}
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
        <div className="flex-1 min-h-0 grid grid-rows-3 gap-2">
          {/* Linha 1: SEM PLACA — auxiliar ainda nao triou */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 min-h-0">
            <ColunaAberto titulo="Sem placa · Mecânica" icone={<FaWrench />} cor="mecanica" grupos={semPlacaMec} onFechar={setGrupoFechando} />
            <ColunaAberto titulo="Sem placa · Elétrica" icone={<FaBolt />} cor="eletrica" grupos={semPlacaEle} onFechar={setGrupoFechando} />
          </div>
          {/* Linha 2: COM PLACA — chegou na garagem, pronto pra executar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 min-h-0">
            <ColunaAberto titulo="Com placa · Mecânica" icone={<FaWrench />} cor="mecanica" grupos={comPlacaMec} onFechar={setGrupoFechando} comPlaca />
            <ColunaAberto titulo="Com placa · Elétrica" icone={<FaBolt />} cor="eletrica" grupos={comPlacaEle} onFechar={setGrupoFechando} comPlaca />
          </div>
          {/* Linha 3: FECHADAS pos corte 20:00 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 min-h-0">
            <ColunaFechadas titulo="Fechadas · Mecânica" icone={<FaWrench />} cor="mecanica" srs={fechadasMec} />
            <ColunaFechadas titulo="Fechadas · Elétrica" icone={<FaBolt />} cor="eletrica" srs={fechadasEle} />
          </div>
        </div>
      )}

      {grupoFechando && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5">
            <h2 className="text-lg font-bold mb-1">Fechar SR</h2>
            <p className="text-sm text-slate-600 mb-3">
              Confirma fechamento do prefixo{" "}
              <span className="font-bold text-slate-900">{grupoFechando.prefixo}</span>{" "}
              ({grupoFechando.srs.length}{" "}
              {grupoFechando.srs.length > 1 ? "SRs" : "SR"})?
            </p>
            <ul className="bg-slate-50 rounded p-2 text-xs space-y-1 max-h-40 overflow-auto mb-4">
              {grupoFechando.srs.map((sr) => (
                <li key={sr.id_reclamacao}>
                  <span className="text-slate-500 mr-1">#{sr.codigo}</span>
                  <span className="font-medium">{sr.motivo}</span>
                  {sr.observacao && (
                    <span className="text-slate-500"> · {sr.observacao}</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setGrupoFechando(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-sm"
                disabled={salvando}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarFechar}
                className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm disabled:opacity-50"
                disabled={salvando}
              >
                {salvando ? "Fechando..." : "Confirmar fechamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
