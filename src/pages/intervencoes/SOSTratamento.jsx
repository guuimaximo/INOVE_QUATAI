// src/pages/SOSTratamento.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import { FaTools, FaCheckCircle, FaTimes, FaBus, FaCalendarAlt, FaRoad, FaWrench, FaInfoCircle } from "react-icons/fa";

function calcularDiasDecorridos(data) {
  if (!data) return null;

  const hoje = new Date();
  const base = new Date(`${data}T00:00:00`);

  if (Number.isNaN(base.getTime())) return null;

  hoje.setHours(0, 0, 0, 0);
  base.setHours(0, 0, 0, 0);

  const diffMs = hoje.getTime() - base.getTime();
  return diffMs < 0 ? 0 : Math.floor(diffMs / 86400000);
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return dateStr.split("-").reverse().join("/");
}

function formatKM(km) {
  if (!km && km !== 0) return "-";
  return Number(km).toLocaleString("pt-BR");
}

export default function SOSTratamento() {
  const [acionamentos, setAcionamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  async function carregarSOS() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sos_acionamentos")
      .select("*")
      .eq("status", "Em Andamento")
      .order("created_at", { ascending: false });

    if (!error) setAcionamentos(data || []);
    setLoading(false);
  }

  useEffect(() => {
    carregarSOS();
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-slate-800 flex items-center gap-3">
        <FaTools className="text-blue-600" /> Tratamento de Intervenção — Manutenção
      </h1>

      <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[11px] tracking-wider border-b">
              <tr>
                <th className="py-4 px-6">Número</th>
                <th className="py-4 px-6">Data</th>
                <th className="py-4 px-6">Prefixo</th>
                <th className="py-4 px-6">Motorista</th>
                <th className="py-4 px-6">Linha</th>
                <th className="py-4 px-6">Reclamação</th>
                <th className="py-4 px-6">Ocorrência</th>
                <th className="py-4 px-6 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-slate-500 font-medium">
                    <div className="flex flex-col items-center justify-center text-blue-600">
                      <svg className="animate-spin h-8 w-8 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="font-bold text-slate-500">Carregando acionamentos...</span>
                    </div>
                  </td>
                </tr>
              ) : acionamentos.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-16 text-slate-600 font-medium">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <FaInfoCircle size={48} className="mb-4 text-slate-300" />
                      <p className="text-lg font-bold text-slate-600">Nenhum acionamento pendente</p>
                      <p className="text-sm mt-1">Todos os SOS em andamento já foram tratados.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                acionamentos.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-4 px-6 font-black text-slate-700">#{a.numero_sos}</td>
                    <td className="py-4 px-6 font-medium text-slate-600">
                      {new Date(a.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border shadow-sm">
                        <FaBus className="text-slate-400 text-xs" /> {a.veiculo}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-medium">{a.motorista_nome}</td>
                    <td className="py-4 px-6 text-slate-600">{a.linha}</td>
                    <td className="py-4 px-6 text-slate-600 max-w-xs truncate" title={a.reclamacao_motorista}>{a.reclamacao_motorista}</td>
                    <td className="py-4 px-6">
                      <span className="bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm">
                        {a.ocorrencia}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => setSelected(a)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md transition active:scale-95 mx-auto"
                      >
                        <FaTools /> Tratar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <TratamentoModal
          sos={selected}
          onClose={() => setSelected(null)}
          onAtualizar={carregarSOS}
        />
      )}
    </div>
  );
}

