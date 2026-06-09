import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../supabase";
import {
  FaArrowLeft,
  FaEdit,
  FaUser,
  FaBuilding,
  FaFlag,
  FaExclamationTriangle,
  FaCalendarAlt,
  FaInfoCircle,
  FaClipboardList,
  FaHistory,
  FaTools,
  FaFilePdf,
  FaFileAlt,
} from "react-icons/fa";

const STATUS_LABELS = {
  PENDENTE: "Pendente",
  EM_ANALISE: "Em análise",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

function statusLabel(s) {
  return STATUS_LABELS[String(s || "").toUpperCase()] || s || "-";
}

function statusBadgeClasses(status) {
  const s = String(status || "").toUpperCase();
  const base = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-sm border";
  if (s === "PENDENTE") return `${base} bg-yellow-50 text-yellow-700 border-yellow-200`;
  if (s === "EM_ANALISE") return `${base} bg-blue-50 text-blue-700 border-blue-200`;
  if (s === "EM_ANDAMENTO") return `${base} bg-orange-50 text-orange-700 border-orange-200`;
  if (s === "CONCLUIDO") return `${base} bg-green-50 text-green-700 border-green-200`;
  if (s === "CANCELADO") return `${base} bg-slate-100 text-slate-700 border-slate-300`;
  return `${base} bg-slate-100 text-slate-700 border-slate-300`;
}

function isFinalizada(status) {
  const st = String(status || "").toUpperCase();
  return st === "CONCLUIDO" || st === "CANCELADO";
}

function fileNameFromUrl(u) {
  try {
    const raw = String(u || "");
    const noHash = raw.split("#")[0];
    const noQuery = noHash.split("?")[0];
    const last = noQuery.split("/").filter(Boolean).pop() || "arquivo";
    return decodeURIComponent(last);
  } catch {
    return "arquivo";
  }
}

function isPdf(u) {
  return String(u || "").toLowerCase().includes(".pdf");
}

function isImageUrl(u) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/.test(String(u || "").toLowerCase());
}

function fmtDataHora(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("pt-BR");
}

