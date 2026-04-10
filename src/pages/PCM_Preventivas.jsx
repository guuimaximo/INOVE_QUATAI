// src/pages/PCM_Preventivas.jsx
import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { FaPlus, FaTimes } from "react-icons/fa";
import CampoMotorista from "../components/CampoMotorista";

export default function PCM_Preventivas() {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prefixos, setPrefixos] = useState([]);
  const [listaPreventivas, setListaPreventivas] = useState([]);

  // Atualizado para usar o formato do CampoMotorista
  const [form, setForm] = useState({
    prefixo: "",
    numero_os: "",
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
    // Busca prefixos
    const { data: prefixosData } = await supabase
      .from("prefixos")
      .select("codigo")
      .order("codigo");
    setPrefixos(prefixosData || []);

    // Busca preventivas cadastradas
    const { data: prevData } = await supabase
      .from("preventivas")
      .select("*")
      .order("created_at", { ascending: false });
    setListaPreventivas(prevData || []);
  }

  // Função auxiliar para extrair o nome ou juntar chapa + nome para o banco
  const formatarColaborador = (colab) => {
    return colab?.nome ? `${colab.chapa} - ${colab.nome}` : null;
  };

  async function salvarPreventiva() {
    if (!form.prefixo || !form.numero_os || !form.tipo || !form.mecanico.nome || !form.eletricista.nome) {
      alert("Preencha os campos obrigatórios (Prefixo, OS, Tipo, Mecânico, Eletricista)!");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        prefixo: form.prefixo,
        numero_os: form.numero_os,
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
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-800">Controle de Preventivas</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl shadow transition"
        >
          <FaPlus /> Nova Preventiva
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-xs border-b">
              <tr>
                <th className="px-4 py-3">OS</th>
                <th className="px-4 py-3">Prefixo</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Mecânico</th>
                <th className="px-4 py-3">Eletricista</th>
                <th className="px-4 py-3">Funilaria</th>
                <th className="px-4 py-3">Borracharia</th>
              </tr>
            </thead>
            <tbody>
              {listaPreventivas.map((item) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold">{item.numero_os}</td>
                  <td className="px-4 py-3 font-black text-slate-800">{item.prefixo}</td>
                  <td className="px-4 py-3">
                    {item.data_realizacao ? item.data_realizacao.split("-").reverse().join("/") : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${item.tipo.includes('10.000') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {item.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">{item.mecanico || "-"}</td>
                  <td className="px-4 py-3">{item.eletricista || "-"}</td>
                  <td className="px-4 py-3">{item.funilaria || "-"}</td>
                  <td className="px-4 py-3">{item.borracharia || "-"}</td>
                </tr>
              ))}
              {listaPreventivas.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-4 py-6 text-center text-slate-500 font-semibold">
                    Nenhuma preventiva registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50">
              <h2 className="text-xl font-black text-slate-800">Lançar Preventiva / Inspeção</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-rose-600 transition">
                <FaTimes size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Prefixo</label>
                  <select
                    value={form.prefixo}
                    onChange={(e) => setForm({ ...form, prefixo: e.target.value })}
                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-200 outline-none"
                  >
                    <option value="">Selecione...</option>
                    {prefixos.map((p) => (
                      <option key={p.codigo} value={p.codigo}>{p.codigo}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Número da OS</label>
                  <input
                    type="text"
                    value={form.numero_os}
                    onChange={(e) => setForm({ ...form, numero_os: e.target.value })}
                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-200 outline-none"
                    placeholder="Ex: 12345"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Data da Realização</label>
                  <input
                    type="date"
                    value={form.data_realizacao}
                    onChange={(e) => setForm({ ...form, data_realizacao: e.target.value })}
                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tipo de Preventiva</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-200 outline-none font-semibold text-slate-800"
                >
                  <option value="Preventiva - 10.000">Preventiva - 10.000</option>
                  <option value="Inspeção - 5.000">Inspeção - 5.000</option>
                </select>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border space-y-4">
                <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wider">Colaboradores</h3>
                
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Mecânico</label>
                    <CampoMotorista 
                      value={form.mecanico} 
                      onChange={(val) => setForm({ ...form, mecanico: val })} 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Eletricista</label>
                    <CampoMotorista 
                      value={form.eletricista} 
                      onChange={(val) => setForm({ ...form, eletricista: val })} 
                    />
                  </div>

                  {form.tipo === "Preventiva - 10.000" && (
                    <>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Funilaria</label>
                        <CampoMotorista 
                          value={form.funilaria} 
                          onChange={(val) => setForm({ ...form, funilaria: val })} 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Borracharia</label>
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

            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-5 py-2.5 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition"
              >
                Cancelar
              </button>
              <button
                onClick={salvarPreventiva}
                disabled={loading}
                className="px-5 py-2.5 rounded-lg font-bold bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50"
              >
                {loading ? "Salvando..." : "Salvar Registro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