// ===============================
// Campo de Mecânico (seleção)
// ===============================
function CampoMecanico({ value, onChange }) {
  const [busca, setBusca] = useState(value?.nome || value?.chapa || "");
  const [opcoes, setOpcoes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setBusca(value?.nome || value?.chapa || "");
  }, [value?.nome, value?.chapa]);

  useEffect(() => {
    let alive = true;

    async function buscar() {
      const termo = (busca || "").trim();
      if (termo.length < 2) {
        setOpcoes([]);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("motoristas")
        .select("chapa, nome, cargo")
        .not("cargo", "ilike", "MOTORISTA%")
        .or(`nome.ilike.%${termo}%,chapa.ilike.%${termo}%`)
        .order("nome", { ascending: true })
        .limit(10);

      if (!alive) return;

      setLoading(false);

      if (error) {
        console.error("Erro ao buscar colaboradores:", error);
        setOpcoes([]);
        return;
      }

      setOpcoes(data || []);
    }

    buscar();
    return () => {
      alive = false;
    };
  }, [busca]);

  function selecionar(m) {
    onChange({ chapa: m.chapa, nome: m.nome });
    setOpcoes([]);
    setBusca(m.nome || m.chapa);
  }

  function limpar() {
    onChange({ chapa: "", nome: "" });
    setBusca("");
    setOpcoes([]);
  }

  return (
    <div className="relative">
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
        Mecânico Executor <span className="text-rose-500">*</span>
      </label>

      <div className="flex gap-2">
        <input
          type="text"
          className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-200 transition text-sm font-medium text-slate-800"
          placeholder="Digite nome ou chapa..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button
          type="button"
          onClick={limpar}
          className="border border-slate-300 rounded-lg px-4 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
        >
          Limpar
        </button>
      </div>

      {loading && <div className="text-xs text-blue-600 font-semibold mt-1">Buscando colaborador...</div>}

      {opcoes.length > 0 && (
        <div className="absolute z-50 mt-2 w-full bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
          {opcoes.map((m) => (
            <button
              key={m.chapa}
              type="button"
              onClick={() => selecionar(m)}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-b-0 transition"
            >
              <div className="text-sm font-bold text-slate-800">{m.nome}</div>
              <div className="text-xs text-slate-500 font-medium">
                Chapa: {m.chapa} • {m.cargo}
              </div>
            </button>
          ))}
        </div>
      )}

      {value?.chapa || value?.nome ? (
        <div className="mt-2 text-xs text-emerald-700 font-bold bg-emerald-50 inline-block px-2.5 py-1.5 rounded-lg border border-emerald-200">
          ✓ Selecionado: {value.nome} ({value.chapa})
        </div>
      ) : null}
    </div>
  );
}

