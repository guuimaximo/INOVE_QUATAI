// PCM · PASSAGEM DE TURNO DA MANUTENÇÃO — a lista (27/09/2026). O molde é a passagem do
// Operacional: um botão para o turno de agora e o histórico, uma linha por dia e turno, a
// linha inteira abre a passagem.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaCalendarAlt, FaExclamationTriangle, FaLock, FaPlay, FaSearch, FaTools } from "react-icons/fa";
import { supabase } from "../../supabase";
import { dataBR, dataPorExtenso, useRelogio } from "../operacional/passagemTurno";
import {
  TABELA_AUSENCIAS, TABELA_LIBERACOES, TABELA_PASSAGENS, aderencia, situacaoDaPassagem, turnoAgora, turnoPorId,
} from "./passagemTurnoPcm";

export default function PCMPassagemInicio() {
  const navigate = useNavigate();
  const agora = useRelogio();
  const atual = turnoAgora(agora);
  const [passagens, setPassagens] = useState([]);
  const [contagem, setContagem] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const abrir = (dia, turno) => navigate(`/pcm-passagem-turno/${dia}/${String(turno).toLowerCase()}`);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from(TABELA_PASSAGENS)
          .select("id, data_referencia, turno, turno_inicio, turno_fim, responsaveis, alerta, previsto, atendido, atualizado_por, atualizado_em")
          .order("data_referencia", { ascending: false })
          .order("turno", { ascending: false })
          .limit(200);
        if (error) throw error;
        if (!ativo) return;
        setPassagens(data || []);
        const ids = (data || []).map((p) => p.id);
        if (ids.length) {
          const [l, a] = await Promise.all([
            supabase.from(TABELA_LIBERACOES).select("passagem_id").in("passagem_id", ids),
            supabase.from(TABELA_AUSENCIAS).select("passagem_id").in("passagem_id", ids),
          ]);
          const c = {};
          const bump = (id, k) => { c[id] = c[id] || { lib: 0, aus: 0 }; c[id][k] += 1; };
          (l.data || []).forEach((r) => bump(r.passagem_id, "lib"));
          (a.data || []).forEach((r) => bump(r.passagem_id, "aus"));
          if (ativo) setContagem(c);
        }
      } catch (e) {
        if (ativo) setErro(e?.message || "Não foi possível carregar as passagens.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [atual.dia, atual.turno]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return passagens;
    return passagens.filter((p) => dataBR(p.data_referencia).includes(q) || String(p.responsaveis || "").toLowerCase().includes(q));
  }, [passagens, busca]);

  const temAtual = passagens.some((p) => p.data_referencia === atual.dia && p.turno === atual.turno);

  return (
    <div className="min-h-screen bg-slate-50 p-4 space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black border border-slate-200">
              <FaTools /> PCM
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 mt-3">Passagem de turno · Manutenção</h1>
            <p className="text-sm text-slate-500 mt-1 font-semibold">
              O relatório do turno da oficina: alerta, liberações, etiquetas, ausências, desvios e aderência.
            </p>
          </div>
          <button type="button" onClick={() => abrir(atual.dia, atual.turno)}
            className="px-5 py-3 rounded-xl bg-slate-900 text-white font-black inline-flex items-center gap-2 hover:bg-slate-700 shadow-sm">
            <FaPlay /> {temAtual ? "Continuar" : "Abrir"} o turno {turnoPorId(atual.turno).label.toLowerCase()} de {dataBR(atual.dia).slice(0, 5)}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <FaSearch className="text-slate-400" />
          <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Buscar por data (26/09) ou responsável"
            value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {erro && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-3 py-2 mb-3">{erro}</div>}
        {carregando ? (
          <div className="text-center text-slate-500 py-8 font-semibold">Carregando…</div>
        ) : !visiveis.length ? (
          <div className="text-center text-slate-500 py-8">Nenhuma passagem lançada ainda. Use o botão acima para abrir o turno de agora.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Dia</th>
                  <th className="pr-3">Turno</th>
                  <th className="pr-3">Responsáveis</th>
                  <th className="pr-3">Liberações</th>
                  <th className="pr-3">Ausências</th>
                  <th className="pr-3">Aderência</th>
                  <th className="pr-3">Última alteração</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((p) => {
                  const c = contagem[p.id] || { lib: 0, aus: 0 };
                  const pct = aderencia(p.previsto, p.atendido);
                  const aberto = situacaoDaPassagem(p.data_referencia, p.turno, agora) === "aberto";
                  return (
                    <tr key={p.id} tabIndex={0} title={`Abrir a passagem de ${dataBR(p.data_referencia)} · ${turnoPorId(p.turno).label}`}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer focus:outline-none focus:bg-slate-50"
                      onClick={(e) => { if (!e.target.closest("a")) abrir(p.data_referencia, p.turno); }}
                      onKeyDown={(e) => { if (e.key === "Enter") abrir(p.data_referencia, p.turno); }}>
                      <td className="py-2 pr-3">
                        <Link to={`/pcm-passagem-turno/${p.data_referencia}/${String(p.turno).toLowerCase()}`} className="font-bold text-blue-700 inline-flex items-center gap-2">
                          <FaCalendarAlt /> {dataBR(p.data_referencia)}
                        </Link>
                        <div className="text-xs text-slate-500 capitalize">{dataPorExtenso(p.data_referencia).split(",")[0]}</div>
                        {aberto ? (
                          <div className="mt-0.5 inline-block px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">Aberto</div>
                        ) : (
                          <div className="mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold"><FaLock /> Somente leitura</div>
                        )}
                      </td>
                      <td className="pr-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-black ${p.turno === "NOTURNO" ? "bg-slate-800 text-white" : "bg-amber-100 text-amber-800"}`}>
                          {turnoPorId(p.turno).label}
                        </span>
                        <div className="text-[11px] text-slate-400 mt-0.5">{p.turno_inicio}–{p.turno_fim}</div>
                        {String(p.alerta || "").trim() && (
                          <div className="text-[11px] font-bold text-red-600 inline-flex items-center gap-1 mt-0.5"><FaExclamationTriangle /> alerta</div>
                        )}
                      </td>
                      <td className="pr-3">{p.responsaveis || "—"}</td>
                      <td className="pr-3 font-bold">{c.lib}</td>
                      <td className="pr-3">{c.aus}</td>
                      <td className="pr-3">
                        {pct == null ? "—" : <b className={pct >= 100 ? "text-emerald-600" : pct >= 80 ? "text-amber-600" : "text-red-600"}>{pct}%</b>}
                        {p.previsto != null && <span className="text-xs text-slate-400"> ({p.atendido ?? "—"}/{p.previsto})</span>}
                      </td>
                      <td className="pr-3 text-xs text-slate-500">
                        {p.atualizado_por || "—"}
                        {p.atualizado_em ? ` · ${new Date(p.atualizado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
