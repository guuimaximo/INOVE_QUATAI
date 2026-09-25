// OPERACIONAL · PASSAGEM DE TURNO — a lista dos dias (25/09/2026). O molde é o PCM Início:
// um botão para o dia de hoje e o histórico, cada dia com o resumo do que foi lançado.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaCalendarAlt, FaPlay, FaSearch, FaExchangeAlt, FaLock } from "react-icons/fa";
import { supabase } from "../../supabase";
import {
  TABELA_FALTAS, TABELA_INTERCORRENCIAS, TABELA_TURNOS, dataBR, dataPorExtenso, isoLocal, situacaoDoDia, somaDias, useRelogio,
} from "./passagemTurno";

export default function PassagemTurnoInicio() {
  const navigate = useNavigate();
  const [dias, setDias] = useState([]);
  const [contagem, setContagem] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  // o relógio vira o dia à 00:00 com a tela aberta: o botão passa a abrir o dia novo
  const agora = useRelogio();
  const hoje = isoLocal(new Date(agora));
  const abrirDia = (d) => navigate(`/operacional/passagem-turno/${d}`);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from(TABELA_TURNOS)
          .select("id, data_referencia, carros_programados, gns, faixa_amarela, sos, avaria, troca, recolha, seguiu_viagem, assalto, criado_por, atualizado_por, atualizado_em")
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
            onClick={() => abrirDia(hoje)}
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
                  <th className="pr-3">GNS · Faixa amarela</th>
                  <th className="pr-3">Faltas</th>
                  <th className="pr-3">Intercorrências</th>
                  <th className="pr-3" title="SOS · Avaria · Troca · Recolha · Seguiu viagem · Assalto">Ocorrências (SOS · Av · Tr · Rec · SV · Ass)</th>
                  <th className="pr-3">Última alteração</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((d) => {
                  const c = contagem[d.data_referencia] || { faltas: 0, inter: 0 };
                  const aberto = situacaoDoDia(d.data_referencia, agora) === "aberto";
                  return (
                    // a linha inteira abre o dia (dono, 25/09/2026); o link da data segue para
                    // abrir em outra aba, e o clique nele não navega duas vezes
                    <tr
                      key={d.id}
                      tabIndex={0}
                      title={`Abrir a passagem de ${dataBR(d.data_referencia)}`}
                      className="border-b border-slate-100 hover:bg-teal-50/60 cursor-pointer focus:outline-none focus:bg-teal-50/60"
                      onClick={(e) => { if (!e.target.closest("a")) abrirDia(d.data_referencia); }}
                      onKeyDown={(e) => { if (e.key === "Enter") abrirDia(d.data_referencia); }}
                    >
                      <td className="py-2 pr-3">
                        <Link to={`/operacional/passagem-turno/${d.data_referencia}`} className="font-bold text-blue-700 inline-flex items-center gap-2">
                          <FaCalendarAlt /> {dataBR(d.data_referencia)}
                        </Link>
                        <div className="text-xs text-slate-500 capitalize">{dataPorExtenso(d.data_referencia).split(",")[0]}</div>
                        {aberto ? (
                          <div className="mt-0.5 inline-block px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                            Aberto até 10h de {dataBR(somaDias(d.data_referencia, 1)).slice(0, 5)}
                          </div>
                        ) : (
                          <div className="mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold">
                            <FaLock /> Somente leitura
                          </div>
                        )}
                      </td>
                      <td className="pr-3 font-bold">{d.carros_programados ?? "—"}</td>
                      <td className="pr-3">{d.gns ?? "—"} · {d.faixa_amarela ?? "—"}</td>
                      <td className="pr-3">{c.faltas}</td>
                      <td className="pr-3">{c.inter}</td>
                      <td className="pr-3 font-mono">{[d.sos, d.avaria, d.troca, d.recolha, d.seguiu_viagem, d.assalto].map((v) => v ?? "—").join(" · ")}</td>
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
