// src/pages/DesempenhoLancamento.jsx
import { useEffect, useMemo, useRef, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import CampoMotorista from "../components/CampoMotorista";
import { AuthContext } from "../context/AuthContext";
import { 
  FaBolt, 
  FaClock, 
  FaExclamationTriangle, 
  FaSave, 
  FaRobot, 
  FaTrash, 
  FaFileUpload, 
  FaCheckCircle,
  FaArrowRight,
  FaTimes
} from "react-icons/fa";

// =============================================================================
// CONFIG (GitHub Actions)
// =============================================================================
const GH_USER = import.meta.env.VITE_GITHUB_USER;
const GH_REPO = import.meta.env.VITE_GITHUB_REPO;
const GH_TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
const GH_REF = "main";
const WF_ACOMP = "ordem-acompanhamento.yml";
const WF_TRAT = "ordem-tratativa.yml"; 

// =============================================================================
// Configurações Gerais
// =============================================================================
const TIPO_PRONTUARIO = "prontuarios_acompanhamento";
const MOTIVOS = ["KM/L abaixo da meta", "Tendência de queda", "Comparativo com cluster", "Outro"];
const DESTINOS = { ACOMP: "ACOMPANHAMENTO", TRAT: "TRATATIVA" };
const PRIORIDADES = ["Gravíssima", "Alta", "Média", "Baixa"];

// =============================================================================
// HELPERS
// =============================================================================
function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
}

function filesToList(files) {
  if (!files?.length) return [];
  return Array.from(files).map((f) => ({
    name: f.name, size: f.size, type: f.type, lastModified: f.lastModified, file: f,
  }));
}

async function uploadManyToStorage({ files, bucket, folder }) {
  if (!files?.length) return [];
  const out = [];
  const ts = Date.now();
  for (let i = 0; i < files.length; i++) {
    const f = files[i]?.file;
    if (!f) continue;
    const safeName = String(f.name || `arquivo_${i}`).replaceAll(" ", "_").replace(/[^\w.\-()]/g, "");
    const path = `${folder}/${ts}_${i}_${safeName}`;
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, f, {
      upsert: false, cacheControl: "3600", contentType: f.type || undefined,
    });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    out.push({ path, publicUrl: pub?.publicUrl || null });
  }
  return out;
}

