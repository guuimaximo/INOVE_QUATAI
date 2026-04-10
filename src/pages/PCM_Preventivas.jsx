// src/pages/PCM_Preventivas.jsx
import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { 
  FaPlus, 
  FaTimes, 
  FaWrench, 
  FaCalendarAlt, 
  FaBus, 
  FaClipboardList, 
  FaUserTie,
  FaInbox,
  FaRoad
} from "react-icons/fa";
import CampoMotorista from "../components/CampoMotorista";

export default function PCM_Preventivas() {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prefixos, setPrefixos] = useState([]);
  const [listaPreventivas, setListaPreventivas] = useState([]);

  const [form, setForm] = useState({
    prefixo: "",
    numero_os: "",
    km_veiculo: "",
    data_realizacao: new Date().toISOString().split("T")[0],
    tipo: "Preventiva - 10.000",
    mecanico: { chapa: "", nome: "" },
    eletricista: { chapa: "", nome: "" },
    funilaria: { chapa: "", nome: "" },
    borracharia: { chapa: "", nome: "" },
  });

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    const { data: prefixosData } = await supabase
      .from("prefixos")
      .select("codigo")
      .order("codigo");
    setPrefixos(prefixosData || []);

    const { data: prevData } = await supabase
      .from("preventivas")
      .select("*")
      .order("created_at", { ascending: false });
    setListaPreventivas(prevData || []);
  }

  const formatarColaborador = (colab) => {
    return colab?.nome ? `${colab.chapa} - ${colab.nome}` : null;
  };

  async function salvarPreventiva() {
    if (!form.prefixo || !form.numero_os || !form.km_veiculo || !form.tipo || !form.mecanico.nome || !form.eletricista.nome) {
      alert("Preencha os campos obrigatórios (Prefixo, OS, KM, Tipo, Mecânico, Eletricista)!");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        prefixo: form.prefixo,
        numero_os: form.numero_os,
        km_veiculo: Number(form.km_veiculo),
        data_realizacao: form.data_realizacao,
        tipo: form.tipo,
        mecanico: formatarColaborador(form.mecanico),
        eletricista: formatarColaborador(form.eletricista),
        funilaria: form.tipo === "Preventiva - 10.000" ? formatarColaborador(form.funilaria) : null,
        borracharia: form.tipo === "Preventiva - 10.000" ? formatarColaborador(form.borracharia) : null,
      };

      const { error } = await supabase.from("preventivas").insert(payload);
      if (error) throw error;

      alert("Preventiva registrada com sucesso!");
      setModalOpen(false);
      setForm({
        prefixo: "",
        numero_os: "",
        km_veiculo: "",
        data_realizacao: new Date().toISOString().split("T")[0],
        tipo: "Preventiva - 10.000",
        mecanico: { chapa: "", nome: "" },
        eletricista: { chapa: "", nome: "" },
        funilaria: { chapa: "", nome: "" },
        borracharia: { chapa: "", nome: "" },
      });
      carregarDados();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white rounded-2xl border shadow-sm p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black border border-blue-200 mb-2">
            <FaWrench /> Gestão de Frota
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800">Controle de Preventivas</h1>
          <p className="text-sm text-slate-500 mt-1">Acompanhamento e registro de manutenções preventivas e inspeções.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-xl shadow-md transition-all active:scale-95"
        >
          <FaPlus /> Nova Preventiva
        </button>
      </div>

      {/* Tabela de Registros */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
          <FaClipboardList className="text-slate-400" />
          <h2 className="font-bold text-slate-700">Histórico de Lançamentos</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-slate-500 uppercase font-bold text-[11px] tracking-wider border-b">
              <tr>
                <th className="px-6 py-4">OS</th>
                <th className="px-6 py-4">Prefixo</th>
                <th className="px-6 py-4">KM</th>
                <th className="px-6 py-4">Data Realização</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Mecânico</th>
                <th className="px-6 py-4">Eletricista</th>
                <th className="px-6 py-4">Funilaria</th>
                <th className="px-6 py-4">Borracharia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listaPreventivas.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-black text-slate-700">#{item.numero_os}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border">
                      <FaBus className="text-slate-400 text-xs" /> {item.prefixo}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-600">
                    {item.km_veiculo ? Number(item.km_veiculo).toLocaleString('pt-BR') : "-"}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-600">
                    {item.data_realizacao ? item.data_realizacao.split("-").reverse().join("/") : "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${item.tipo.includes('10.000') ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                      <FaWrench size={10} /> {item.tipo}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{item.mecanico || "-"}</td>
                  <td className="px-6 py-4 text-slate-600">{item.eletricista || "-"}</td>
                  <td className="px-6 py-4 text-slate-600">{item.funilaria || "-"}</td>
                  <td className="px-6 py-4 text-slate-600">{item.borracharia || "-"}</td>
                </tr>
              ))}
              
              {listaPreventivas.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <FaInbox size={48} className="mb-4 text-slate-300" />
                      <p className="text-lg font-bold text-slate-600">Nenhum registro encontrado</p>
                      <p className="text-sm mt-1">Os lançamentos de preventivas e inspeções aparecerão aqui.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Lançamento */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-5 border-b flex items-center justify-between bg-white relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-transparent opacity-50"></div>
              <div className="relative flex items-center gap-3">
                <div className="bg-blue-600 text-white p-2 rounded-lg">
                  <FaWrench />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">Lançar Manutenção</h2>
                  <p className="text-xs text-slate-500 font-medium">Preencha os dados da preventiva ou inspeção</p>
                </div>
              </div>
              <button 
                onClick={() => setModalOpen(false)} 
                className="relative text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition-colors"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
              
              {/* Bloco 1: Dados Principais */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Dados da Ordem</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <FaBus className="text-slate-400" /> Prefixo <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={form.prefixo}
                      onChange={(e) => setForm({ ...form, prefixo: e.target.value })}
                      className="w-full border border-slate-300 rounded-xl p-3 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-700 font-semibold"
                    >
                      <option value="">Selecione...</option>
                      {prefixos.map((p) => (
                        <option key={p.codigo} value={p.codigo}>{p.codigo}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <FaClipboardList className="text-slate-400" /> Número da OS <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.numero_os}
                      onChange={(e) => setForm({ ...form, numero_os: e.target.value })}
                      className="w-full border border-slate-300 rounded-xl p-3 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-700 font-semibold"
                      placeholder="Ex: 12345"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <FaRoad className="text-slate-400" /> KM do Veículo <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={form.km_veiculo}
                      onChange={(e) => setForm({ ...form, km_veiculo: e.target.value })}
                      className="w-full border border-slate-300 rounded-xl p-3 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-700 font-semibold"
                      placeholder="Ex: 150000"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <FaCalendarAlt className="text-slate-400" /> Data <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.data_realizacao}
                      onChange={(e) => setForm({ ...form, data_realizacao: e.target.value })}
                      className="w-full border border-slate-300 rounded-xl p-3 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-700 font-semibold"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <FaWrench className="text-slate-400" /> Tipo <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={form.tipo}
                      onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                      className={`w-full border rounded-xl p-3 focus:ring-4 outline-none transition-all font-bold ${
                        form.tipo.includes('10.000') 
                        ? 'border-amber-300 bg-amber-50 text-amber-800 focus:ring-amber-500/20' 
                        : 'border-emerald-300 bg-emerald-50 text-emerald-800 focus:ring-emerald-500/20'
                      }`}
                    >
                      <option value="Preventiva - 10.000">Preventiva - 10.000</option>
                      <option value="Inspeção - 5.000">Inspeção - 5.000</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Bloco 2: Colaboradores */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Equipe Técnica</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <FaUserTie className="text-slate-400" /> Mecânico <span className="text-rose-500">*</span>
                    </label>
                    <CampoMotorista 
                      value={form.mecanico} 
                      onChange={(val) => setForm({ ...form, mecanico: val })} 
                    />
                  </div>
                  
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <FaUserTie className="text-slate-400" /> Eletricista <span className="text-rose-500">*</span>
                    </label>
                    <CampoMotorista 
                      value={form.eletricista} 
                      onChange={(val) => setForm({ ...form, eletricista: val })} 
                    />
                  </div>

                  {form.tipo === "Preventiva - 10.000" && (
                    <>
                      <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                          <FaUserTie className="text-slate-400" /> Funilaria
                        </label>
                        <CampoMotorista 
                          value={form.funilaria} 
                          onChange={(val) => setForm({ ...form, funilaria: val })} 
                        />
                      </div>
                      <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                          <FaUserTie className="text-slate-400" /> Borracharia
                        </label>
                        <CampoMotorista 
                          value={form.borracharia} 
                          onChange={(val) => setForm({ ...form, borracharia: val })} 
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>

            <div className="px-6 py-5 border-t bg-white flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-6 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvarPreventiva}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-95 flex items-center gap-2 disabled:opacity-70 disabled:active:scale-100"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Salvando...
                  </>
                ) : (
                  "Salvar Registro"
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
