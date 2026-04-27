// src/pages/DieselConsultarTratativa.jsx
// ✅ AJUSTE PEDIDO:
// - Mesma identidade/layout do DieselTratarTratativa (cards, header, docs, timeline)
// - Remover do bloco de detalhes: Setor, Linha, Data/Hora (do ocorrido)
// - Manter consulta (somente leitura), mas com botão "Ir para Tratar" no topo
// - Mostrar "Quem abriu" (mesma lógica: busca em diesel_tratativas_detalhes ABERTURA_* com fallback)
// - Mantém evidências: prontuário (PDF), evidências anexadas (thumbs) e timeline
// ⚠️ NÃO altera banco; apenas front.

import { useEffect, useMemo, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";
import {
  FaUser,
  FaHistory,
  FaRobot,
  FaClock,
  FaFolderOpen,
  FaCheckCircle,
  FaFileAlt,
  FaGavel,
} from "react-icons/fa";

function isValidUUID(v) {
  if (!v) return false;
  const s = String(v).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

function pickUserUuid(user) {
  if (isValidUUID(user?.auth_user_id)) return user.auth_user_id;
  if (isValidUUID(user?.id)) return user.id;
  return null;
}

export default function DieselConsultarTratativa() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useContext(AuthContext);

  const [t, setT] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [errorLoading, setErrorLoading] = useState(false);

  // ✅ NOVO: quem abriu
  const [abertoPor, setAbertoPor] = useState({
    nome: "",
    login: "",
    id: "",
    data: "",
  });

  // ============================================================================
  // HELPERS (DATA / ARQUIVOS)
  // ============================================================================
  const brDateTime = (d) => {
    if (!d) return "—";
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  };

  const fileNameFromUrl = (u) => {
    try {
      const raw = String(u || "");
      const noHash = raw.split("#")[0];
      const noQuery = noHash.split("?")[0];
      const last = noQuery.split("/").filter(Boolean).pop() || "arquivo";
      return decodeURIComponent(last);
    } catch {
      return "arquivo";
    }
  };

  const isPdf = (fileOrUrl) => {
    if (!fileOrUrl) return false;
    if (typeof fileOrUrl === "string") return fileOrUrl.toLowerCase().includes(".pdf");
    return false;
  };

  const isImageUrl = (u) => {
    const s = String(u || "").toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/.test(s);
  };

  const resolveAbertura = (detalhesList, tratativaRow) => {
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

    // fallback: se existir algo na tratativa
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
  };

  // ============================================================================
  // EVIDÊNCIAS (Atualizada conforme Tratar)
  // ============================================================================
  // Lê diretamente da coluna de PDF
  const prontuarioPdfUrl = t?.url_pdf_tratativa || null;

  // Limpa o array antigo e garante que não haja duplicatas ou o PDF principal no meio
  const outrasEvidencias = useMemo(() => {
    if (!t?.evidencias_urls) return [];
    try {
      let arr = Array.isArray(t.evidencias_urls) ? t.evidencias_urls : JSON.parse(t.evidencias_urls);
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
  // LOAD
  // ============================================================================
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("diesel_tratativas")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;
        setT(data || null);

        const h = await supabase
          .from("diesel_tratativas_detalhes")
          .select(
            "id, created_at, tratativa_id, acao_aplicada, observacoes, imagem_tratativa, anexo_tratativa, tratado_por_login, tratado_por_nome, tratado_por_id"
          )
          .eq("tratativa_id", id)
          .order("created_at", { ascending: true }); // ✅ timeline igual ao Tratar (asc)

        if (h.error) throw h.error;

        setHistorico(h.data || []);
        setAbertoPor(resolveAbertura(h.data || [], data || null));
      } catch (e) {
        console.error(e);
        setErrorLoading(true);
      }
    })();
  }, [id]);

  // ============================================================================
  // DERIVADOS (status / última ação etc.)
  // ============================================================================
  const abertoLabel =
    abertoPor?.nome || abertoPor?.login
      ? `${abertoPor?.nome || ""}${abertoPor?.nome && abertoPor?.login ? " — " : ""}${
          abertoPor?.login || ""
        }`
      : "Sistema";

  const ultimaAcao = useMemo(() => {
    if (!historico || historico.length === 0) return null;
    return historico[historico.length - 1];
  }, [historico]);

  const conclusaoQuem =
    ultimaAcao?.tratado_por_nome || ultimaAcao?.tratado_por_login || "—";
  const conclusaoQuando = brDateTime(ultimaAcao?.created_at);
  const conclusaoObs = ultimaAcao?.observacoes || "Sem observações registradas.";

  if (errorLoading) {
    return (
      <div className="flex h-screen items-center justify-center font-bold text-rose-500">
        Erro ao carregar dados da Tratativa. O registro pode ter sido excluído.
      </div>
    );
  }

  if (!t) {
    return (
      <div className="flex h-screen items-center justify-center font-bold text-slate-500">
        Carregando dados da Tratativa...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8 font-sans bg-slate-50 min-h-screen text-slate-800 space-y-6">
      {/* HEADER PAGE (mesmo conceito do Tratar) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3 text-slate-900">
            <FaGavel className="text-rose-600" /> Consulta de Tratativa
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Visualize os dados, evidências e histórico. Para editar, use o botão de tratar.
          </p>
        </div>

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

          <button
            onClick={() => nav(`/diesel/tratar/${id}`)}
            className="mt-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all"
          >
            IR PARA TRATAR
          </button>
        </div>
      </div>

      {/* ==========================================
          BLOCO 1: TOPO (DADOS ESQUERDA / DOCS DIREITA)
          - Removido: Setor, Linha, Data/Hora ocorrido
          ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DADOS */}
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
              {t.status || "—"}
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 flex-1">
            <div className="sm:col-span-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Motorista
              </p>
              <p className="text-xl font-black text-slate-800 mt-1">
                {t.motorista_nome || "N/D"}
              </p>
              <p className="text-sm font-mono text-slate-500 mt-0.5">
                Chapa: {t.motorista_chapa || "N/D"}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Nível de Prioridade
              </p>
              <p className="text-lg font-bold text-rose-600 mt-1">{t.prioridade || "—"}</p>
            </div>

            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Classificação
              </p>
              <p className="text-base font-bold text-slate-700 mt-1">
                {t.tipo_ocorrencia || "—"}
              </p>
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

        {/* DOCUMENTOS E EVIDÊNCIAS (igual ao Tratar) */}
        <div className="lg:col-span-1 bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
          <div className="bg-slate-50 border-b border-slate-100 px-6 py-4">
            <h2 className="font-black text-slate-800 flex items-center gap-2">
              <FaFolderOpen className="text-slate-400" /> Documentos Oficiais
            </h2>
          </div>

          <div className="p-6 space-y-6 flex-1">
            {/* PRONTUÁRIO */}
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

            {/* OUTRAS EVIDÊNCIAS */}
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
          BLOCO 2: CONCLUSÃO (mesmo conceito visual)
          ========================================== */}
      <div className="bg-emerald-50 rounded-[1.5rem] border border-emerald-200 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-center gap-2 text-emerald-800 font-black">
            <FaCheckCircle /> Conclusão / Último Registro
          </div>
          <div className="text-xs font-bold text-emerald-700 opacity-90">{conclusaoQuando}</div>
        </div>

        <div className="mt-2 text-lg font-black text-emerald-900">
          {ultimaAcao?.acao_aplicada || "—"}
        </div>

        <div className="mt-2 text-sm text-emerald-900">
          <span className="font-black">Quem tratou:</span> {conclusaoQuem}
        </div>

        <div className="mt-3 text-sm text-emerald-900 whitespace-pre-wrap">{conclusaoObs}</div>

        {/* anexos do último registro (se houver) - mantendo conceito do teu consultar */}
        {(ultimaAcao?.imagem_tratativa || ultimaAcao?.anexo_tratativa) && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {ultimaAcao?.imagem_tratativa ? (
              <CardArquivo url={ultimaAcao.imagem_tratativa} label="Evidência da conclusão" />
            ) : (
              <div />
            )}
            {ultimaAcao?.anexo_tratativa ? (
              <CardArquivo url={ultimaAcao.anexo_tratativa} label="Anexo da tratativa" />
            ) : (
              <div />
            )}
          </div>
        )}
      </div>

      {/* ==========================================
          BLOCO 3: HISTÓRICO (timeline igual ao Tratar)
          ========================================== */}
      <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-4">
          <h2 className="font-black text-slate-800 flex items-center gap-2">
            <FaHistory className="text-slate-400" /> Histórico de Movimentações
          </h2>
        </div>

        <div className="p-6 md:p-8">
          {historico.length === 0 ? (
            <div className="text-sm text-slate-400 italic text-center py-6">
              Nenhum evento registrado ainda.
            </div>
          ) : (
            <div className="space-y-6 pl-2">
              {historico.map((det) => (
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

                    {det.observacoes ? (
                      <p className="text-sm text-slate-600 whitespace-pre-wrap font-medium leading-relaxed">
                        {det.observacoes}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400 italic">Sem observações.</p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Por: {det.tratado_por_nome || det.tratado_por_login || "Sistema Robô"}
                      </p>
                    </div>

                    {(det.imagem_tratativa || det.anexo_tratativa) && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <CardArquivo url={det.imagem_tratativa} label="Evidência da conclusão" />
                        </div>
                        <div>
                          <CardArquivo url={det.anexo_tratativa} label="Anexo da tratativa" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-2">
        <button
          onClick={() => nav("/diesel/tratativas")}
          className="rounded-xl bg-slate-200 px-5 py-3 text-slate-700 hover:bg-slate-300 font-bold text-sm"
        >
          Voltar à Central
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE AUX (mantém thumb/pdf, mas com visual “card” consistente)
// ============================================================================
function CardArquivo({ url, label }) {
  if (!url) return null;

  const fileNameFromUrl = (u) => {
    try {
      const raw = String(u || "");
      const noHash = raw.split("#")[0];
      const noQuery = noHash.split("?")[0];
      const last = noQuery.split("/").filter(Boolean).pop() || "arquivo";
      return decodeURIComponent(last);
    } catch {
      return "arquivo";
    }
  };

  const isPdf = (fileOrUrl) => {
    if (!fileOrUrl) return false;
    if (typeof fileOrUrl === "string") return fileOrUrl.toLowerCase().includes(".pdf");
    return false;
  };

  const isImageUrl = (u) => {
    const s = String(u || "").toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/.test(s);
  };

  const pdf = isPdf(url);
  const img = !pdf && isImageUrl(url);
  const name = fileNameFromUrl(url);

  if (img) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border-b border-slate-100">
          {label}
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" className="block group">
          <img
            src={url}
            alt={name}
            className="h-28 w-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div className="px-3 py-2 text-xs font-bold text-slate-600 truncate">{name}</div>
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border-b border-slate-100">
        {label}
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="p-4 flex items-center justify-center text-center hover:bg-slate-50 transition-colors"
        title={name}
      >
        <div className="flex flex-col items-center gap-2">
          <FaFileAlt className="text-2xl text-blue-600" />
          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-50 text-blue-700">
            {pdf ? "PDF" : "ARQ"}
          </span>
          <span className="text-xs font-bold text-slate-700 max-w-[220px] truncate">{name}</span>
        </div>
      </a>
    </div>
  );
}