export default function ConsultarEstruturaFisica() {
  const { id } = useParams();
  const nav = useNavigate();

  const [item, setItem] = useState(null);
  const [historico, setHistorico] = useState([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("estrutura_fisica_solicitacoes")
        .select("*")
        .eq("id", id)
        .single();
      if (error) console.error(error);
      setItem(data || null);

      const hist = await supabase
        .from("estrutura_fisica_historico")
        .select("*")
        .eq("solicitacao_id", id)
        .order("created_at", { ascending: false });
      if (hist.error) console.error(hist.error);
      setHistorico(hist.data || []);
    })();
  }, [id]);

  const ultima = useMemo(() => (historico?.length ? historico[0] : null), [historico]);
  const finalizada = isFinalizada(item?.status);

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 font-bold animate-pulse">Carregando dados...</div>
      </div>
    );
  }

  const dataSolic = item.data_solicitacao
    ? new Date(`${item.data_solicitacao}T00:00:00`).toLocaleDateString("pt-BR")
    : "-";
  const prazoEstimado = item.prazo_estimado
    ? new Date(`${item.prazo_estimado}T00:00:00`).toLocaleDateString("pt-BR")
    : "-";

  return (
    <div className="min-h-screen space-y-5 bg-slate-50 p-4 md:p-6 text-slate-800">
      {/* Hero */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <button
            onClick={() => nav(-1)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <FaArrowLeft /> Voltar
          </button>

          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-orange-600">
              Estrutura Física
            </div>
            <h1 className="mt-3 flex items-center gap-3 text-3xl font-black text-slate-900">
              <span className="rounded-2xl bg-orange-50 p-3 text-orange-600 shadow-sm">
                <FaTools />
              </span>
              Consultar Solicitação
              <span className="text-sm font-mono font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200 align-middle">
                #{item.numero_pedido || item.id}
              </span>
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Visualização completa da solicitação, conclusão e histórico de ações.
            </p>
          </div>
        </div>

        {!finalizada && (
          <button
            onClick={() => nav(`/estrutura-fisica/tratar/${id}`)}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700"
          >
            <FaEdit />
            Tratar
          </button>
        )}
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <ResumoCard
          titulo="Solicitante"
          valor={item.nome_solicitante || "-"}
          subtitulo={item.setor || "-"}
          icon={<FaUser className="text-3xl text-blue-100" />}
          border="border-l-blue-500"
        />
        <ResumoCard
          titulo="Prioridade"
          valor={item.prioridade || "-"}
          subtitulo={`Prazo: ${prazoEstimado}`}
          icon={<FaExclamationTriangle className="text-3xl text-amber-100" />}
          border="border-l-amber-500"
        />
        <ResumoCard
          titulo="Status"
          valor={statusLabel(item.status)}
          subtitulo={item.responsavel_area || "-"}
          icon={<FaInfoCircle className="text-3xl text-orange-100" />}
          border="border-l-orange-500"
        />
        <ResumoCard
          titulo="Data da solicitação"
          valor={dataSolic}
          subtitulo={`Aberto em ${fmtDataHora(item.created_at)}`}
          icon={<FaCalendarAlt className="text-3xl text-emerald-100" />}
          border="border-l-emerald-500"
        />
      </div>

      {/* Detalhes */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <FaClipboardList className="text-slate-500" />
          <h2 className="text-lg font-bold text-slate-800">Detalhes da Solicitação</h2>
        </div>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Item titulo="Solicitante" valor={item.nome_solicitante || "-"} icon={<FaUser />} />
          <Item titulo="Setor" valor={item.setor || "-"} icon={<FaBuilding />} />
          <Item titulo="Responsável da área" valor={item.responsavel_area || "-"} icon={<FaUser />} />
          <Item titulo="Prioridade" valor={item.prioridade || "-"} icon={<FaFlag />} />
          <Item titulo="Status" valor={
            <span className={statusBadgeClasses(item.status)}>{statusLabel(item.status)}</span>
          } />
          <Item titulo="Data da solicitação" valor={dataSolic} icon={<FaCalendarAlt />} />
          <Item titulo="Prazo estimado" valor={prazoEstimado} icon={<FaCalendarAlt />} />
          <Item titulo="Nº pedido" valor={`#${item.numero_pedido || "-"}`} />

          <Item
            titulo="Descrição da demanda"
            valor={item.descricao_demanda || "-"}
            className="md:col-span-2"
          />
          <Item
            titulo="Justificativa do impacto"
            valor={item.justificativa_impacto || "-"}
            className="md:col-span-2"
          />

          <div className="md:col-span-2">
            <ListaArquivos
              urls={item.evidencias_abertura}
              label="Evidências da abertura"
            />
          </div>
        </dl>
      </div>

      {/* Conclusão / Última ação (verde quando concluído, laranja quando em andamento) */}
      {ultima && (
        <div className={`rounded-3xl border p-5 shadow-sm ${
          finalizada
            ? "border-emerald-200 bg-emerald-50"
            : "border-orange-200 bg-orange-50"
        }`}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
            <div>
              <h2 className={`text-lg font-bold ${finalizada ? "text-emerald-900" : "text-orange-900"}`}>
                {finalizada ? "Conclusão" : "Última ação registrada"}
              </h2>
              <p className={`text-sm mt-1 ${finalizada ? "text-emerald-700" : "text-orange-700"}`}>
                {finalizada ? "Encerramento desta solicitação." : "Andamento mais recente."}
              </p>
            </div>
            <span className={`text-sm font-semibold ${finalizada ? "text-emerald-800" : "text-orange-800"}`}>
              {fmtDataHora(ultima.created_at)}
            </span>
          </div>

          <div className={`mt-4 rounded-lg bg-white/70 border p-4 ${
            finalizada ? "border-emerald-200" : "border-orange-200"
          }`}>
            <div className="font-bold text-slate-800">{ultima.acao || "—"}</div>

            <div className="mt-2 text-sm text-slate-700">
              <span className="font-semibold">Atualizado por:</span> {ultima.realizado_por_nome || "—"}
              {ultima.quem_vai_realizar && (
                <>
                  {" · "}
                  <span className="font-semibold">Responsável:</span> {ultima.quem_vai_realizar}
                </>
              )}
              {ultima.valor_gasto != null && (
                <>
                  {" · "}
                  <span className="font-semibold">Valor:</span>{" "}
                  <span className="font-mono font-bold text-emerald-700">
                    {Number(ultima.valor_gasto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </>
              )}
            </div>

            {ultima.comentarios_estrutura && (
              <div className="mt-3 whitespace-pre-wrap text-slate-700">{ultima.comentarios_estrutura}</div>
            )}

            <div className="mt-4">
              <ListaArquivos
                urls={ultima.evidencias_execucao}
                label="Evidências da execução"
              />
            </div>
          </div>
        </div>
      )}

      {/* Histórico */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <FaHistory className="text-slate-500" />
          <h2 className="text-lg font-bold text-slate-800">Histórico / Ações aplicadas</h2>
        </div>

        {historico.length === 0 ? (
          <div className="text-slate-500">Sem histórico.</div>
        ) : (
          <ul className="space-y-4">
            {historico.map((h) => (
              <li key={h.id} className="rounded-xl border p-4 bg-slate-50/60">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-800">{h.acao || "—"}</div>
                    <div className="text-sm text-slate-600 mt-1">
                      <span className="font-semibold">Atualizado por:</span> {h.realizado_por_nome || "—"}
                      {h.status_aplicado && (
                        <span className="ml-2">
                          <span className={statusBadgeClasses(h.status_aplicado)}>{statusLabel(h.status_aplicado)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-slate-500 font-medium">{fmtDataHora(h.created_at)}</div>
                </div>

                {h.comentarios_estrutura && (
                  <div className="mt-3 text-slate-700 whitespace-pre-wrap">{h.comentarios_estrutura}</div>
                )}

                {h.valor_gasto != null && (
                  <div className="mt-3 text-sm">
                    <span className="font-semibold text-slate-700">Valor gasto:</span>{" "}
                    <span className="font-mono font-bold text-emerald-700">
                      {Number(h.valor_gasto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                )}

                <div className="mt-3">
                  <ListaArquivos urls={h.evidencias_execucao} label="Evidências" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ResumoCard({ titulo, valor, subtitulo, icon, border }) {
  const tone =
    border?.includes("blue")
      ? "from-blue-50 to-cyan-50 border-blue-200"
      : border?.includes("amber")
      ? "from-amber-50 to-orange-50 border-amber-200"
      : border?.includes("orange")
      ? "from-orange-50 to-amber-50 border-orange-200"
      : border?.includes("emerald")
      ? "from-emerald-50 to-teal-50 border-emerald-200"
      : "from-slate-50 to-gray-50 border-slate-200";

  return (
    <div className={`min-h-[124px] rounded-3xl border bg-gradient-to-br p-4 shadow-sm ${tone}`}>
      <div className="flex h-full items-start justify-between gap-3">
        <div className="flex h-full min-w-0 flex-col justify-between">
          <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{titulo}</p>
          <div className="mt-2">
            <p className="text-xl font-black text-slate-900 truncate">{valor}</p>
            {subtitulo && (
              <p className="mt-1 text-xs font-semibold text-slate-500 truncate">{subtitulo}</p>
            )}
          </div>
        </div>
        <div className="opacity-80 shrink-0">{icon}</div>
      </div>
    </div>
  );
}

function Item({ titulo, valor, icon, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50 p-3.5 flex flex-col ${className}`}>
      <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 mb-1 flex items-center gap-1.5">
        {icon && <span className="text-slate-400">{icon}</span>}
        {titulo}
      </dt>
      <dd className="text-sm font-bold text-slate-800 whitespace-pre-wrap">{valor || "-"}</dd>
    </div>
  );
}

function ListaArquivos({ urls, label }) {
  const arr = Array.isArray(urls) ? urls.filter(Boolean) : [];
  if (arr.length === 0) return null;

  return (
    <div>
      <span className="block text-[11px] text-slate-500 font-black uppercase tracking-[0.18em] mb-2">{label}</span>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {arr.map((u, i) => {
          const pdf = isPdf(u);
          const img = !pdf && isImageUrl(u);
          return (
            <a
              key={`${u}-${i}`}
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3 hover:border-orange-200 hover:bg-orange-50/40 transition-colors"
            >
              {img ? (
                <div className="w-full h-20 mb-2 overflow-hidden rounded-lg border border-slate-200">
                  <img
                    src={u}
                    alt={fileNameFromUrl(u)}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="h-20 w-full flex items-center justify-center text-slate-400 group-hover:text-orange-500 mb-2 bg-slate-50 rounded-lg border border-slate-200">
                  {pdf ? <FaFilePdf size={28} /> : <FaFileAlt size={28} />}
                </div>
              )}
              <div className="text-[10px] font-bold text-slate-600 group-hover:text-orange-700 text-center w-full truncate">
                {fileNameFromUrl(u)}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
