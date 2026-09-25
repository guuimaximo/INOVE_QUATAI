// OPERACIONAL · PASSAGEM DE TURNO — a lista dos dias (25/09/2026). O molde é o PCM Início:
// um botão para o dia de hoje e o histórico, cada dia com o resumo do que foi lançado.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaCalendarAlt, FaPlay, FaSearch, FaExchangeAlt } from "react-icons/fa";
import { supabase } from "../../supabase";
import { TABELA_FALTAS, TABELA_INTERCORRENCIAS, TABELA_TURNOS, dataBR, dataPorExtenso, isoLocal } from "./passagemTurno";

export default function PassagemTurnoInicio() {
  const navigate = useNavigate();
  const [dias, setDias] = useState([]);
  const [contagem, setContagem] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const hoje = isoLocal();

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from(TABELA_TURNOS)
          .select("id, data_referencia, carros_programados, gns, sos, troca, avaria, assalto, criado_por, atualizado_por, atualizado_em")
          .order("data_referencia", { ascending: false })
          .limit(120);
        if (error) throw error;
        if (!ativo) return;
        setDias(data || []);
        const desde = data?.length ? data[data.length - 1].data_referencia : hoje;
        const [f, i] = await Promise.all([
          supabase.from(TABELA_FALTAS).select("data_referencia, periodo").gte("data_referencia", desde),
          supabase.from(TABELA_INTERCORRENCIAS).select("data_referencia").gte("data_referencia", desde),
        ]);
        const c = {};
        const bump = (d, k) => { c[d] = c[d] || { faltas: 0, inter: 0 }; c[d][k] += 1; };
        (f.data || []).forEach((r) => bump(r.data_referencia, "faltas"));
        (i.data || []).forEach((r) => bump(r.data_referencia, "inter"));
        if (ativo) setContagem(c);
      } catch (e) {
        if (ativo) setErro(e?.message || "Não foi possível carregar os dias.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [hoje]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return dias;
    return dias.filter((d) => dataBR(d.data_referencia).includes(q) || String(d.atualizado_por || "").toLowerCase().includes(q));
  }, [dias, busca]);

  const temHoje = dias.some((d) => d.data_referencia === hoje);

  return (
    <div className="min-h-screen bg-slate-50 p-4 space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-black border border-teal-200">
              <FaExchangeAlt /> Operacional
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 mt-3">Passagem de Turno</h1>
            <p className="text-sm text-slate-500 mt-1 font-semibold">
              O fechamento do plantão, dia a dia: números do turno, faltas e intercorrências dos motoristas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/operacional/passagem-turno/${hoje}`)}
            className="px-5 py-3 rounded-xl bg-teal-700 text-white font-black inline-flex items-center gap-2 hover:bg-teal-600 shadow-sm"
          >
            <FaPlay /> {temHoje ? "Continuar o turno de hoje" : "Abrir o turno de hoje"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <FaSearch className="text-slate-400" />
          <input
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Buscar por data (25/09) ou por quem lançou"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {erro && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-3 py-2 mb-3">{erro}</div>}
        {carregando ? (
          <div className="text-center text-slate-500 py-8 font-semibold">Carregando…</div>
        ) : !visiveis.length ? (
          <div className="text-center text-slate-500 py-8">
            Nenhum dia lançado ainda. Use <b>Abrir o turno de hoje</b> para começar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Dia</th>
                  <th className="pr-3">Carros programados</th>
                  <th className="pr-3">GNS</th>
                  <th className="pr-3">Faltas</th>
                  <th className="pr-3">Intercorrências</th>
                  <th className="pr-3">SOS · Troca · Avaria · Assalto</th>
                  <th className="pr-3">Última alteração</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((d) => {
                  const c = contagem[d.data_referencia] || { faltas: 0, inter: 0 };
                  return (
                    <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 pr-3">
                        <Link to={`/operacional/passagem-turno/${d.data_referencia}`} className="font-bold text-blue-700 inline-flex items-center gap-2">
                          <FaCalendarAlt /> {dataBR(d.data_referencia)}
                        </Link>
                        <div className="text-xs text-slate-500 capitalize">{dataPorExtenso(d.data_referencia).split(",")[0]}</div>
                      </td>
                      <td className="pr-3 font-bold">{d.carros_programados ?? "—"}</td>
                      <td className="pr-3">{d.gns ?? "—"}</td>
                      <td className="pr-3">{c.faltas}</td>
                      <td className="pr-3">{c.inter}</td>
                      <td className="pr-3 font-mono">{[d.sos, d.troca, d.avaria, d.assalto].map((v) => v ?? "—").join(" · ")}</td>
                      <td className="pr-3 text-xs text-slate-500">
                        {d.atualizado_por || d.criado_por || "—"}
                        {d.atualizado_em ? ` · ${new Date(d.atualizado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
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