function TratamentoModal({ sos, onClose, onAtualizar }) {
  const [form, setForm] = useState({
    setor_manutencao: "",
    grupo_manutencao: "",
    problema_encontrado: "",
    solucao: "",
    solucionador: "",
    mecanico_executor: { chapa: "", nome: "" },
    numero_os_corretiva: "",
    km_atual_veiculo: "",
    classificacao_controlabilidade: "",
  });

  const [saving, setSaving] = useState(false);
  const [catalogo, setCatalogo] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [defeitos, setDefeitos] = useState([]);
  
  // Histórico de Manutenção Puxado Automaticamente
  const [historicoLoading, setHistoricoLoading] = useState(true);
  const [historico, setHistorico] = useState({
    preventiva: null,
    inspecao: null,
  });

  useEffect(() => {
    async function carregarCatalogo() {
      const { data } = await supabase
        .from("sos_manutencao_catalogo")
        .select("*")
        .order("setor_macro", { ascending: true });
      setCatalogo(data || []);
    }
    carregarCatalogo();
  }, []);

  // Buscar Histórico do Veículo na Tabela de Preventivas (Busca Completa)
  useEffect(() => {
    async function carregarHistorico() {
      if (!sos?.veiculo) return;
      setHistoricoLoading(true);

      const { data: prevData } = await supabase
        .from("preventivas")
        .select("*")
        .eq("prefixo", sos.veiculo)
        .eq("tipo", "Preventiva - 10.000")
        .order("data_realizacao", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: inspData } = await supabase
        .from("preventivas")
        .select("*")
        .eq("prefixo", sos.veiculo)
        .eq("tipo", "Inspeção - 5.000")
        .order("data_realizacao", { ascending: false })
        .limit(1)
        .maybeSingle();

      setHistorico({
        preventiva: prevData || null,
        inspecao: inspData || null,
      });

      setHistoricoLoading(false);
    }
    carregarHistorico();
  }, [sos?.veiculo]);

  useEffect(() => {
    const mecanicoTexto = String(sos?.mecanico_executor || "").trim();
    let chapa = "";
    let nome = "";

    if (mecanicoTexto.includes(" - ")) {
      const [ch, ...rest] = mecanicoTexto.split(" - ");
      chapa = ch || "";
      nome = rest.join(" - ") || "";
    }

    setForm((prev) => ({
      ...prev,
      setor_manutencao: sos?.setor_manutencao || "",
      grupo_manutencao: sos?.grupo_manutencao || "",
      problema_encontrado: sos?.problema_encontrado || "",
      solucao: sos?.solucao || "",
      solucionador: sos?.solucionador || "",
      mecanico_executor: {
        chapa,
        nome,
      },
      numero_os_corretiva: sos?.numero_os_corretiva || "",
      classificacao_controlabilidade: sos?.classificacao_controlabilidade || "",
      km_atual_veiculo: "", 
    }));
  }, [sos]);

  useEffect(() => {
    if (!catalogo.length || !form.setor_manutencao) {
      setGrupos([]);
      return;
    }

    const gruposUnicos = Array.from(
      new Set(
        catalogo
          .filter((c) => c.setor_macro === form.setor_manutencao)
          .map((c) => c.grupo)
      )
    );
    setGrupos(gruposUnicos);
  }, [catalogo, form.setor_manutencao]);

  useEffect(() => {
    if (!catalogo.length || !form.setor_manutencao || !form.grupo_manutencao) {
      setDefeitos([]);
      return;
    }

    const defeitosUnicos = Array.from(
      new Set(
        catalogo
          .filter(
            (c) =>
              c.setor_macro === form.setor_manutencao &&
              c.grupo === form.grupo_manutencao
          )
          .map((c) => c.defeito)
      )
    );
    setDefeitos(defeitosUnicos);
  }, [catalogo, form.setor_manutencao, form.grupo_manutencao]);

  function handleSetorChange(setor) {
    setForm((prev) => ({
      ...prev,
      setor_manutencao: setor,
      grupo_manutencao: "",
      problema_encontrado: "",
    }));
  }

  function handleGrupoChange(grupo) {
    setForm((prev) => ({
      ...prev,
      grupo_manutencao: grupo,
      problema_encontrado: "",
    }));
  }

  const diasUltimaPreventiva = useMemo(
    () => calcularDiasDecorridos(historico.preventiva?.data_realizacao),
    [historico.preventiva?.data_realizacao]
  );

  const diasUltimaInspecao = useMemo(
    () => calcularDiasDecorridos(historico.inspecao?.data_realizacao),
    [historico.inspecao?.data_realizacao]
  );

  const kmAtual = Number(form.km_atual_veiculo) || 0;
  
  const kmPercorridoPreventiva = historico.preventiva?.km_veiculo && kmAtual > 0 
    ? kmAtual - Number(historico.preventiva.km_veiculo) 
    : 0;

  const kmPercorridoInspecao = historico.inspecao?.km_veiculo && kmAtual > 0 
    ? kmAtual - Number(historico.inspecao.km_veiculo) 
    : 0;

  async function salvarTratamento() {
    const mecanicoOk =
      (form.mecanico_executor?.chapa || "").trim() &&
      (form.mecanico_executor?.nome || "").trim();

    if (
      !form.setor_manutencao ||
      !form.grupo_manutencao ||
      !form.problema_encontrado ||
      !form.solucionador ||
      !mecanicoOk ||
      !form.km_atual_veiculo ||
      !form.classificacao_controlabilidade
    ) {
      alert("Preencha todos os campos obrigatórios (incluindo KM Atual)!");
      return;
    }

    setSaving(true);

    const payloadAtualizacao = {
      setor_manutencao: form.setor_manutencao,
      grupo_manutencao: form.grupo_manutencao,
      problema_encontrado: form.problema_encontrado,
      solucao: form.solucao,
      solucionador: form.solucionador,

      mecanico_executor: `${form.mecanico_executor.chapa} - ${form.mecanico_executor.nome}`,
      numero_os_corretiva: form.numero_os_corretiva || null,

      // Salva os dados para histórico estático no SOS
      data_ultima_preventiva: historico.preventiva?.data_realizacao || null,
      km_rodado_preventiva: historico.preventiva?.km_veiculo ? String(historico.preventiva.km_veiculo) : null,
      dias_ultima_preventiva: diasUltimaPreventiva,
      os_ultima_preventiva: historico.preventiva?.numero_os || null,

      data_ultima_inspecao: historico.inspecao?.data_realizacao || null,
      km_rodado_inspecao: historico.inspecao?.km_veiculo ? String(historico.inspecao.km_veiculo) : null,
      dias_ultima_inspecao: diasUltimaInspecao,
      os_ultima_inspecao: historico.inspecao?.numero_os || null,

      classificacao_controlabilidade: form.classificacao_controlabilidade,
      
      // Salva o KM Atual do Veículo no SOS
      km_veiculo_sos: Number(form.km_atual_veiculo),

      data_fechamento: new Date().toISOString(),
      status: "Fechado",
    };

    const { error } = await supabase
      .from("sos_acionamentos")
      .update(payloadAtualizacao)
      .eq("id", sos.id);

    setSaving(false);

    if (error) {
      alert("Erro ao salvar: " + error.message);
      return;
    }

    alert("Tratamento salvo com sucesso ✅");
    onAtualizar();
    onClose();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full animate-in zoom-in-95 max-h-[95vh] overflow-hidden flex flex-col">
        
        {/* Header Modal */}
        <div className="flex justify-between items-center p-5 border-b bg-white relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-transparent opacity-50"></div>
          <div className="relative flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2.5 rounded-lg shadow-sm">
              <FaTools size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">
                Tratamento SOS <span className="text-blue-600">#{sos.numero_sos}</span>
              </h2>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                Veículo: <span className="text-slate-800">{sos.veiculo}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="relative text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Content Modal */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {/* Seção 1: Classificação do Defeito */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2 border-b pb-2">Classificação Técnica</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Setor de Manutenção <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-200 transition text-sm font-medium text-slate-800"
                  value={form.setor_manutencao}
                  onChange={(e) => handleSetorChange(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {Array.from(new Set(catalogo.map((c) => c.setor_macro))).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Grupo <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-200 transition disabled:bg-slate-100 text-sm font-medium text-slate-800"
                  value={form.grupo_manutencao}
                  onChange={(e) => handleGrupoChange(e.target.value)}
                  disabled={!form.setor_manutencao}
                >
                  <option value="">Selecione...</option>
                  {grupos.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Problema encontrado <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-200 transition disabled:bg-slate-100 text-sm font-medium text-slate-800"
                  value={form.problema_encontrado}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, problema_encontrado: e.target.value }))
                  }
                  disabled={!form.grupo_manutencao}
                >
                  <option value="">Selecione...</option>
                  {defeitos.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Seção 2: Execução */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2 border-b pb-2">Solução e Execução</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CampoMecanico
                value={form.mecanico_executor}
                onChange={(m) => setForm((prev) => ({ ...prev, mecanico_executor: m }))}
              />

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Número da OS Corretiva
                </label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-200 transition text-sm font-medium text-slate-800"
                  placeholder="Ex: 123456"
                  value={form.numero_os_corretiva}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, numero_os_corretiva: e.target.value }))
                  }
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Responsável pelo apontamento <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-200 transition text-sm font-medium text-slate-800"
                  value={form.solucionador}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, solucionador: e.target.value }))
                  }
                  placeholder="Ex: Fernando, Clécio..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Solução aplicada</label>
                <textarea
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-200 transition text-sm font-medium text-slate-800"
                  rows="2"
                  placeholder="Descreva a ação ou serviço realizado..."
                  value={form.solucao}
                  onChange={(e) => setForm((prev) => ({ ...prev, solucao: e.target.value }))}
                />
              </div>

              <div className="md:col-span-2 pt-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Classificação de Controlabilidade <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        classificacao_controlabilidade: "Não Controlável",
                      }))
                    }
                    className={`px-4 py-2.5 rounded-lg font-bold border transition-all active:scale-95 flex items-center gap-2 text-sm ${
                      form.classificacao_controlabilidade === "Não Controlável"
                        ? "bg-amber-400 border-amber-500 text-amber-900 shadow-md"
                        : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Não controlável
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        classificacao_controlabilidade: "Controlável",
                      }))
                    }
                    className={`px-4 py-2.5 rounded-lg font-bold border transition-all active:scale-95 flex items-center gap-2 text-sm ${
                      form.classificacao_controlabilidade === "Controlável"
                        ? "bg-rose-600 border-rose-700 text-white shadow-md"
                        : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Controlável
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sessão 3: Informações Complementares e Resumo */}
          <div className="bg-slate-100 p-5 rounded-xl border border-slate-200 shadow-inner">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
              <FaInfoCircle className="text-slate-400" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Histórico de Manutenção</h3>
            </div>

            <div className="mb-5 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  KM Atual do Veículo <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <FaRoad className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="number"
                    className="w-full md:w-64 border border-slate-300 rounded-lg py-2.5 pl-10 pr-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition font-bold text-slate-800"
                    placeholder="Ex: 150000"
                    value={form.km_atual_veiculo}
                    onChange={(e) => setForm({ ...form, km_atual_veiculo: e.target.value })}
                  />
                </div>
              </div>
              <div className="text-xs font-semibold text-slate-500 bg-slate-50 p-2.5 rounded-lg border">
                ℹ️ Digite o KM atual para calcularmos a rodagem desde as últimas manutenções e atrelar ao SOS.
              </div>
            </div>

            {historicoLoading ? (
              <div className="text-center py-4 text-sm font-bold text-slate-500 animate-pulse">
                Consultando histórico do veículo {sos.veiculo}...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Card Preventiva */}
                <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden flex flex-col h-full">
                  <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FaWrench className="text-blue-600" />
                      <h4 className="font-black text-blue-900 text-sm">Última Preventiva (10k)</h4>
                    </div>
                    <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200">
                      OS: {historico.preventiva?.numero_os || "—"}
                    </span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    {historico.preventiva ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-100 pb-2">
                          <div>
                            <span className="block font-bold text-slate-400 uppercase">Data</span>
                            <span className="font-black text-slate-800">{formatDate(historico.preventiva.data_realizacao)}</span>
                          </div>
                          <div>
                            <span className="block font-bold text-slate-400 uppercase">KM na Época</span>
                            <span className="font-black text-slate-800">{formatKM(historico.preventiva.km_veiculo)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-100 pb-2">
                          <div>
                            <span className="block font-bold text-slate-400 uppercase">Mecânico</span>
                            <span className="font-black text-slate-800">{historico.preventiva.mecanico || "—"}</span>
                          </div>
                          <div>
                            <span className="block font-bold text-slate-400 uppercase">Eletricista</span>
                            <span className="font-black text-slate-800">{historico.preventiva.eletricista || "—"}</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-100 pb-2">
                          <div>
                            <span className="block font-bold text-slate-400 uppercase">Funilaria</span>
                            <span className="font-black text-slate-800">{historico.preventiva.funilaria || "—"}</span>
                          </div>
                          <div>
                            <span className="block font-bold text-slate-400 uppercase">Borracharia</span>
                            <span className="font-black text-slate-800">{historico.preventiva.borracharia || "—"}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                          <div className="bg-slate-50 p-2 rounded-lg border">
                            <span className="block font-bold text-slate-500">Dias Decorridos</span>
                            <span className="font-black text-rose-600 text-sm">{diasUltimaPreventiva ?? "-"} <span className="text-xs">dias</span></span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg border">
                            <span className="block font-bold text-slate-500">Rodagem (KM)</span>
                            <span className="font-black text-blue-600 text-sm">
                              {kmPercorridoPreventiva > 0 ? formatKM(kmPercorridoPreventiva) : "-"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-400 font-bold text-sm h-full flex items-center justify-center">
                        Nenhuma preventiva (10k) localizada.
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Inspeção */}
                <div className="bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden flex flex-col h-full">
                  <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FaBus className="text-emerald-600" />
                      <h4 className="font-black text-emerald-900 text-sm">Última Inspeção (5k)</h4>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                      OS: {historico.inspecao?.numero_os || "—"}
                    </span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    {historico.inspecao ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-100 pb-2">
                          <div>
                            <span className="block font-bold text-slate-400 uppercase">Data</span>
                            <span className="font-black text-slate-800">{formatDate(historico.inspecao.data_realizacao)}</span>
                          </div>
                          <div>
                            <span className="block font-bold text-slate-400 uppercase">KM na Época</span>
                            <span className="font-black text-slate-800">{formatKM(historico.inspecao.km_veiculo)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-100 pb-2">
                          <div>
                            <span className="block font-bold text-slate-400 uppercase">Mecânico</span>
                            <span className="font-black text-slate-800">{historico.inspecao.mecanico || "—"}</span>
                          </div>
                          <div>
                            <span className="block font-bold text-slate-400 uppercase">Eletricista</span>
                            <span className="font-black text-slate-800">{historico.inspecao.eletricista || "—"}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                          <div className="bg-slate-50 p-2 rounded-lg border">
                            <span className="block font-bold text-slate-500">Dias Decorridos</span>
                            <span className="font-black text-rose-600 text-sm">{diasUltimaInspecao ?? "-"} <span className="text-xs">dias</span></span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg border">
                            <span className="block font-bold text-slate-500">Rodagem (KM)</span>
                            <span className="font-black text-emerald-600 text-sm">
                              {kmPercorridoInspecao > 0 ? formatKM(kmPercorridoInspecao) : "-"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-400 font-bold text-sm h-full flex items-center justify-center">
                        Nenhuma inspeção (5k) localizada.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* Footer Modal */}
        <div className="flex justify-end gap-3 p-5 border-t bg-white relative">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={salvarTratamento}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Salvando...
              </>
            ) : (
              <>
                <FaCheckCircle /> Confirmar Tratamento
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