async function dispatchGitHubWorkflow(workflowFile, inputs) {
  if (!GH_USER || !GH_REPO || !GH_TOKEN) throw new Error("Credenciais GitHub ausentes.");
  const url = `https://api.github.com/repos/${GH_USER}/${GH_REPO}/actions/workflows/${workflowFile}/dispatches`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${GH_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: GH_REF, inputs }),
  });
  if (response.status !== 204) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Erro GitHub: ${response.status}`);
  }
  return true;
}

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================
export default function DesempenhoLancamento() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [destino, setDestino] = useState(DESTINOS.ACOMP);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });

  // Form States
  const [motorista, setMotorista] = useState({ chapa: "", nome: "" });
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [motivoOutro, setMotivoOutro] = useState("");
  const [observacaoInicial, setObservacaoInicial] = useState("");
  const [prioridadeTratativa, setPrioridadeTratativa] = useState("Alta");
  const [evidencias, setEvidencias] = useState([]);

  const motivoFinal = motivo === "Outro" ? motivoOutro.trim() : motivo;

  // Validação Dinâmica
  const pronto = useMemo(() => {
    const motoristaOk = !!(motorista?.chapa || motorista?.nome);
    const camposBase = motoristaOk && motivoFinal && observacaoInicial.trim();
    if (destino === DESTINOS.ACOMP) return camposBase;
    return camposBase && evidencias.length > 0;
  }, [destino, motorista, motivoFinal, observacaoInicial, evidencias]);

  const handleFileChange = (e) => {
    const list = filesToList(e.target.files);
    setEvidencias(prev => [...prev, ...list]);
    e.target.value = "";
  };

  const removeFile = (idx) => setEvidencias(prev => prev.filter((_, i) => i !== idx));

  const limparTudo = () => {
    setMotorista({ chapa: "", nome: "" });
    setMotivo(MOTIVOS[0]);
    setMotivoOutro("");
    setObservacaoInicial("");
    setEvidencias([]);
    setPrioridadeTratativa("Alta");
    setStatusMsg({ type: "", text: "" });
  };

  // =============================================================================
  // LÓGICA DE LANÇAMENTO (UNIFICADA)
  // =============================================================================
  async function handleLancar() {
    if (!pronto || saving) return;
    setSaving(true);
    setStatusMsg({ type: "info", text: "Iniciando processamento e acionando robôs..." });

    try {
      const lancadorLogin = user?.login || user?.email || null;
      const lancadorNome = user?.nome || user?.nome_completo || null;
      const chapa = String(motorista?.chapa || "").trim();
      const nomeMot = String(motorista?.nome || "").trim() || null;

      // 1. Upload de Evidências (apenas se houver)
      let urlsEvidencias = [];
      if (evidencias.length > 0) {
        const folder = `diesel/lancamentos/${chapa || "manual"}/${Date.now()}`;
        const uploaded = await uploadManyToStorage({ files: evidencias, bucket: "diesel", folder });
        urlsEvidencias = uploaded.map(u => u.publicUrl).filter(Boolean);
      }

      // 2. Gravar diesel_lancamentos (Log Geral)
      const { data: lancData, error: errLanc } = await supabase.from("diesel_lancamentos").insert({
        motorista_chapa: chapa || null,
        motorista_nome: nomeMot,
        destino: destino,
        prioridade: destino === DESTINOS.TRAT ? prioridadeTratativa : null,
        motivo: motivoFinal,
        observacao_inicial: observacaoInicial,
        evidencias_urls: urlsEvidencias,
        lancado_por_login: lancadorLogin,
        lancado_por_nome: lancadorNome,
      }).select("id").single();
      if (errLanc) throw errLanc;

      // 3. Fluxo Específico: ACOMPANHAMENTO
      if (destino === DESTINOS.ACOMP) {
        const { data: acompData, error: errAcomp } = await supabase.from("diesel_acompanhamentos").insert({
          motorista_chapa: chapa || null,
          motorista_nome: nomeMot,
          motivo: motivoFinal,
          status: "AGUARDANDO_INSTRUTOR",
          observacao_inicial: observacaoInicial,
          lancamento_id: lancData.id
        }).select("id").single();
        if (errAcomp) throw errAcomp;

        await supabase.from("diesel_acompanhamento_eventos").insert({
          acompanhamento_id: acompData.id,
          tipo: "LANCAMENTO",
          observacoes: `Lançamento manual realizado.`,
          criado_por_login: lancadorLogin,
          criado_por_nome: lancadorNome
        });

        // Disparar Robô de Acompanhamento
        const { data: lote } = await supabase.from("acompanhamento_lotes").insert({
          status: "PROCESSANDO", qtd: 1, extra: { tipo: TIPO_PRONTUARIO, chapa, lancamento_id: lancData.id }
        }).select("id").single();
        await supabase.from("acompanhamento_lote_itens").insert([{ lote_id: lote.id, motorista_chapa: chapa }]);
        await dispatchGitHubWorkflow(WF_ACOMP, { ordem_batch_id: String(lote.id), qtd: "1" });
      } 
      
      // 4. Fluxo Específico: TRATATIVA
      else {
        const { data: tratData, error: errTrat } = await supabase.from("diesel_tratativas").insert({
          motorista_chapa: chapa || null,
          motorista_nome: nomeMot,
          status: "Pendente",
          prioridade: prioridadeTratativa,
          descricao: `${motivoFinal}\n\n${observacaoInicial}`,
          evidencias_urls: urlsEvidencias,
          tipo_ocorrencia: "DIESEL_KML",
          lancamento_id: lancData.id
        }).select("id").single();
        if (errTrat) throw errTrat;

        await supabase.from("diesel_tratativas_detalhes").insert({
          tratativa_id: tratData.id,
          acao_aplicada: "ABERTURA_MANUAL",
          observacoes: observacaoInicial,
          tratado_por_login: lancadorLogin,
          extra: { evidencias_urls: urlsEvidencias }
        });

        // Disparar Robô de Tratativa
        const { data: lote } = await supabase.from("acompanhamento_lotes").insert({
          status: "PROCESSANDO", qtd: 1, extra: { tipo: "prontuario_tratativa", chapa, lancamento_id: lancData.id }
        }).select("id").single();
        await supabase.from("acompanhamento_lote_itens").insert([{ lote_id: lote.id, motorista_chapa: chapa }]);
        await dispatchGitHubWorkflow(WF_TRAT, { ordem_batch_id: String(lote.id), qtd: "1" });
      }

      setStatusMsg({ type: "success", text: "Sucesso! O lançamento foi processado e o robô de IA já está trabalhando no documento." });
      setTimeout(() => {
        limparTudo();
        if (destino === DESTINOS.TRAT) navigate("/desempenho-diesel/tratativas");
      }, 3000);

    } catch (e) {
      console.error(e);
      setStatusMsg({ type: "error", text: e.message || "Falha ao processar lançamento." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto min-h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* HEADER */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3">
            <FaBolt className="text-yellow-500" /> Central de Lançamentos
          </h1>
          <p className="text-slate-500 font-medium mt-1">Registre ocorrências e acione a inteligência do robô automaticamente.</p>
        </div>
        
        {/* TABS ESTILIZADAS */}
        <div className="flex bg-slate-200 p-1.5 rounded-2xl w-fit shadow-inner">
          <button 
            onClick={() => setDestino(DESTINOS.ACOMP)} 
            disabled={saving}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${destino === DESTINOS.ACOMP ? "bg-white text-blue-700 shadow-md" : "text-slate-500 hover:text-slate-700"}`}
          >
            <FaClock /> Acompanhamento
          </button>
          <button 
            onClick={() => setDestino(DESTINOS.TRAT)} 
            disabled={saving}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${destino === DESTINOS.TRAT ? "bg-white text-rose-700 shadow-md" : "text-slate-500 hover:text-slate-700"}`}
          >
            <FaExclamationTriangle /> Tratativa
          </button>
        </div>
      </div>

      {/* FEEDBACK DE STATUS */}
      {statusMsg.text && (
        <div className={`mb-8 p-4 rounded-2xl border-2 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500 ${
          statusMsg.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : 
          statusMsg.type === "error" ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-blue-50 border-blue-200 text-blue-800"
        }`}>
          <div className="text-2xl">
            {statusMsg.type === "success" ? <FaCheckCircle /> : statusMsg.type === "error" ? <FaExclamationTriangle /> : <FaRobot className="animate-bounce" />}
          </div>
          <div className="font-bold">{statusMsg.text}</div>
        </div>
      )}

      {/* FORMULÁRIO PRINCIPAL */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden transition-all duration-500">
        <div className={`h-3 w-full ${destino === DESTINOS.ACOMP ? "bg-blue-600" : "bg-rose-600"}`} />
        
        <div className="p-6 md:p-12 space-y-10">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            
            {/* CAMPO MOTORISTA (LARGURA TOTAL) */}
            <div className="md:col-span-2">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Identificação do Motorista</label>
              <CampoMotorista value={motorista} onChange={setMotorista} />
            </div>

            {/* SEÇÃO ESQUERDA: MOTIVOS E PRIORIDADE */}
            <div className="space-y-8">
              {destino === DESTINOS.TRAT && (
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Nível de Gravidade</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRIORIDADES.map(p => (
                      <button 
                        key={p} 
                        onClick={() => setPrioridadeTratativa(p)}
                        className={`py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all ${prioridadeTratativa === p ? "bg-rose-600 border-rose-600 text-white shadow-lg" : "bg-white text-slate-600 border-slate-100 hover:border-rose-200"}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Motivo do Lançamento</label>
                <select 
                  value={motivo} 
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold text-slate-700 focus:border-blue-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                >
                  {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {motivo === "Outro" && (
                  <input 
                    value={motivoOutro} 
                    onChange={(e) => setMotivoOutro(e.target.value)} 
                    className="mt-4 w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold" 
                    placeholder="Especifique o motivo..." 
                  />
                )}
              </div>
            </div>

            {/* SEÇÃO DIREITA: TEXTO LIVRE */}
            <div className="flex flex-col h-full">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Detalhamento da Ocorrência</label>
              <textarea 
                value={observacaoInicial} 
                onChange={(e) => setObservacaoInicial(e.target.value)} 
                className="w-full flex-1 p-5 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:border-blue-500 focus:bg-white outline-none font-semibold text-slate-700 resize-none transition-all"
                placeholder="Descreva aqui os fatos, contextos ou as orientações passadas ao motorista..."
              />
            </div>

            {/* SEÇÃO EVIDÊNCIAS (APENAS TRATATIVA) */}
            {destino === DESTINOS.TRAT && (
              <div className="md:col-span-2 bg-slate-50 p-6 rounded-[1.5rem] border-2 border-slate-100">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Evidências e Provas (Obrigatório)</label>
                <div className="flex flex-col md:flex-row gap-6">
                  <label className="group flex-shrink-0 cursor-pointer bg-white border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center hover:border-rose-400 hover:bg-rose-50 transition-all w-full md:w-56 shadow-sm">
                    <input type="file" multiple onChange={handleFileChange} className="hidden" />
                    <FaFileUpload className="text-3xl text-slate-300 group-hover:text-rose-400 mb-3" />
                    <span className="text-xs font-bold text-slate-500 group-hover:text-rose-600">Carregar Arquivos</span>
                  </label>
                  
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {evidencias.map((f, idx) => (
                      <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm group animate-in zoom-in-95">
                        <div className="truncate flex-1">
                          <p className="text-xs font-bold text-slate-700 truncate">{f.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{(f.size/1024/1024).toFixed(2)} MB</p>
                        </div>
                        <button onClick={() => removeFile(idx)} className="text-slate-300 hover:text-rose-500 transition-colors">
                          <FaTrash size={14}/>
                        </button>
                      </div>
                    ))}
                    {evidencias.length === 0 && (
                      <div className="flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 text-slate-300 text-xs italic font-medium">
                        Nenhum anexo inserido ainda
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER COM BOTÕES */}
        <div className="bg-slate-50 px-6 py-6 md:px-12 md:py-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
            <FaRobot className="text-slate-300 text-xl" />
            <span>Processamento automatizado via inteligência artificial</span>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={limparTudo} 
              disabled={saving} 
              className="px-8 py-4 rounded-2xl text-sm font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all flex-1 md:flex-none"
            >
              Limpar
            </button>
            <button 
              onClick={handleLancar} 
              disabled={!pronto || saving} 
              className={`flex items-center justify-center gap-3 px-12 py-4 rounded-2xl text-sm font-black text-white shadow-2xl transition-all flex-1 md:flex-none transform active:scale-95 ${
                !pronto ? "bg-slate-300 cursor-not-allowed shadow-none" : 
                destino === DESTINOS.ACOMP ? "bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/40" : "bg-rose-600 hover:bg-rose-700 hover:shadow-rose-500/40"
              }`}
            >
              {saving ? "Processando..." : (
                <>
                  Confirmar Lançamento <FaArrowRight />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
