// src/pages/PCMInicio.jsx
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../supabase";
import { useNavigate } from "react-router-dom";
import {
  FaSearch,
  FaCalendarAlt,
  FaCalendarCheck,
  FaLock,
  FaLockOpen,
  FaInfoCircle,
  FaTimes,
  FaPlus,
  FaHistory,
  FaArrowRight
} from "react-icons/fa";

/* ==========================
   HELPERS (DATA / CORTE)
========================== */

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function subDaysISO(iso, days = 1) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function canEditPCM(dataRefISO) {
  try {
    if (!dataRefISO) return false;
    const ref = new Date(`${dataRefISO}T00:00:00`);
    const deadline = new Date(ref);
    deadline.setDate(deadline.getDate() + 1);
    deadline.setHours(10, 0, 0, 0);
    return Date.now() <= deadline.getTime();
  } catch {
    return false;
  }
}

function formatBR(iso) {
  try {
    if (!iso) return "-";
    return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

/* =========================
   COMPONENTES UI GERAIS
========================= */

function CardKPI({ title, value, sub, icon, tone = "blue", className = "" }) {
  const tones = {
    blue: "from-blue-50 to-cyan-50 border-blue-200 text-blue-700",
    emerald: "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700",
    amber: "from-amber-50 to-orange-50 border-amber-200 text-amber-700",
    rose: "from-rose-50 to-pink-50 border-rose-200 text-rose-700",
    violet: "from-violet-50 to-fuchsia-50 border-violet-200 text-violet-700",
    slate: "from-slate-50 to-gray-50 border-slate-200 text-slate-700",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${tones[tone]} p-4 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3 h-full">
        <div className="flex flex-col justify-between h-full">
          <p className="text-xs font-black uppercase tracking-wider opacity-80">{title}</p>
          <div>
            <p className="text-2xl md:text-3xl font-black mt-2 text-slate-800">{value}</p>
            {sub && <p className="text-[11px] mt-1 font-bold opacity-80">{sub}</p>}
          </div>
        </div>
        <div className="text-xl mt-1 opacity-80">{icon}</div>
      </div>
    </div>
  );
}

/* =========================
   MODAL DE EXPLICAÇÃO
========================= */

function ExplicacaoModal({ onClose }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-[70] animate-in fade-in duration-200 p-4">
      <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4 border-b pb-4 shrink-0">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <FaInfoCircle className="text-blue-600" /> Como funciona o PCM Diário?
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition">
            <FaTimes size={20} />
          </button>
        </div>

        <div className="overflow-y-auto pr-2 space-y-5 text-sm text-slate-700">
          
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
            <h3 className="font-black text-emerald-900 mb-2 flex items-center gap-2"><FaCalendarCheck className="text-emerald-600"/> Virada Automática (Herança)</h3>
            <p>Sempre que você clica em <strong>"Abrir PCM do Dia"</strong>, o sistema vasculha o PCM do dia anterior. Todos os veículos que estavam <strong>"Em Aberto"</strong> (sem saída) são copiados automaticamente para o dia de hoje.</p>
            <p className="mt-2 text-xs font-bold text-emerald-800">Isso garante que o <em>Aging</em> (idade da fila) nunca se perca e você não precise relançar os mesmos carros todos os dias.</p>
          </div>

          <div className="bg-rose-50 p-4 rounded-xl border border-rose-200">
            <h3 className="font-black text-rose-900 mb-2 flex items-center gap-2"><FaLock className="text-rose-600"/> Regra de Fechamento (10:00 AM)</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>O PCM de hoje é totalmente editável (lançar, mover, liberar) até as <strong>10:00 da manhã de amanhã</strong>.</li>
              <li>Após esse horário, o PCM é trancado com um cadeado e vira um documento oficial de <strong>Somente Consulta</strong>, preservando o histórico daquele dia.</li>
            </ul>
          </div>

        </div>

        <div className="mt-5 pt-4 border-t flex justify-end shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition shadow-md active:scale-95">
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================
   PÁGINA PRINCIPAL
========================== */

export default function PCMInicio() {
  const [pcms, setPcms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busca, setBusca] = useState("");
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    buscarPCMs();
  }, []);

  async function buscarPCMs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("pcm_diario")
      .select("*")
      .order("data_referencia", { ascending: false });

    if (error) console.error(error);
    setPcms(data || []);
    setLoading(false);
  }

  async function herdarVeiculosEmAberto({ pcmNovoId, dataRefHoje }) {
    const dataOntem = subDaysISO(dataRefHoje, 1);

    const { data: pcmAnterior, error: errPcmAnterior } = await supabase
      .from("pcm_diario")
      .select("id, data_referencia")
      .eq("data_referencia", dataOntem)
      .single();

    if (errPcmAnterior || !pcmAnterior?.id) return;

    const { data: veicsAbertos, error: errVeics } = await supabase
      .from("veiculos_pcm")
      .select("*")
      .eq("pcm_id", pcmAnterior.id)
      .is("data_saida", null);

    if (errVeics) {
      console.error(errVeics);
      return;
    }

    if (!veicsAbertos?.length) return;

    const now = new Date().toISOString();

    const novos = veicsAbertos.map((v) => ({
      pcm_id: pcmNovoId,
      frota: v.frota || null,
      setor: v.setor || "MANUTENÇÃO",
      descricao: v.descricao || "",
      categoria: v.categoria || "PENDENTES",
      ordem_servico: v.ordem_servico || null,
      previsao: v.previsao || null,
      observacao: v.observacao || null,
      lancado_por: "Sistema (Virada PCM)",
      lancado_no_turno: "NOITE",
      // ✅ MATADOR: Preserva as datas originais para o Aging não bugar!
      data_entrada: v.data_entrada || now,
      data_mudanca_categoria: v.data_mudanca_categoria || v.data_entrada || now,
    }));

    const { data: jaNoNovoPCM, error: errDup } = await supabase
      .from("veiculos_pcm")
      .select("frota")
      .eq("pcm_id", pcmNovoId)
      .is("data_saida", null);

    if (errDup) console.error(errDup);

    const frotaJaExiste = new Set((jaNoNovoPCM || []).map((x) => String(x.frota)));
    const finalInsert = novos.filter((n) => !frotaJaExiste.has(String(n.frota)));

    if (!finalInsert.length) return;

    const { error: errInsert } = await supabase.from("veiculos_pcm").insert(finalInsert);
    if (errInsert) console.error(errInsert);
  }

  async function criarNovoDia() {
    if (creating) return;
    setCreating(true);

    try {
      const hoje = todayISO();

      const { data: existing, error: errExisting } = await supabase
        .from("pcm_diario")
        .select("id, data_referencia")
        .eq("data_referencia", hoje)
        .maybeSingle();

      if (errExisting) {
        console.error(errExisting);
        alert("Erro ao validar PCM do dia.");
        return;
      }

      if (existing?.id) {
        return navigate(`/pcm-diario/${existing.id}`);
      }

      const { data: novo, error: errCreate } = await supabase
        .from("pcm_diario")
        .insert([{ data_referencia: hoje, criado_por: "Sistema" }])
        .select()
        .single();

      if (errCreate) {
        alert("Erro ao criar PCM do dia: " + errCreate.message);
        return;
      }

      await herdarVeiculosEmAberto({ pcmNovoId: novo.id, dataRefHoje: hoje });

      await buscarPCMs();
      navigate(`/pcm-diario/${novo.id}`);
    } finally {
      setCreating(false);
    }
  }

  // Lógica de Filtro
  const pcmsFiltrados = useMemo(() => {
    if (!busca) return pcms;
    const q = busca.toLowerCase();
    return pcms.filter(p => 
      (p.data_referencia && formatBR(p.data_referencia).includes(q)) ||
      (p.criado_por && p.criado_por.toLowerCase().includes(q))
    );
  }, [pcms, busca]);

  // KPIs
  const kpis = useMemo(() => {
    return {
      total: pcms.length,
      editaveis: pcms.filter(p => canEditPCM(p.data_referencia)).length,
      ultimo: pcms[0] ? formatBR(pcms[0].data_referencia) : "-"
    };
  }, [pcms]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 space-y-6">
      
      {/* HEADER PREMIUM */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black border border-blue-200">
              <FaCalendarAlt /> Portal de Lançamentos
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 mt-3 flex items-center gap-3">
              CENTRAL PCM DIÁRIO
            </h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 font-semibold">
              <FaHistory /> Histórico oficial de controle da frota
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setMostrarExplicacao(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-800 font-bold hover:bg-slate-200 transition"
              title="Entender Cálculos"
            >
              <FaInfoCircle /> Regras e Prazos
            </button>

            <button
              onClick={criarNovoDia}
              disabled={creating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-blue-600 bg-blue-600 text-white font-black hover:bg-blue-700 transition shadow-md active:scale-95 disabled:opacity-60"
              title="Abrir o PCM de Hoje"
            >
              <FaPlus /> {creating ? "Criando..." : "Criar / Abrir PCM Hoje"}
            </button>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <FaSearch className="absolute left-3 top-3 text-slate-400" />
            <input 
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-200 outline-none transition" 
              value={busca} 
              onChange={(e) => setBusca(e.target.value)} 
              placeholder="Pesquisar por data (DD/MM/YYYY) ou criador..." 
            />
            {busca && (
              <button onClick={() => setBusca("")} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                <FaTimes />
              </button>
            )}
          </div>
          
          <div className="text-xs text-slate-500 font-bold">
            Mostrando {pcmsFiltrados.length} registro(s)
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardKPI title="Total de PCMs Lançados" value={kpis.total} icon={<FaHistory />} tone="slate" />
        <CardKPI title="PCMs Editáveis no Momento" value={kpis.editaveis} sub="Abertos para alteração" icon={<FaLockOpen />} tone="emerald" />
        <CardKPI title="Último PCM Criado" value={kpis.ultimo} icon={<FaCalendarCheck />} tone="blue" />
      </div>

      {/* TABELA DE HISTÓRICO */}
      <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b bg-slate-50">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Histórico Diário</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[700px]">
            <thead className="bg-white border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4 font-black w-1/4">Data de Referência</th>
                <th className="p-4 font-black w-1/4">Criado Por</th>
                <th className="p-4 font-black w-1/4 text-center">Status Operacional</th>
                <th className="p-4 font-black w-1/4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="bg-slate-50/30">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold">Carregando histórico...</td></tr>
              ) : pcmsFiltrados.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold">Nenhum PCM encontrado.</td></tr>
              ) : (
                pcmsFiltrados.map((pcm) => {
                  const editavel = canEditPCM(pcm.data_referencia);
                  return (
                    <tr key={pcm.id} className="border-b border-slate-200 hover:bg-slate-100 transition-colors group">
                      <td className="p-4 font-black text-lg text-slate-800">
                        {formatBR(pcm.data_referencia)}
                      </td>
                      <td className="p-4 font-semibold text-slate-600">
                        {pcm.criado_por || "Sistema"}
                      </td>
                      <td className="p-4 text-center">
                        {editavel ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider border border-emerald-200">
                            <FaLockOpen /> Editável
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider border border-slate-300">
                            <FaLock /> Fechado (Leitura)
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => navigate(`/pcm-diario/${pcm.id}`)}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all bg-white border border-slate-300 text-slate-700 group-hover:bg-slate-800 group-hover:text-white group-hover:border-slate-800 shadow-sm"
                        >
                          {editavel ? "📝 Preencher" : "👁️ Visualizar"} <FaArrowRight />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE EXPLICAÇÃO */}
      {mostrarExplicacao && (
        <ExplicacaoModal onClose={() => setMostrarExplicacao(false)} />
      )}

    </div>
  );
}
