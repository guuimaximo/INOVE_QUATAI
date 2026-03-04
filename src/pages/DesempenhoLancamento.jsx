// src/pages/DesempenhoLancamento.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import CampoMotorista from "../components/CampoMotorista";
import { useAuth } from "../context/AuthContext";
import { FaTimes, FaRobot, FaExclamationTriangle, FaCheckCircle, FaFilePdf, FaArrowRight } from "react-icons/fa";

// =============================================================================
// CONFIG (GitHub Actions)
// =============================================================================
const GH_USER = import.meta.env.VITE_GITHUB_USER;
const GH_REPO = import.meta.env.VITE_GITHUB_REPO;
const GH_TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
const GH_REF = "main";
const WF_ACOMP = "ordem-acompanhamento.yml";
const WF_TRAT = "ordem-tratativa.yml"; // Novo workflow para tratativas

// =============================================================================
// Storage
// =============================================================================
const SUPABASE_BASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET_RELATORIOS = "relatorios";

// =============================================================================
// Config
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

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function filesToList(files) {
  if (!files?.length) return [];
  return Array.from(files).map((f) => ({
    name: f.name, size: f.size, type: f.type, lastModified: f.lastModified, file: f,
  }));
}

function dedupeFiles(list) {
  const seen = new Set();
  return (list || []).filter((x) => {
    const k = `${x.name}__${x.size}__${x.lastModified}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
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

function normalizePath(p) {
  if (!p) return "";
  return String(p).replace(/^\/+/, "");
}

function getPublicUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${SUPABASE_BASE_URL}/storage/v1/object/public/${BUCKET_RELATORIOS}/${cleanPath}`;
}

async function dispatchGitHubWorkflow(workflowFile, inputs) {
  if (!GH_USER || !GH_REPO || !GH_TOKEN) throw new Error("Credenciais GitHub ausentes (VITE_GITHUB_*).");
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
// COMPONENTES AUXILIARES
// =============================================================================
function Segmented({ value, onChange, disabled }) {
  return (
    <div className="flex bg-slate-100/80 p-1.5 rounded-xl border shadow-inner w-fit">
      <button
        type="button"
        onClick={() => onChange(DESTINOS.ACOMP)}
        disabled={disabled}
        className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
          value === DESTINOS.ACOMP ? "bg-white text-blue-700 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-700"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <FaClock className={value === DESTINOS.ACOMP ? "text-blue-500" : ""} /> Acompanhamento Preventivo
      </button>
      <button
        type="button"
        onClick={() => onChange(DESTINOS.TRAT)}
        disabled={disabled}
        className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
          value === DESTINOS.TRAT ? "bg-white text-rose-700 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-700"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <FaExclamationTriangle className={value === DESTINOS.TRAT ? "text-rose-500" : ""} /> Medida Disciplinar
      </button>
    </div>
  );
}

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================
export default function DesempenhoLancamento() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [destino, setDestino] = useState(DESTINOS.ACOMP);

  // Campos
  const [motorista, setMotorista] = useState({ chapa: "", nome: "" });
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [motivoOutro, setMotivoOutro] = useState("");
  const [observacaoInicial, setObservacaoInicial] = useState("");
  
  const [prioridadeTratativa, setPrioridadeTratativa] = useState("Alta");
  const [evidTrat, setEvidTrat] = useState([]);

  const motivoFinal = motivo === "Outro" ? motivoOutro.trim() : motivo;
  const diasMonitoramento = 10;

  // Estados UI
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // =============================
  // Files
  // =============================
  function addFilesTrat(e) {
    const list = filesToList(e.target.files);
    setEvidTrat((prev) => dedupeFiles([...(prev || []), ...list]));
    e.target.value = "";
  }
  function removeFileTrat(idx) {
    setEvidTrat((prev) => prev.filter((_, i) => i !== idx));
  }

  // =============================
  // Validações
  // =============================
  const prontoAcomp = useMemo(() => {
    if (destino !== DESTINOS.ACOMP) return false;
    return !!(String(motorista?.chapa || motorista?.nome || "").trim() && String(motivoFinal || "").trim() && String(observacaoInicial || "").trim().length > 0);
  }, [destino, motorista, motivoFinal, observacaoInicial]);

  const prontoTrat = useMemo(() => {
    if (destino !== DESTINOS.TRAT) return false;
    return !!(String(motorista?.chapa || motorista?.nome || "").trim() && String(motivoFinal || "").trim() && (evidTrat || []).length > 0);
  }, [destino, motorista, motivoFinal, evidTrat]);

  const pronto = destino === DESTINOS.ACOMP ? prontoAcomp : prontoTrat;

  function limparTudo() {
    setMotorista({ chapa: "", nome: "" });
    setMotivo(MOTIVOS[0]);
    setMotivoOutro("");
    setObservacaoInicial("");
    setPrioridadeTratativa("Alta");
    setEvidTrat([]);
    setSaving(false);
    setErrMsg("");
    setOkMsg("");
  }

  useEffect(() => {
    setErrMsg("");
    setOkMsg("");
  }, [destino]);

  // =============================================================================
  // AÇÃO PRINCIPAL: LANÇAR E DISPARAR ROBÔS (ASSÍNCRONO)
  // =============================================================================
  async function lancar() {
    if (!pronto || saving) return;
    setSaving(true);
    setErrMsg("");
    setOkMsg("");

    try {
      const lancadorLogin = user?.login || user?.email || null;
      const lancadorNome = user?.nome || null;
      const lancadorIdNum = user?.id ?? null;
      const chapa = String(motorista?.chapa || "").trim();
      const nomeMotorista = String(motorista?.nome || "").trim() || null;
      const obsInit = String(observacaoInicial || "").trim() || null;

      // ==========================================================
      // FLUXO: ACOMPANHAMENTO PREVENTIVO
      // ==========================================================
      if (destino === DESTINOS.ACOMP) {
        
        // 1) Grava Histórico Geral (Lançamento)
        const payloadLancamento = {
          motorista_chapa: chapa || null, motorista_nome: nomeMotorista, destino: DESTINOS.ACOMP,
          motivo: motivoFinal, observacao_inicial: obsInit, dias_monitoramento: diasMonitoramento,
          lancado_por_login: lancadorLogin, lancado_por_nome: lancadorNome,
          lancado_por_usuario_id: lancadorIdNum ? String(lancadorIdNum) : null,
          metadata: { origem: "LANCAMENTO_ACOMP_BOT" }
        };

        const { data: lanc, error: eL } = await supabase.from("diesel_lancamentos").insert(payloadLancamento).select("id").single();
        if (eL) throw eL;

        // 2) Cria a Ordem de Acompanhamento
        const payloadAcomp = {
          motorista_chapa: chapa || null, motorista_nome: nomeMotorista, motivo: motivoFinal,
          status: "AGUARDANDO_INSTRUTOR", dias_monitoramento: diasMonitoramento,
          observacao_inicial: obsInit, lancamento_id: lanc.id,
          metadata: { origem: "LANCAMENTO_ACOMP_BOT", lancado_por_login: lancadorLogin }
        };

        const { data: acomp, error: eA } = await supabase.from("diesel_acompanhamentos").insert(payloadAcomp).select("id").single();
        if (eA) throw eA;

        // 3) Evento Inicial da Linha do Tempo
        const { error: eE } = await supabase.from("diesel_acompanhamento_eventos").insert({
          acompanhamento_id: acomp.id, tipo: "LANCAMENTO", observacoes: `${motivoFinal}\n\n${obsInit || ""}`,
          criado_por_login: lancadorLogin, criado_por_nome: lancadorNome, criado_por_id: isUuid(user?.id) ? user.id : null,
        });
        if (eE) throw eE;

        // 4) Lote para o Bot
        const { data: lote, error: errL } = await supabase.from("acompanhamento_lotes").insert({
          status: "PROCESSANDO", qtd: 1, extra: { origem: "LANCAMENTO_MANUAL_ACOMP", tipo: TIPO_PRONTUARIO, motorista_chapa: chapa }
        }).select("id").single();
        if (errL) throw errL;

        const { error: errI } = await supabase.from("acompanhamento_lote_itens").insert([{ lote_id: lote.id, motorista_chapa: chapa }]);
        if (errI) throw errI;

        // 5) Dispara o Bot de Acompanhamento
        await dispatchGitHubWorkflow(WF_ACOMP, { ordem_batch_id: String(lote.id), qtd: "1" });

        limparTudo();
        setOkMsg(`Acompanhamento criado com sucesso! O robô de Prontuário Preventivo (Lote #${lote.id}) foi acionado em segundo plano.`);
        return;
      }

      // ==========================================================
      // FLUXO: MEDIDA DISCIPLINAR (TRATATIVA)
      // ==========================================================
      if (destino === DESTINOS.TRAT) {
        
        // 1) Upload Evidências Manuais
        const folder = `diesel/tratativas/${chapa || "sem_chapa"}/lancamento_${Date.now()}`;
        const uploaded = await uploadManyToStorage({ files: evidTrat, bucket: "diesel", folder });
        const evidenciasUrls = uploaded.map((u) => u.publicUrl).filter(Boolean);

        // 2) Lançamento Geral
        const payloadLancamento = {
          motorista_chapa: chapa || null, motorista_nome: nomeMotorista, destino: DESTINOS.TRAT,
          prioridade: prioridadeTratativa, motivo: motivoFinal, observacao_inicial: obsInit,
          evidencias_urls: evidenciasUrls, lancado_por_login: lancadorLogin, lancado_por_nome: lancadorNome,
          metadata: { origem: "LANCAMENTO_TRAT_BOT" }
        };

        const { data: lanc, error: eL } = await supabase.from("diesel_lancamentos").insert(payloadLancamento).select("id").single();
        if (eL) throw eL;

        // 3) Lote para o Bot de Tratativas
        const { data: lote, error: errL } = await supabase.from("acompanhamento_lotes").insert({
          status: "PROCESSANDO", qtd: 1, extra: { origem: "LANCAMENTO_MANUAL_TRAT", tipo: "prontuario_tratativa", motorista_chapa: chapa, evidencias: evidenciasUrls, observacao: obsInit, prioridade: prioridadeTratativa }
        }).select("id").single();
        if (errL) throw errL;

        const { error: errI } = await supabase.from("acompanhamento_lote_itens").insert([{ lote_id: lote.id, motorista_chapa: chapa }]);
        if (errI) throw errI;

        // 4) Dispara o Bot de Tratativas
        await dispatchGitHubWorkflow(WF_TRAT, { ordem_batch_id: String(lote.id), qtd: "1" });

        limparTudo();
        setOkMsg(`Tratativa encaminhada! O robô gerador de Medidas Disciplinares (Lote #${lote.id}) foi acionado em segundo plano para enviar o caso à Central.`);
        setTimeout(() => { navigate("/desempenho-diesel/tratativas"); }, 2000);
        return;
      }

    } catch (err) {
      console.error(err);
      setErrMsg(err?.message || "Erro interno ao processar o lançamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 bg-slate-50 min-h-screen">
      
      {/* HEADER E TABS */}
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
          <FaBolt className="text-yellow-500" /> Painel de Lançamentos
        </h1>
        <p className="text-slate-500 mt-2 font-medium">
          Escolha o tipo de intervenção. O sistema acionará automaticamente os robôs de inteligência para gerar as documentações em segundo plano.
        </p>
        <div className="mt-6">
          <Segmented value={destino} onChange={setDestino} disabled={saving} />
        </div>
      </div>

      {/* ALERTAS */}
      {errMsg && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3 shadow-sm">
          <FaExclamationTriangle className="text-red-500 text-xl" />
          <div className="text-sm font-bold text-red-800">{errMsg}</div>
        </div>
      )}
      {okMsg && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3 shadow-sm">
          <FaCheckCircle className="text-emerald-500 text-xl" />
          <div className="text-sm font-bold text-emerald-800">{okMsg}</div>
        </div>
      )}

      {/* FORMULÁRIO UNIFICADO E ELEGANTE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* BANNER INFORMATIVO DA ABA */}
        <div className={`px-6 py-5 border-b ${destino === DESTINOS.ACOMP ? "bg-blue-50/50 border-blue-100" : "bg-rose-50/50 border-rose-100"}`}>
          <div className={`text-lg font-black flex items-center gap-2 ${destino === DESTINOS.ACOMP ? "text-blue-800" : "text-rose-800"}`}>
            {destino === DESTINOS.ACOMP ? <><FaClock /> Acompanhamento Preventivo</> : <><FaExclamationTriangle /> Medida Disciplinar (Tratativa)</>}
          </div>
          <div className={`text-sm mt-1 font-medium ${destino === DESTINOS.ACOMP ? "text-blue-600/80" : "text-rose-600/80"}`}>
            {destino === DESTINOS.ACOMP 
              ? "Cria uma ordem para o Instrutor e gera o Prontuário Telemetria PDF via robô." 
              : "Exige anexo de evidências. O robô vai auditar o histórico e enviar para a Central de Tratativas."}
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* MOTORISTA */}
            <div className="md:col-span-2">
              <CampoMotorista value={motorista} onChange={setMotorista} label="Selecione o Motorista Infrator" />
            </div>

            {/* PRIORIDADE (SÓ TRATATIVA) */}
            {destino === DESTINOS.TRAT && (
              <div className="md:col-span-2 bg-rose-50/30 p-4 rounded-xl border border-rose-100">
                <label className="block text-sm font-bold text-slate-700 mb-2">SLA de Gravidade na Central</label>
                <div className="flex gap-2 flex-wrap">
                  {PRIORIDADES.map((p) => (
                    <button
                      key={p} type="button" onClick={() => setPrioridadeTratativa(p)} disabled={saving}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${prioridadeTratativa === p ? "bg-rose-600 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-rose-50"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* MOTIVO */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-2">Classificação do Problema</label>
              <select
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 bg-white text-slate-800 font-semibold focus:border-blue-500 focus:ring-0 outline-none transition-colors"
                value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={saving}
              >
                {MOTIVOS.map((m) => (<option key={m} value={m}>{m}</option>))}
              </select>

              {motivo === "Outro" && (
                <input
                  className="mt-3 w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-slate-800 focus:border-blue-500 outline-none"
                  value={motivoOutro} onChange={(e) => setMotivoOutro(e.target.value)} placeholder="Descreva brevemente o motivo..." disabled={saving}
                />
              )}
            </div>

            {/* OBSERVAÇÃO */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Contexto / Orientação Inicial <span className="text-slate-400 font-normal">(Opcional para acompanhamento)</span>
              </label>
              <textarea
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 min-h-[120px] text-slate-800 focus:border-blue-500 outline-none resize-y"
                value={observacaoInicial} onChange={(e) => setObservacaoInicial(e.target.value)} disabled={saving}
                placeholder="Detalhes relevantes que o robô de IA ou o Instrutor precisam saber sobre este caso..."
              />
            </div>

            {/* EVIDÊNCIAS (SÓ TRATATIVA) */}
            {destino === DESTINOS.TRAT && (
              <div className="md:col-span-2">
                <label className="flex items-center justify-between text-sm font-bold text-slate-700 mb-2">
                  <span>Anexar Provas Documentais <span className="text-rose-500">*</span></span>
                  <span className="text-xs font-normal bg-slate-100 px-2 py-1 rounded text-slate-500 border">Obrigatório</span>
                </label>
                <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:bg-slate-100 transition-colors relative cursor-pointer">
                  <input type="file" multiple onChange={addFilesTrat} disabled={saving} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <FaFilePdf className="mx-auto text-3xl text-slate-400 mb-2" />
                  <div className="text-sm font-bold text-slate-700">Clique ou arraste as evidências aqui</div>
                  <div className="text-xs text-slate-500 mt-1">Imagens, planilhas ou relatórios de telemetria</div>
                </div>

                {evidTrat.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {evidTrat.map((f, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white border rounded-lg px-4 py-3 shadow-sm">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-800 truncate">{f.name}</div>
                          <div className="text-xs text-slate-500">{(Number(f.size || 0) / 1024 / 1024).toFixed(2)} MB</div>
                        </div>
                        <button type="button" className="text-rose-500 hover:text-rose-700 bg-rose-50 p-2 rounded-lg" onClick={() => removeFileTrat(idx)} disabled={saving}>
                          <FaTrash size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RODAPÉ E BOTÃO DE SALVAR */}
        <div className="px-6 py-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
            <FaRobot className="text-slate-400 text-lg" />
            O robô cuidará da análise de dados e geração do PDF.
          </div>
          
          <div className="flex w-full sm:w-auto items-center gap-3">
            <button type="button" className="px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 w-full sm:w-auto" onClick={limparTudo} disabled={saving}>
              Limpar
            </button>
            
            <button
              type="button"
              disabled={!pronto || saving}
              className={`flex items-center justify-center gap-2 px-8 py-3 text-sm font-black text-white rounded-xl shadow-lg transition-all w-full sm:w-auto ${
                saving ? "bg-slate-400 cursor-not-allowed" :
                destino === DESTINOS.ACOMP ? "bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/20" : "bg-rose-600 hover:bg-rose-700 hover:shadow-rose-500/20"
              } disabled:opacity-60 disabled:hover:shadow-none`}
              onClick={lancar}
            >
              {saving ? "Processando..." : (
                <>
                  {destino === DESTINOS.ACOMP ? "Lançar e Acionar Robô" : "Criar Tratativa Oficial"}
                  <FaArrowRight />
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
