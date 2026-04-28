// src/pages/DieselTratarTratativa.jsx
// ✅ AJUSTE PEDIDO (sem mexer no layout):
// 1) Mostrar "Quem abriu a tratativa" (campo exibido no header e no bloco de dados)
// 2) Botão "Excluir" visível APENAS para Gestores (e Admin) com confirmação
// ⚠️ Mantém o layout atual: só adiciona blocos/linhas e o botão.

import { useEffect, useMemo, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";
import {
  FaUser,
  FaGavel,
  FaHistory,
  FaFilePdf,
  FaCheckCircle,
  FaFileAlt,
  FaRobot,
  FaClock,
  FaFolderOpen,
  FaTrash,
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

function pickNumericUserId(user) {
  const candidates = [user?.usuario_id, user?.id];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function pickUserNivel(user) {
  return String(user?.nivel || user?.role || user?.perfil || "").trim();
}

function isGestorOuAdmin(user) {
  const n = pickUserNivel(user).toLowerCase();
  return n.includes("gestor") || n.includes("admin");
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

  // Suspensão
  const [diasSusp, setDiasSusp] = useState(1);
  const [dataSuspensao, setDataSuspensao] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  // ✅ NOVO: infos de abertura (quem abriu)
  const [abertoPor, setAbertoPor] = useState({
    nome: "",
    login: "",
    id: "",
    data: "",
  });

  const canDelete = useMemo(() => isGestorOuAdmin(user), [user]);

  // ============================================================================
  // FUNÇÕES DE DATA E FORMATAÇÃO
  // ============================================================================
  const dataPtCompletaUpper = (d = new Date()) => {
    const meses = [
      "JANEIRO",
      "FEVEREIRO",
      "MARÇO",
      "ABRIL",
      "MAIO",
      "JUNHO",
      "JULHO",
      "AGOSTO",
      "SETEMBRO",
      "OUTUBRO",
      "NOVEMBRO",
      "DEZEMBRO",
    ];
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
    return dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
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
  const fimSusp = useMemo(
    () => addDaysLocal(inicioSusp, Math.max(Number(diasSusp) - 1, 0)),
    [inicioSusp, diasSusp]
  );
  const retornoSusp = useMemo(
    () => addDaysLocal(inicioSusp, Math.max(Number(diasSusp), 0)),
    [inicioSusp, diasSusp]
  );

  // ============================================================================
  // HELPERS DE EVIDÊNCIAS E PDF
  // ============================================================================
  const fileNameFromUrl = (u) => {
    try {
      const raw = String(u || "");
      const last =
        raw.split("?")[0].split("#")[0].split("/").filter(Boolean).pop() || "arquivo";
      return decodeURIComponent(last);
    } catch {
      return "arquivo";
    }
  };

  const isPdf = (fileOrUrl) => {
    if (!fileOrUrl) return false;
    if (typeof fileOrUrl === "string") return fileOrUrl.toLowerCase().includes(".pdf");
    return (
      fileOrUrl.type === "application/pdf" ||
      String(fileOrUrl.name || "").toLowerCase().endsWith(".pdf")
    );
  };

  const isImageUrl = (u) =>
    /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/.test(String(u || "").toLowerCase());

  // ✅ LÊ DIRETAMENTE DA NOVA COLUNA DO BANCO
  const prontuarioPdfUrl = t?.url_pdf_tratativa || null;

  // ✅ Filtra array antigo (caso o usuário envie arquivos novos na conclusão)
  const outrasEvidencias = useMemo(() => {
    if (!t?.evidencias_urls) return [];
    try {
      let arr = Array.isArray(t.evidencias_urls) ? t.evidencias_urls : JSON.parse(t.evidencias_urls);
      // Remove duplicatas, links vazios, o html, e previne se o link principal veio aqui também
      return [...new Set(arr)].filter(u => 
        u && 
        typeof u === "string" && 
        !u.includes(".html") && 
        u !== prontuarioPdfUrl
      );
    } catch (e) {
      return [];
    }
  }, [t, prontuarioPdfUrl]);

  // ============================================================================
  // CARGA DE DADOS
  // ============================================================================
  function resolveAbertura(detalhesList, tratativaRow) {
    // 1) tenta pegar a primeira linha de ABERTURA_*
    const open =
      (detalhesList || []).find(
        (x) => x?.acao_aplicada === "ABERTURA_MANUAL" || x?.acao_aplicada === "ABERTURA_AUTOMATICA"
      ) || null;

    if (open) {
      return {
        nome: open?.tratado_por_nome || "",
        login: open?.tratado_por_login || "",
        id: open?.tratado_por_id || "",
        data: open?.created_at || tratativaRow?.created_at || "",
      };
    }

    // 2) fallback: tenta campos na própria tratativa, se existirem (não assume schema, só usa se tiver)
    const byNome =
      tratativaRow?.aberto_por_nome ||
      tratativaRow?.criado_por_nome ||
      tratativaRow?.created_by_nome ||
      "";
    const byLogin =
      tratativaRow?.aberto_por_login ||
      tratativaRow?.criado_por_login ||
      tratativaRow?.created_by_login ||
      "";
    const byId =
      tratativaRow?.aberto_por_id ||
      tratativaRow?.criado_por_id ||
      tratativaRow?.created_by_id ||
      "";

    return {
      nome: byNome,
      login: byLogin,
      id: byId,
      data: tratativaRow?.created_at || "",
    };
  }

  async function carregarDados() {
    try {
      const { data, error } = await supabase
        .from("diesel_tratativas")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      setT(data || null);

      if (data?.linha) {
        const { data: row } = await supabase
          .from("linhas")
          .select("descricao")
          .eq("codigo", data.linha)
          .maybeSingle();
        setLinhaDescricao(row?.descricao || "");
      }

      if (data?.motorista_chapa) {
        const { data: m } = await supabase
          .from("motoristas")
          .select("cargo")
          .eq("chapa", data.motorista_chapa)
          .maybeSingle();
        setCargoMotorista((m?.cargo || data?.cargo || "Motorista").toUpperCase());
      } else {
        setCargoMotorista((data?.cargo || "Motorista").toUpperCase());
      }

      const { data: detData } = await supabase
        .from("diesel_tratativas_detalhes")
        .select("*")
        .eq("tratativa_id", id)
        .order("created_at", { ascending: true });
      setDetalhes(detData || []);

      // ✅ NOVO: calcula "quem abriu" usando detalhes + fallback na tratativa
      setAbertoPor(resolveAbertura(detData || [], data || null));
    } catch (e) {
      console.error(e);
      setErrorLoading(true);
    }
  }

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ============================================================================
  // AÇÕES DE BANCO E CONCLUSÃO
  // ============================================================================
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
          upsert: false,
          contentType: anexoTratativa.type || undefined,
        });
        if (up.error) throw up.error;
        anexo_tratativa_url = supabase.storage
          .from("diesel_tratativas")
          .getPublicUrl(safe).data.publicUrl;
      }

      const tratadoPorId = pickNumericUserId(user);
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

  // ✅ NOVO: Excluir tratativa (apenas Gestor/Admin)
  async function excluirTratativa() {
    if (!t) return;

    if (!canDelete) {
      alert("Sem permissão: apenas Gestores podem excluir.");
      return;
    }

    const confirm1 = window.confirm(
      "ATENÇÃO: Esta ação irá excluir a tratativa e seu histórico.\n\nDeseja continuar?"
    );
    if (!confirm1) return;

    // digitar ID para evitar clique acidental
    const typed = window.prompt(`Digite o ID da tratativa para confirmar exclusão:\n\n${t.id}`);
    if (String(typed || "").trim() !== String(t.id)) {
      alert("Confirmação inválida. Exclusão cancelada.");
      return;
    }

    setLoading(true);
    try {
      // 1) tenta deletar detalhes (seguro mesmo se houver FK cascade)
      const delDet = await supabase.from("diesel_tratativas_detalhes").delete().eq("tratativa_id", t.id);
      if (delDet.error) {
        // não aborta aqui caso seja cascade/rls; mas registra
        console.warn("Aviso ao deletar detalhes:", delDet.error.message);
      }

      // 2) deleta a tratativa
      const delMain = await supabase.from("diesel_tratativas").delete().eq("id", t.id);
      if (delMain.error) throw delMain.error;

      alert("Tratativa excluída com sucesso!");
      nav("/desempenho-diesel/tratativas");
    } catch (e) {
      alert(`Erro ao excluir: ${e.message}`);
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

  function renderSuspensaoHtml({
    nome,
    registro,
    cargo,
    ocorrencia,
    dataOcorr,
    observ,
    dataDoc,
    dias,
    inicio,
    fim,
    retorno,
  }) {
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
    <div class="linha mt"><div>SR(A) <span class="label">${nome}</span> ${
      registro ? `(REGISTRO: ${registro})` : ""
    }</div><div><span class="label">Cargo:</span> ${cargo}</div></div>
    <p class="mt bl">Pelo presente, notificamos que encontra-se suspenso do serviço por <span class="label nowrap">${diasFmt} ${rotuloDia}</span>, a partir de <span class="label">${brLocal(
      inicio
    )}</span>, devendo apresentar-se no horário usual no dia <span class="label">${brLocal(
      retorno
    )}</span>.</p>
    <div class="mt"><span class="label">Ocorrência:</span> ${ocorrencia}</div>
    <div class="mt"><span class="label">Data da Ocorrência:</span> ${dataOcorr}</div>
    <div class="mt"><span class="label">Período:</span> ${brLocal(inicio)} a ${brLocal(
      fim
    )} (retorno: ${brLocal(retorno)})</div>
    <div class="mt"><span class="label">Observação:</span> ${observ}</div>
    <div class="mt"><span class="label">Ciente e Concordo:</span> ________/______/__________</div>
  </div>
  <div class="footer-sign mt"><div class="ass-grid"><div class="ass"><div class="ass-line"></div>Assinatura do Empregado</div><div class="ass"><div class="ass-line"></div>Assinatura do Empregador</div></div><div class="ass-grid" style="margin-top:20px"><div class="ass"><div class="ass-line"></div>Testemunha CPF:</div><div class="ass"><div class="ass-line"></div>Testemunha CPF:</div></div></div></div>
  <script>window.onload = () => { window.print(); }</script></body></html>`;
  }

  function renderGenericHtml({
    titulo,
    intro1,
    intro2,
    nome,
    registro,
    cargo,
    ocorrencia,
    dataOcorr,
    observ,
    dataDoc,
  }) {
    return `
      <html><head><meta charset="utf-8" />${baseCssCourier()}<title>${titulo} - ${nome}</title></head>
      <body><div class="page"><div class="content">
        <div class="center">${titulo}</div><div class="right mt">${dataDoc}</div>
        <div class="linha mt"><div>SR(A) <span class="label">${nome}</span> ${
          registro ? `(REGISTRO: ${registro})` : ""
        }</div><div><span class="label">Cargo:</span> ${cargo}</div></div>
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
      titulo: "ORIENTAÇÃO",
      intro1:
        "Vimos pelo presente, aplicar-lhe a pena de orientação, em virtude de ter cometido a falta abaixo descrita.",
      intro2: "Pedimos que tal falta não mais se repita, pois poderemos adotar medidas mais severas.",
      nome: (t.motorista_nome || "—").toUpperCase(),
      registro: t.motorista_chapa || "",
      cargo: cargoMotorista,
      ocorrencia: (t.tipo_ocorrencia || "—").toUpperCase(),
      dataOcorr: t.data_ocorrido ? br(t.data_ocorrido) : "—",
      observ: (resumo || t.descricao || "").trim() || "—",
      dataDoc: dataPtCompletaUpper(new Date()),
    });
    window.open("", "_blank").document.write(html);
  }

  function gerarAdvertencia() {
    if (!t || !resumo.trim()) return alert("Preencha o Resumo para gerar a medida.");
    const html = renderGenericHtml({
      titulo: "ADVERTÊNCIA",
      intro1:
        "Vimos pelo presente, aplicar-lhe a pena de advertência, em virtude de ter cometido a falta abaixo descrita.",
      intro2: "Pedimos que tal falta não mais se repita, pois poderemos adotar medidas mais severas.",
      nome: (t.motorista_nome || "—").toUpperCase(),
      registro: t.motorista_chapa || "",
      cargo: cargoMotorista,
      ocorrencia: (t.tipo_ocorrencia || "—").toUpperCase(),
      dataOcorr: t.data_ocorrido ? br(t.data_ocorrido) : "—",
      observ: (resumo || t.descricao || "").trim() || "—",
      dataDoc: dataPtCompletaUpper(new Date()),
    });
    window.open("", "_blank").document.write(html);
  }

  function gerarSuspensao() {
    if (!t || !resumo.trim()) return alert("Preencha o Resumo para gerar a medida.");
    const html = renderSuspensaoHtml({
      nome: (t.motorista_nome || "—").toUpperCase(),
      registro: t.motorista_chapa || "",
      cargo: cargoMotorista,
      ocorrencia: (t.tipo_ocorrencia || "—").toUpperCase(),
      dataOcorr: t.data_ocorrido ? br(t.data_ocorrido) : "—",
      observ: (resumo || t.descricao || "").trim() || "—",
      dataDoc: dataPtCompletaUpper(new Date()),
      dias: diasSusp,
      inicio: inicioSusp,
      fim: fimSusp,
      retorno: retornoSusp,
    });
    window.open("", "_blank").document.write(html);
  }

  // ============================================================================
  // RENDER UI
  // ============================================================================
  if (errorLoading)
    return (
      <div className="flex h-screen items-center justify-center font-bold text-rose-500">
        Erro ao carregar dados da Tratativa. O registro pode ter sido excluído.
      </div>
    );
  if (!t)
    return (
      <div className="flex h-screen items-center justify-center font-bold text-slate-500">
        Carregando dados da Tratativa...
      </div>
    );

  const abertoLabel =
    abertoPor?.nome || abertoPor?.login
      ? `${abertoPor?.nome || ""}${abertoPor?.nome && abertoPor?.login ? " — " : ""}${
          abertoPor?.login || ""
        }`
      : "Sistema";

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8 font-sans bg-slate-50 min-h-screen text-slate-800 space-y-6">
      {/* HEADER PAGE */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3 text-slate-900">
            <FaGavel className="text-rose-600" /> Resolução de Tratativa
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Analise os dados gerados, verifique o histórico e aplique a medida cabível.
          </p>
        </div>

        {/* ✅ NOVO: infos + botão excluir (apenas gestor/admin) */}
        <div className="flex flex-col items-end gap-2 text-xs font-bold text-slate-400">
          <div className="bg-white px-3 py-1.5 rounded-lg border shadow-sm text-slate-600">
            ID: #{t.id}
          </div>

          <div className="flex items-center gap-1">
            <FaClock /> Abertura: {brDateTime(t.created_at)}
          </div>

          <div className="flex items-center gap-1">
            <FaUser /> Aberto por:{" "}
            <span className="text-slate-600 font-black">{abertoLabel}</span>
          </div>

          {abertoPor?.data ? (
            <div className="text-[10px] font-bold text-slate-400">
              (registro: {brDateTime(abertoPor.data)})
            </div>
          ) : null}

          {canDelete ? (
            <button
              onClick={excluirTratativa}
              disabled={loading}
              className="mt-1 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 shadow-sm disabled:opacity-60"
              title="Excluir tratativa (apenas Gestor/Admin)"
            >
              <FaTrash /> Excluir
            </button>
          ) : null}
        </div>
      </div>

      {/* ==========================================
          BLOCO 1: TOPO (DADOS ESQUERDA / DOCS DIREITA)
          ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DADOS DO INFRATOR */}
        <div className="lg:col-span-2 bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
          <div className="bg-rose-50/50 border-b border-rose-100 px-6 py-4 flex items-center justify-between">
            <h2 className="font-black text-rose-800 flex items-center gap-2">
              <FaUser /> Dados da Tratativa
            </h2>
            <div
              className={`px-3 py-1 rounded-md text-[10px] font-black uppercase text-white shadow-sm ${
                t.status === "Concluída" ? "bg-emerald-500" : "bg-amber-500"
              }`}
            >
              {t.status}
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 flex-1">
            <div className="sm:col-span-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Motorista Infrator
              </p>
              <p className="text-xl font-black text-slate-800 mt-1">{t.motorista_nome || "N/D"}</p>
              <p className="text-sm font-mono text-slate-500 mt-0.5">
                Chapa: {t.motorista_chapa || "N/D"}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Nível de Prioridade
              </p>
              <p className="text-lg font-bold text-rose-600 mt-1">{t.prioridade}</p>
            </div>

            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Classificação
              </p>
              <p className="text-base font-bold text-slate-700 mt-1">{t.tipo_ocorrencia || "N/D"}</p>
            </div>

            {/* ✅ NOVO: Quem abriu (dentro do card, mantendo layout) */}
            <div className="sm:col-span-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Responsável pela Abertura
              </p>
              <div className="mt-2 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-700 font-medium">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-black text-slate-800">{abertoPor?.nome || "Sistema"}</span>
                  {abertoPor?.login ? (
                    <span className="text-xs font-mono text-slate-500">{abertoPor.login}</span>
                  ) : null}
                  {abertoPor?.id ? (
                    <span className="text-[10px] font-mono text-slate-400">({abertoPor.id})</span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="sm:col-span-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Motivo e Descrição da Abertura
              </p>
              <div className="mt-2 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap font-medium">
                {t.descricao || "Sem descrição informada."}
              </div>
            </div>
          </div>
        </div>

        {/* DOCUMENTOS E EVIDÊNCIAS */}
        <div className="lg:col-span-1 bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
          <div className="bg-slate-50 border-b border-slate-100 px-6 py-4">
            <h2 className="font-black text-slate-800 flex items-center gap-2">
              <FaFolderOpen className="text-slate-400" /> Documentos Oficiais
            </h2>
          </div>
          <div className="p-6 space-y-6 flex-1">
            {/* PRONTUÁRIO DE IA (BOTÃO) */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                Dossiê de Inteligência
              </p>
              {prontuarioPdfUrl ? (
                <a
                  href={prontuarioPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-3 w-full py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-black transition-all shadow-md hover:shadow-lg transform active:scale-95"
                >
                  <FaRobot className="text-blue-400 text-xl" />
                  Prontuário de Tratativa
                </a>
              ) : (
                <div className="text-sm font-medium text-slate-400 italic bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">
                  Prontuário de Tratativa não gerado ou indisponível.
                </div>
              )}
            </div>

            {/* OUTRAS EVIDÊNCIAS (IMAGENS ETC) */}
            {outrasEvidencias.length > 0 && (
              <div className="pt-4 border-t border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  Evidências Anexadas
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {outrasEvidencias.map((u, i) => {
                    const pdf = isPdf(u);
                    const img = !pdf && isImageUrl(u);
                    const name = fileNameFromUrl(u);

                    if (img) {
                      return (
                        <a
                          key={i}
                          href={u}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-all block"
                        >
                          <img
                            src={u}
                            alt={name}
                            className="h-20 w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="px-2 py-1.5 text-[9px] font-bold text-slate-600 truncate bg-slate-50 border-t border-slate-100">
                            {name}
                          </div>
                        </a>
                      );
                    }
                    return (
                      <a
                        key={i}
                        href={u}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-slate-200 bg-white p-3 hover:shadow-md transition-all flex flex-col justify-center items-center text-center"
                      >
                        <FaFileAlt className="text-2xl text-blue-500 mb-1" />
                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-blue-50 text-blue-700 mb-1">
                          {pdf ? "PDF" : "ARQ"}
                        </span>
                        <div className="text-[9px] font-bold text-slate-600 truncate w-full">
                          {name}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==========================================
          BLOCO 2: MEIO (FORMULÁRIO DE CONCLUSÃO)
          ========================================== */}
      {t.status !== "Concluída" ? (
        <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-4">
            <h2 className="font-black text-emerald-800 flex items-center gap-2">
              <FaCheckCircle /> Parecer e Conclusão
            </h2>
          </div>
          <div className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* ESQUERDA: AÇÃO E SUSPENSÃO */}
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Medida Disciplinar Aplicada
                  </label>
                  <select
                    className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 focus:border-emerald-500 outline-none transition-colors"
                    value={acao}
                    onChange={(e) => setAcao(e.target.value)}
                  >
                    {acoes.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>

                {acao === "Suspensão" && (
                  <div className="grid grid-cols-2 gap-4 bg-amber-50 p-4 rounded-xl border border-amber-100 animate-in fade-in">
                    <div>
                      <label className="block text-xs font-bold text-amber-800 mb-1">
                        Dias de Suspensão
                      </label>
                      <select
                        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm font-bold bg-white text-amber-900"
                        value={diasSusp}
                        onChange={(e) => setDiasSusp(Number(e.target.value))}
                      >
                        {[1, 2, 3, 5, 7].map((d) => (
                          <option key={d} value={d}>
                            {d} dia(s)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-amber-800 mb-1">
                        Data Início
                      </label>
                      <input
                        type="date"
                        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm font-bold bg-white text-amber-900"
                        value={dataSuspensao}
                        onChange={(e) => setDataSuspensao(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Anexar Documento Assinado (Opcional)
                  </label>
                  <div className="border-2 border-dashed border-slate-200 bg-slate-50 rounded-xl p-3 hover:bg-slate-100 transition-colors">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setAnexoTratativa(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-white file:text-blue-700 file:shadow-sm hover:file:bg-blue-50 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* DIREITA: RELATO FINAL E BOTÕES */}
              <div className="flex flex-col h-full space-y-6">
                <div className="flex-1 flex flex-col">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Relato Final / Argumentação
                  </label>
                  <textarea
                    className="w-full flex-1 rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 focus:border-emerald-500 outline-none resize-none min-h-[120px] transition-colors"
                    value={resumo}
                    onChange={(e) => setResumo(e.target.value)}
                    placeholder="Detalhe a conversa de feedback, a justificativa do motorista e o motivo da decisão tomada..."
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (acao === "Orientação") return gerarOrientacao();
                      if (acao === "Advertência") return gerarAdvertencia();
                      if (acao === "Suspensão") return gerarSuspensao();
                      alert(
                        'Selecione "Orientação", "Advertência" ou "Suspensão" para gerar o documento PDF de assinatura.'
                      );
                    }}
                    className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all border border-slate-200"
                  >
                    Imprimir Termo
                  </button>

                  <button
                    onClick={concluir}
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {loading ? "Salvando..." : (
                      <>
                        <FaCheckCircle /> Finalizar Tratativa
                      </>
                    )}
                  </button>
                </div>

                {/* ✅ NOVO: botão excluir também no bloco de conclusão (opcional, mas sem alterar layout) */}
                {canDelete ? (
                  <button
                    onClick={excluirTratativa}
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-black text-sm border border-rose-200 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    <FaTrash /> Excluir Tratativa
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 rounded-[1.5rem] border border-emerald-200 p-8 text-center shadow-sm">
          <FaCheckCircle className="text-5xl text-emerald-400 mx-auto mb-4" />
          <h3 className="text-2xl font-black text-emerald-800">Tratativa Concluída</h3>
          <p className="text-sm font-medium text-emerald-600 mt-2">
            Nenhuma ação pendente para esta ocorrência.
          </p>

          {/* ✅ Exibe também o "aberto por" no estado concluído */}
          <div className="mt-4 text-xs font-bold text-emerald-700">
            Aberto por: <span className="font-black">{abertoLabel}</span>
          </div>

          <button
            onClick={() => nav("/desempenho-diesel/tratativas")}
            className="mt-6 px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-md"
          >
            Voltar à Central
          </button>

          {canDelete ? (
            <button
              onClick={excluirTratativa}
              disabled={loading}
              className="mt-3 px-8 py-3 bg-rose-600 text-white rounded-xl font-black text-sm hover:bg-rose-700 transition-colors shadow-md disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              <FaTrash /> Excluir
            </button>
          ) : null}
        </div>
      )}

      {/* ==========================================
          BLOCO 3: RODAPÉ (TIMELINE DE HISTÓRICO)
          ========================================== */}
      <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-4">
          <h2 className="font-black text-slate-800 flex items-center gap-2">
            <FaHistory className="text-slate-400" /> Histórico de Movimentações
          </h2>
        </div>
        <div className="p-6 md:p-8">
          {detalhes.length === 0 ? (
            <div className="text-sm text-slate-400 italic text-center py-6">
              Nenhum evento registrado ainda.
            </div>
          ) : (
            <div className="space-y-6 pl-2">
              {detalhes.map((det) => (
                <div
                  key={det.id}
                  className="relative pl-6 border-l-2 border-slate-200 last:border-l-transparent pb-4"
                >
                  <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center">
                    {det.acao_aplicada === "ABERTURA_MANUAL" ||
                    det.acao_aplicada === "ABERTURA_AUTOMATICA" ? (
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                  </div>

                  <div className="-mt-1.5 bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-black text-slate-700">{det.acao_aplicada}</p>
                      <p className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded border shadow-sm">
                        {brDateTime(det.created_at)}
                      </p>
                    </div>

                    <p className="text-sm text-slate-600 whitespace-pre-wrap font-medium leading-relaxed">
                      {det.observacoes}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Por: {det.tratado_por_nome || det.tratado_por_login || "Sistema Robô"}
                      </p>

                      {det.anexo_tratativa && (
                        <a
                          href={det.anexo_tratativa}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          <FaFilePdf /> Ver Anexo Adicionado
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
