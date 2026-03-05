// src/pages/DieselTratarTratativa.jsx
import { useEffect, useMemo, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { AuthContext } from "../context/AuthContext";
import { 
  FaUser, 
  FaGavel, 
  FaHistory, 
  FaFilePdf, 
  FaCheckCircle, 
  FaFileAlt,
  FaRobot,
  FaClock
} from "react-icons/fa";

const acoes = [
  "Orientação",
  "Advertência",
  "Suspensão",
  "Aviso de última oportunidade",
  "Contato Pessoal",
  "Não aplicada",
  "Contato via Celular",
  "Elogiado",
];

function isValidUUID(v) {
  if (!v) return false;
  const s = String(v).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function pickUserUuid(user) {
  if (isValidUUID(user?.auth_user_id)) return user.auth_user_id;
  if (isValidUUID(user?.id)) return user.id;
  return null;
}

export default function DieselTratarTratativa() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useContext(AuthContext);

  const [t, setT] = useState(null);
  const [errorLoading, setErrorLoading] = useState(false);
  const [detalhes, setDetalhes] = useState([]);
  const [resumo, setResumo] = useState("");
  const [acao, setAcao] = useState("Orientação");

  // Conclusão: anexo (imagem/pdf)
  const [anexoTratativa, setAnexoTratativa] = useState(null);
  const [loading, setLoading] = useState(false);

  // Complementos
  const [linhaDescricao, setLinhaDescricao] = useState("");
  const [cargoMotorista, setCargoMotorista] = useState("MOTORISTA");

  // Edição inline
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    tipo_ocorrencia: "",
    prioridade: "Média",
    setor_origem: "",
    linha: "",
    descricao: "",
  });

  // Suspensão
  const [diasSusp, setDiasSusp] = useState(1);
  const [dataSuspensao, setDataSuspensao] = useState(() => new Date().toISOString().slice(0, 10));

  // ============================================================================
  // FUNÇÕES DE DATA E FORMATAÇÃO
  // ============================================================================
  const dataPtCompletaUpper = (d = new Date()) => {
    const meses = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = meses[d.getMonth()];
    const ano = d.getFullYear();
    return `${dia} de ${mes} de ${ano}`;
  };

  const br = (d) => {
    if (!d) return "—";
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("pt-BR");
  };

  const brDateTime = (d) => {
    if (!d) return "—";
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleString("pt-BR", { dateStyle: 'short', timeStyle: 'short' });
  };

  const parseDateLocal = (dateStr) => {
    if (!dateStr) return new Date();
    const [yyyy, mm, dd] = String(dateStr).split("-").map(Number);
    return new Date(yyyy, (mm || 1) - 1, dd || 1);
  };

  const addDaysLocal = (dateOrStr, n) => {
    const base = dateOrStr instanceof Date ? new Date(dateOrStr) : parseDateLocal(dateOrStr);
    base.setDate(base.getDate() + Number(n || 0));
    return base;
  };

  const inicioSusp = useMemo(() => parseDateLocal(dataSuspensao), [dataSuspensao]);
  const fimSusp = useMemo(() => addDaysLocal(inicioSusp, Math.max(Number(diasSusp) - 1, 0)), [inicioSusp, diasSusp]);
  const retornoSusp = useMemo(() => addDaysLocal(inicioSusp, Math.max(Number(diasSusp), 0)), [inicioSusp, diasSusp]);

  // ============================================================================
  // HELPERS DE EVIDÊNCIAS E PDF (BLINDADOS CONTRA TELA BRANCA E HTML)
  // ============================================================================
  const fileNameFromUrl = (u) => {
    try {
      const raw = String(u || "");
      const last = raw.split("?")[0].split("#")[0].split("/").filter(Boolean).pop() || "arquivo";
      return decodeURIComponent(last);
    } catch {
      return "arquivo";
    }
  };

  const isPdf = (fileOrUrl) => {
    if (!fileOrUrl) return false;
    if (typeof fileOrUrl === "string") return fileOrUrl.toLowerCase().includes(".pdf");
    return fileOrUrl.type === "application/pdf" || String(fileOrUrl.name || "").toLowerCase().endsWith(".pdf");
  };

  const isImageUrl = (u) => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/.test(String(u || "").toLowerCase());

  // Garantir que evidencia_urls seja um array limpo
  const safeEvidencias = useMemo(() => {
    if (!t?.evidencias_urls) return [];
    if (Array.isArray(t.evidencias_urls)) return t.evidencias_urls;
    if (typeof t.evidencias_urls === 'string') {
      try { return JSON.parse(t.evidencias_urls); } catch(e) { return [t.evidencias_urls]; }
    }
    return [];
  }, [t]);

  // Força que o Prontuário seja APENAS o PDF. 
  const prontuarioPdfUrl = useMemo(() => {
    // Busca o PDF com nome do robô
    const pdfDoRobo = safeEvidencias.find(u => typeof u === 'string' && u.toLowerCase().includes('.pdf') && u.toLowerCase().includes('prontuario'));
    if (pdfDoRobo) return pdfDoRobo;
    // Se não achar com o nome, pega qualquer PDF disponível
    return safeEvidencias.find(u => typeof u === 'string' && u.toLowerCase().includes('.pdf'));
  }, [safeEvidencias]);

  // Pega apenas as outras evidências, ignorando completamente o arquivo .html gerado pelo robô
  const outrasEvidencias = useMemo(() => {
    return safeEvidencias.filter(u => {
      if (typeof u !== 'string') return false;
      if (u === prontuarioPdfUrl) return false; // Esconde o PDF que já está no visualizador
      if (u.toLowerCase().includes('.html')) return false; // 🔥 IGNORA O ARQUIVO HTML DO ROBÔ
      return true;
    });
  }, [safeEvidencias, prontuarioPdfUrl]);

  const renderEvidenciasGrid = (urls, label) => {
    const arr = Array.isArray(urls) ? urls.filter(Boolean) : [];
    if (arr.length === 0) return null;

    return (
      <div className="mt-4">
        <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">{label}</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {arr.map((u, i) => {
            const pdf = isPdf(u);
            const img = !pdf && isImageUrl(u);
            const name = fileNameFromUrl(u);

            if (img) {
              return (
                <a key={`${u}-${i}`} href={u} target="_blank" rel="noopener noreferrer" className="group rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-all">
                  <img src={u} alt={name} className="h-28 w-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                  <div className="px-3 py-2 text-[10px] font-bold text-slate-600 truncate bg-slate-50 border-t border-slate-100">{name}</div>
                </a>
              );
            }
            return (
              <a key={`${u}-${i}`} href={u} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-all flex flex-col justify-center items-center text-center">
                <FaFileAlt className="text-3xl text-blue-500 mb-2" />
                <span className="text-[10px] font-black px-2 py-1 rounded-md bg-blue-50 text-blue-700 mb-2">{pdf ? "PDF" : "ARQUIVO"}</span>
                <div className="text-[10px] font-bold text-slate-600 truncate w-full">{name}</div>
              </a>
            );
          })}
        </div>
      </div>
    );
  };

  const [previewObjUrl, setPreviewObjUrl] = useState(null);
  useEffect(() => {
    if (!anexoTratativa) {
      if (previewObjUrl) URL.revokeObjectURL(previewObjUrl);
      setPreviewObjUrl(null);
      return;
    }
    const url = URL.createObjectURL(anexoTratativa);
    setPreviewObjUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, [anexoTratativa]);

  // ============================================================================
  // CARGA DE DADOS
  // ============================================================================
  async function carregarDados() {
    try {
      const { data, error } = await supabase.from("diesel_tratativas").select("*").eq("id", id).single();
      if (error) throw error;
      setT(data || null);

      setEditForm({
        tipo_ocorrencia: data?.tipo_ocorrencia || "",
        prioridade: data?.prioridade || "Média",
        setor_origem: data?.setor_origem || "",
        linha: data?.linha || "",
        descricao: data?.descricao || "",
      });

      if (data?.linha) {
        const { data: row } = await supabase.from("linhas").select("descricao").eq("codigo", data.linha).maybeSingle();
        setLinhaDescricao(row?.descricao || "");
      } else setLinhaDescricao("");

      if (data?.motorista_chapa) {
        const { data: m } = await supabase.from("motoristas").select("cargo").eq("chapa", data.motorista_chapa).maybeSingle();
        setCargoMotorista((m?.cargo || data?.cargo || "Motorista").toUpperCase());
      } else {
        setCargoMotorista((data?.cargo || "Motorista").toUpperCase());
      }

      const { data: detData } = await supabase.from("diesel_tratativas_detalhes").select("*").eq("tratativa_id", id).order("created_at", { ascending: true });
      setDetalhes(detData || []);
    } catch (e) {
      console.error(e);
      setErrorLoading(true);
    }
  }

  useEffect(() => {
    carregarDados();
  }, [id]);

  // ============================================================================
  // AÇÕES DE BANCO (SALVAR E CONCLUIR)
  // ============================================================================
  async function salvarEdicao() {
    if (!t) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("diesel_tratativas").update({
        tipo_ocorrencia: editForm.tipo_ocorrencia || null,
        prioridade: editForm.prioridade || null,
        setor_origem: editForm.setor_origem || null,
        linha: editForm.linha || null,
        descricao: editForm.descricao || null,
      }).eq("id", t.id);

      if (error) throw error;
      await carregarDados();
      setIsEditing(false);
      alert("Dados atualizados com sucesso!");
    } catch (e) {
      alert(`Erro ao salvar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function concluir() {
    if (!t) return;
    if (!resumo.trim()) {
      alert("Informe o resumo/observações da tratativa.");
      return;
    }

    setLoading(true);
    try {
      let anexo_tratativa_url = null;
      if (anexoTratativa) {
        const safe = `anexo_${Date.now()}_${anexoTratativa.name}`.replace(/\s+/g, "_");
        const up = await supabase.storage.from("diesel_tratativas").upload(safe, anexoTratativa, {
          upsert: false, contentType: anexoTratativa.type || undefined,
        });
        if (up.error) throw up.error;
        anexo_tratativa_url = supabase.storage.from("diesel_tratativas").getPublicUrl(safe).data.publicUrl;
      }

      const tratadoPorId = pickUserUuid(user);
      const tratadoPorLogin = user?.login || user?.email || null;
      const tratadoPorNome = user?.nome_completo || user?.nome || user?.login || user?.email || null;

      const ins = await supabase.from("diesel_tratativas_detalhes").insert({
        tratativa_id: t.id,
        acao_aplicada: acao,
        observacoes: resumo,
        anexo_tratativa: anexo_tratativa_url,
        tratado_por_login: tratadoPorLogin,
        tratado_por_nome: tratadoPorNome,
        tratado_por_id: tratadoPorId,
      });
      if (ins.error) throw ins.error;

      const upd = await supabase.from("diesel_tratativas").update({ status: "Concluída" }).eq("id", t.id);
      if (upd.error) throw upd.error;

      alert("Tratativa Diesel concluída com sucesso!");
      nav("/desempenho-diesel/tratativas");
    } catch (e) {
      alert(`Erro: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  // ============================================================================
  // FUNÇÕES DE IMPRESSÃO
  // ============================================================================
  function baseCssCourier() {
    return `
      <style>
        @page { size: A4; margin: 25mm; }
        html, body { height: 100%; }
        body { font-family: "Courier New", Courier, monospace; color:#000; font-size: 14px; line-height: 1.55; margin: 0; }
        .page { min-height: 100vh; display: flex; flex-direction: column; }
        .content { padding: 0; }
        .linha { display:flex; justify-content:space-between; gap:16px; }
        .mt { margin-top: 16px; }
        .center { text-align: center; font-weight: bold; }
        .right { text-align: right; }
        .bl { white-space: pre-wrap; }
        .label { font-weight: bold; }
        .footer-sign { margin-top: auto; }
        .ass-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 28px; }
        .ass { text-align: center; }
        .ass-line { margin-top: 34px; border-top: 1px solid #000; height:1px; }
      </style>
    `;
  }

  function renderSuspensaoHtml({ nome, registro, cargo, ocorrencia, dataOcorr, observ, dataDoc, dias, inicio, fim, retorno }) {
    const brLocal = (d) => {
      const dt = d instanceof Date ? d : new Date(d);
      return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("pt-BR");
    };
    const diasFmt = String(dias).padStart(2, "0");
    const rotuloDia = Number(dias) === 1 ? "dia" : "dias";
    return `
  <html><head><meta charset="utf-8" />${baseCssCourier()}<title>SUSPENSÃO - ${nome}</title></head>
  <body><div class="page"><div class="content">
    <div class="center">SUSPENSÃO DISCIPLINAR</div><div class="right mt">${dataDoc}</div>
    <div class="linha mt"><div>SR(A) <span class="label">${nome}</span> ${registro ? `(REGISTRO: ${registro})` : ""}</div><div><span class="label">Cargo:</span> ${cargo}</div></div>
    <p class="mt bl">Pelo presente, notificamos que encontra-se suspenso do serviço por <span class="label nowrap">${diasFmt} ${rotuloDia}</span>, a partir de <span class="label">${brLocal(inicio)}</span>, devendo apresentar-se no horário usual no dia <span class="label">${brLocal(retorno)}</span>.</p>
    <div class="mt"><span class="label">Ocorrência:</span> ${ocorrencia}</div>
    <div class="mt"><span class="label">Data da Ocorrência:</span> ${dataOcorr}</div>
    <div class="mt"><span class="label">Período:</span> ${brLocal(inicio)} a ${brLocal(fim)} (retorno: ${brLocal(retorno)})</div>
    <div class="mt"><span class="label">Observação:</span> ${observ}</div>
    <div class="mt"><span class="label">Ciente e Concordo:</span> ________/______/__________</div>
  </div>
  <div class="footer-sign mt"><div class="ass-grid"><div class="ass"><div class="ass-line"></div>Assinatura do Empregado</div><div class="ass"><div class="ass-line"></div>Assinatura do Empregador</div></div><div class="ass-grid" style="margin-top:20px"><div class="ass"><div class="ass-line"></div>Testemunha CPF:</div><div class="ass"><div class="ass-line"></div>Testemunha CPF:</div></div></div></div>
  <script>window.onload = () => { window.print(); }</script></body></html>`;
  }

  function renderGenericHtml({ titulo, intro1, intro2, nome, registro, cargo, ocorrencia, dataOcorr, observ, dataDoc }) {
    return `
      <html><head><meta charset="utf-8" />${baseCssCourier()}<title>${titulo} - ${nome}</title></head>
      <body><div class="page"><div class="content">
        <div class="center">${titulo}</div><div class="right mt">${dataDoc}</div>
        <div class="linha mt"><div>SR(A) <span class="label">${nome}</span> ${registro ? `(REGISTRO: ${registro})` : ""}</div><div><span class="label">Cargo:</span> ${cargo}</div></div>
        <p class="mt bl">${intro1}</p><p class="bl">${intro2}</p>
        <div class="mt"><span class="label">Ocorrência:</span> ${ocorrencia}</div>
        <div class="mt"><span class="label">Data da Ocorrência:</span> ${dataOcorr}</div>
        <div class="mt"><span class="label">Observação:</span> ${observ}</div>
        <div class="mt"><span class="label">Ciente e Concordo:</span> ________/______/__________</div>
      </div>
      <div class="footer-sign mt"><div class="ass-grid"><div class="ass"><div class="ass-line"></div>Assinatura do Empregado</div><div class="ass"><div class="ass-line"></div>Assinatura do Empregador</div></div><div class="ass-grid" style="margin-top:20px"><div class="ass"><div class="ass-line"></div>Testemunha CPF:</div><div class="ass"><div class="ass-line"></div>Testemunha CPF:</div></div></div></div>
      <script>window.onload = () => { window.print(); }</script></body></html>`;
  }

  function gerarOrientacao() {
    if (!t || !resumo.trim()) return alert("Preencha o Resumo para gerar a medida.");
    const html = renderGenericHtml({
      titulo: "ORIENTAÇÃO", intro1: "Vimos pelo presente, aplicar-lhe a pena de orientação, em virtude de ter cometido a falta abaixo descrita.", intro2: "Pedimos que tal falta não mais se repita, pois poderemos adotar medidas mais severas.",
      nome: (t.motorista_nome || "—").toUpperCase(), registro: t.motorista_chapa || "", cargo: cargoMotorista, ocorrencia: (t.tipo_ocorrencia || "—").toUpperCase(), dataOcorr: t.data_ocorrido ? br(t.data_ocorrido) : "—", observ: (resumo || t.descricao || "").trim() || "—", dataDoc: dataPtCompletaUpper(new Date()),
    });
    window.open("", "_blank").document.write(html);
  }

  function gerarAdvertencia() {
    if (!t || !resumo.trim()) return alert("Preencha o Resumo para gerar a medida.");
    const html = renderGenericHtml({
      titulo: "ADVERTÊNCIA", intro1: "Vimos pelo presente, aplicar-lhe a pena de advertência, em virtude de ter cometido a falta abaixo descrita.", intro2: "Pedimos que tal falta não mais se repita, pois poderemos adotar medidas mais severas.",
      nome: (t.motorista_nome || "—").toUpperCase(), registro: t.motorista_chapa || "", cargo: cargoMotorista, ocorrencia: (t.tipo_ocorrencia || "—").toUpperCase(), dataOcorr: t.data_ocorrido ? br(t.data_ocorrido) : "—", observ: (resumo || t.descricao || "").trim() || "—", dataDoc: dataPtCompletaUpper(new Date()),
    });
    window.open("", "_blank").document.write(html);
  }

  function gerarSuspensao() {
    if (!t || !resumo.trim()) return alert("Preencha o Resumo para gerar a medida.");
    const html = renderSuspensaoHtml({
      nome: (t.motorista_nome || "—").toUpperCase(), registro: t.motorista_chapa || "", cargo: cargoMotorista, ocorrencia: (t.tipo_ocorrencia || "—").toUpperCase(), dataOcorr: t.data_ocorrido ? br(t.data_ocorrido) : "—", observ: (resumo || t.descricao || "").trim() || "—", dataDoc: dataPtCompletaUpper(new Date()),
      dias: diasSusp, inicio: inicioSusp, fim: fimSusp, retorno: retornoSusp,
    });
    window.open("", "_blank").document.write(html);
  }

  // ============================================================================
  // RENDER UI
  // ============================================================================
  if (errorLoading) return <div className="flex h-screen items-center justify-center font-bold text-rose-500">Erro ao carregar dados da Tratativa. O registro pode ter sido excluído.</div>;
  if (!t) return <div className="flex h-screen items-center justify-center font-bold text-slate-500">Carregando dados da Tratativa...</div>;

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8 font-sans bg-slate-50 min-h-screen text-slate-800">
      
      {/* HEADER PAGE */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3 text-slate-900">
            <FaGavel className="text-rose-600" /> Resolução de Tratativa
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Analise os dados gerados, verifique o histórico e aplique a medida cabível.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs font-bold text-slate-400">
          <div className="bg-white px-3 py-1.5 rounded-lg border shadow-sm">ID: #{t.id}</div>
          <div className="flex items-center gap-1"><FaClock /> Abertura: {brDateTime(t.created_at)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA (PRONTUÁRIO -> DADOS -> EVIDÊNCIAS) */}
        <div className="lg:col-span-2 space-y-6">

          {/* 1. VISUALIZADOR DE PRONTUÁRIO (NO TOPO) */}
          {prontuarioPdfUrl && (
            <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-slate-800 border-b border-slate-900 px-6 py-4 flex items-center justify-between">
                <h2 className="font-black text-white flex items-center gap-2"><FaRobot className="text-blue-400"/> Prontuário de IA (Dossiê)</h2>
                <a href={prontuarioPdfUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1 border border-slate-600 px-3 py-1 rounded-lg transition-colors">
                  <FaFilePdf /> Abrir Externo
                </a>
              </div>
              <div className="bg-slate-200 w-full" style={{ height: "750px" }}>
                <iframe src={prontuarioPdfUrl} className="w-full h-full border-none" title="Prontuario do Robô" />
              </div>
            </div>
          )}
          
          {/* 2. INFO CARD PRINCIPAL */}
          <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-rose-50/50 border-b border-rose-100 px-6 py-4 flex items-center justify-between">
              <h2 className="font-black text-rose-800 flex items-center gap-2"><FaUser /> Dados do Infrator</h2>
              <div className={`px-3 py-1 rounded-md text-[10px] font-black uppercase text-white shadow-sm ${t.status === "Concluída" ? "bg-emerald-500" : "bg-amber-500"}`}>
                {t.status}
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motorista</p>
                <p className="text-lg font-black text-slate-800 mt-1">{t.motorista_nome || "N/D"}</p>
                <p className="text-sm font-mono text-slate-500 mt-0.5">Chapa: {t.motorista_chapa || "N/D"}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nível de Prioridade</p>
                <p className="text-base font-bold text-rose-600 mt-1">{t.prioridade}</p>
              </div>
              <div className="md:col-span-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo e Descrição da Abertura</p>
                <div className="mt-2 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap font-medium">
                  {t.descricao || "Sem descrição."}
                </div>
              </div>
            </div>
          </div>

          {/* 3. OUTRAS EVIDÊNCIAS (EMBAIXO) */}
          {outrasEvidencias.length > 0 && (
            <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm p-6">
              {renderEvidenciasGrid(outrasEvidencias, "Outras Evidências Anexadas")}
            </div>
          )}
        </div>

        {/* COLUNA DIREITA (TIMELINE & AÇÃO) */}
        <div className="space-y-6">
          
          {/* TIMELINE DE DETALHES "Conversar" */}
          <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[500px]">
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4">
              <h2 className="font-black text-slate-800 flex items-center gap-2"><FaHistory className="text-slate-400"/> Histórico da Tratativa</h2>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {detalhes.length === 0 ? (
                <div className="text-sm text-slate-400 italic text-center">Nenhum evento registrado ainda.</div>
              ) : (
                detalhes.map((det) => (
                  <div key={det.id} className="relative pl-6 border-l-2 border-slate-200 last:border-l-transparent pb-2">
                    <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center">
                      {det.acao_aplicada === "ABERTURA_MANUAL" || det.acao_aplicada === "ABERTURA_AUTOMATICA" ? <div className="h-2 w-2 rounded-full bg-blue-500" /> : <div className="h-2 w-2 rounded-full bg-emerald-500" />}
                    </div>
                    <div className="-mt-1.5">
                      <p className="text-[10px] font-bold text-slate-400">{brDateTime(det.created_at)}</p>
                      <p className="text-xs font-black text-slate-700 mt-0.5">{det.acao_aplicada}</p>
                      <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{det.observacoes}</p>
                      <p className="text-[9px] text-slate-400 mt-2">Por: {det.tratado_por_nome || det.tratado_por_login || "Sistema Robô"}</p>
                      
                      {/* Anexos deste evento */}
                      {det.anexo_tratativa && (
                        <a href={det.anexo_tratativa} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 hover:bg-blue-100">
                          <FaFileAlt /> Anexo da Conclusão
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* FORMULÁRIO DE CONCLUSÃO */}
          {t.status !== "Concluída" ? (
            <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-4">
                <h2 className="font-black text-emerald-800 flex items-center gap-2"><FaCheckCircle /> Parecer e Conclusão</h2>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Ação Aplicada ao Motorista</label>
                  <select className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 focus:border-emerald-500 outline-none" value={acao} onChange={(e) => setAcao(e.target.value)}>
                    {acoes.map((a) => (<option key={a} value={a}>{a}</option>))}
                  </select>
                </div>

                {acao === "Suspensão" && (
                  <div className="grid grid-cols-2 gap-4 bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Dias de Suspensão</label>
                      <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold" value={diasSusp} onChange={(e) => setDiasSusp(Number(e.target.value))}>
                        {[1, 2, 3, 5, 7].map((d) => <option key={d} value={d}>{d} dia(s)</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Data Início</label>
                      <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold" value={dataSuspensao} onChange={(e) => setDataSuspensao(e.target.value)} />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Relato Final / Argumentação</label>
                  <textarea rows={4} className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 focus:border-emerald-500 outline-none resize-none" value={resumo} onChange={(e) => setResumo(e.target.value)} placeholder="Detalhe a conversa, a justificativa do motorista e o motivo da ação tomada..." />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Anexar Documento Assinado (Opcional)</label>
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => setAnexoTratativa(e.target.files?.[0] || null)} className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <button onClick={concluir} disabled={loading} className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md transition-all disabled:opacity-50">
                    {loading ? "Processando..." : "Finalizar Tratativa"}
                  </button>

                  <button type="button" onClick={() => {
                    if (acao === "Orientação") return gerarOrientacao();
                    if (acao === "Advertência") return gerarAdvertencia();
                    if (acao === "Suspensão") return gerarSuspensao();
                    alert('Selecione "Orientação", "Advertência" ou "Suspensão" para gerar o documento PDF de assinatura.');
                  }} className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all">
                    Gerar PDF para Assinatura
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 rounded-[1.5rem] border border-emerald-200 p-8 text-center shadow-sm">
              <FaCheckCircle className="text-5xl text-emerald-400 mx-auto mb-4" />
              <h3 className="text-xl font-black text-emerald-800">Tratativa Finalizada</h3>
              <p className="text-sm font-medium text-emerald-600 mt-2">Nenhuma ação pendente para esta ocorrência.</p>
              <button onClick={() => nav("/desempenho-diesel/tratativas")} className="mt-6 px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors">
                Voltar à Lista
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
