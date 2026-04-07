import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import {
  FaArrowLeft,
  FaEdit,
  FaClipboardList,
  FaHistory,
  FaWrench,
  FaFilePdf,
  FaFileImage,
  FaFileAlt
} from "react-icons/fa";

export default function ConsultarEstruturaFisica() {
  const { id } = useParams();
  const nav = useNavigate();

  const [item, setItem] = useState(null);
  const [historico, setHistorico] = useState([]);

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

  const renderListaArquivos = (urls, label) => {
    const arr = Array.isArray(urls) ? urls.filter(Boolean) : [];
    if (arr.length === 0) return null;

    return (
      <div className="mt-4">
        <span className="block text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">{label}</span>
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
                className="group flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
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
                  <div className="h-20 w-full flex items-center justify-center text-slate-400 group-hover:text-indigo-500 mb-2 bg-white rounded-lg border border-slate-200">
                    {pdf ? <FaFilePdf size={28} /> : <FaFileAlt size={28} />}
                  </div>
                )}
                <div className="text-[10px] font-bold text-slate-600 group-hover:text-indigo-700 text-center w-full truncate">
                  {fileNameFromUrl(u)}
                </div>
              </a>
            );
          })}
        </div>
      </div>
    );
  };

  const fmtDataHora = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleString("pt-BR");
  };

  const getStatusColor = (status) => {
    const s = String(status || "").toUpperCase();
    if (s === "CONCLUIDO") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (s === "CANCELADO") return "bg-rose-50 text-rose-700 border-rose-200";
    if (s.includes("ANDAMENTO") || s.includes("TRATATIVA")) return "bg-blue-50 text-blue-700 border-blue-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

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

  const ultima = useMemo(() => {
    if (!historico?.length) return null;
    return historico[0];
  }, [historico]);

  if (!item) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-slate-500 font-bold animate-pulse">Carregando dados...</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col">
          <button
            onClick={() => nav(-1)}
            className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors font-bold text-sm mb-2 self-start"
          >
            <FaArrowLeft /> Voltar
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
              Solicitação Estrutural
            </h1>
            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200">
              #{item.id}
            </span>
          </div>
        </div>

        {!["CONCLUIDO", "CANCELADO"].includes(item.status) && (
          <button
            onClick={() => nav(`/estrutura-fisica/tratar/${id}`)}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-white font-bold hover:bg-indigo-700 transition shadow-sm"
          >
            <FaEdit /> Editar / Tratar
          </button>
        )}
      </div>

      {/* DETALHES PRINCIPAIS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-2">
          <FaClipboardList className="text-slate-400" size={18} />
          <h2 className="font-black text-slate-700 uppercase tracking-wider text-sm">Detalhes da Solicitação</h2>
        </div>
        
        <div className="p-6">
          <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Item titulo="Status" valor={
              <span className={`inline-flex px-2.5 py-1 rounded-md border text-[10px] font-black uppercase tracking-wider ${getStatusColor(item.status)}`}>
                {item.status || "Pendente"}
              </span>
            } />
            <Item titulo="Nº Pedido" valor={item.numero_pedido || "-"} className="font-mono text-indigo-700" />
            <Item titulo="Prioridade" valor={
              <span className={`font-black ${item.prioridade === 'ALTA' ? 'text-rose-600' : item.prioridade === 'MÉDIA' ? 'text-amber-600' : 'text-slate-700'}`}>
                {item.prioridade || "-"}
              </span>
            } />
            <Item
              titulo="Data da solicitação"
              valor={item.data_solicitacao ? new Date(`${item.data_solicitacao}T00:00:00`).toLocaleDateString("pt-BR") : "-"}
            />
            
            <Item titulo="Nome do solicitante" valor={item.nome_solicitante || "-"} className="lg:col-span-2" />
            <Item titulo="Setor" valor={item.setor || "-"} />
            <Item titulo="Responsável da área" valor={item.responsavel_area || "-"} />

            <Item
              titulo="Prazo estimado"
              valor={item.prazo_estimado ? new Date(`${item.prazo_estimado}T00:00:00`).toLocaleDateString("pt-BR") : "-"}
              className="lg:col-span-4 bg-amber-50 border-amber-100"
            />

            <Item
              titulo="Justificativa do impacto"
              valor={item.justificativa_impacto || "-"}
              className="md:col-span-2 lg:col-span-4"
            />

            <Item
              titulo="Descrição da demanda"
              valor={item.descricao_demanda || "-"}
              className="md:col-span-2 lg:col-span-4 bg-slate-100 border-transparent"
            />

            <div className="md:col-span-2 lg:col-span-4">
              {renderListaArquivos(item.evidencias_abertura, "Evidências da abertura")}
            </div>
          </dl>
        </div>
      </div>

      {/* ÚLTIMA ATUALIZAÇÃO */}
      <div className="bg-indigo-50/50 rounded-2xl border border-indigo-100 overflow-hidden shadow-sm">
        <div className="bg-indigo-100/50 border-b border-indigo-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaWrench className="text-indigo-500" size={16} />
            <h2 className="font-black text-indigo-900 uppercase tracking-wider text-sm">Ação Mais Recente</h2>
          </div>
          <span className="text-xs font-bold text-indigo-500">{fmtDataHora(ultima?.created_at || item?.created_at)}</span>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Item titulo="Ação / Tarefa" valor={ultima?.acao || "-"} className="lg:col-span-2 bg-white border-indigo-50" />
            <Item titulo="Status Aplicado" valor={
               <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-wider ${getStatusColor(ultima?.status_aplicado || item?.status)}`}>
                 {ultima?.status_aplicado || item?.status || "-"}
               </span>
            } className="bg-white border-indigo-50" />
            <Item titulo="Responsável Execução" valor={ultima?.quem_vai_realizar || item?.quem_vai_realizar || "-"} className="bg-white border-indigo-50" />
            
            <Item
              titulo="Valor Gasto"
              valor={
                ultima?.valor_gasto != null
                  ? Number(ultima.valor_gasto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : item?.valor_gasto != null
                  ? Number(item.valor_gasto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : "-"
              }
              className="font-mono font-black text-emerald-700 bg-white border-indigo-50"
            />
            <Item
              titulo="Atualizado por"
              valor={ultima?.realizado_por_nome || item?.concluido_por_nome || item?.cancelado_por_nome || "-"}
              className="lg:col-span-3 bg-white border-indigo-50"
            />
            
            <Item
              titulo="Comentários / Observações"
              valor={ultima?.comentarios_estrutura || item?.comentarios_estrutura || "Sem comentários."}
              className="md:col-span-2 lg:col-span-4 bg-white border-indigo-50"
            />

            <div className="md:col-span-2 lg:col-span-4">
              {renderListaArquivos(
                ultima?.evidencias_execucao?.length ? ultima.evidencias_execucao : item.evidencias_execucao,
                "Evidências da execução"
              )}
            </div>
          </div>
        </div>
      </div>

      {/* HISTÓRICO / TIMELINE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-2">
          <FaHistory className="text-slate-400" size={16} />
          <h2 className="font-black text-slate-700 uppercase tracking-wider text-sm">Histórico de Movimentações</h2>
        </div>

        <div className="p-6">
          {historico.length === 0 ? (
            <div className="text-center py-8 text-slate-400 font-bold border-2 border-dashed border-slate-100 rounded-xl">
              Nenhuma movimentação registrada.
            </div>
          ) : (
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:via-slate-200 before:to-transparent">
              {historico.map((h, index) => (
                <div key={h.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 text-slate-500 font-black shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 text-xs">
                    {historico.length - index}
                  </div>
                  
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
                    <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                      <div>
                        <p className="font-black text-slate-800 leading-tight">{h.acao || "Atualização de Status"}</p>
                        <p className="text-xs text-slate-400 font-bold mt-1">{fmtDataHora(h.created_at)}</p>
                      </div>
                      <span className={`inline-flex px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider ${getStatusColor(h.status_aplicado)}`}>
                        {h.status_aplicado || "-"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Atualizado por</p>
                          <p className="text-sm font-bold text-slate-700">{h.realizado_por_nome || "-"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Responsável</p>
                          <p className="text-sm font-bold text-slate-700">{h.quem_vai_realizar || "-"}</p>
                        </div>
                      </div>
                      
                      {h.valor_gasto != null && (
                        <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Valor Gasto</p>
                          <p className="text-sm font-mono font-black text-emerald-600">
                            {Number(h.valor_gasto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </p>
                        </div>
                      )}

                      {h.comentarios_estrutura && (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Comentários</p>
                          <p className="text-sm text-slate-600 whitespace-pre-wrap">{h.comentarios_estrutura}</p>
                        </div>
                      )}

                      {renderListaArquivos(h.evidencias_execucao, "Evidências anexadas")}
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

function Item({ titulo, valor, className = "" }) {
  return (
    <div className={`bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-center ${className}`}>
      <dt className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">{titulo}</dt>
      <dd className="text-sm font-bold text-slate-800 whitespace-pre-wrap">{valor}</dd>
    </div>
  );
}
