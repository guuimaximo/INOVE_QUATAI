import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";

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
      <div className="mt-4 pt-4 border-t border-slate-100">
        <span className="block text-sm font-semibold text-slate-700 mb-3">{label}</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {arr.map((u, i) => {
            const pdf = isPdf(u);
            const img = !pdf && isImageUrl(u);

            return (
              <a
                key={`${u}-${i}`}
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-slate-200 bg-slate-50 p-2 hover:shadow-md hover:border-blue-300 transition-all flex flex-col"
              >
                {img ? (
                  <img
                    src={u}
                    alt={fileNameFromUrl(u)}
                    className="h-24 w-full object-cover rounded-lg border border-slate-200"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-24 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-400 group-hover:text-blue-500 transition-colors">
                    {pdf ? "PDF" : "ARQ"}
                  </div>
                )}
                <div className="mt-2 text-xs text-slate-600 font-medium truncate group-hover:text-blue-600 transition-colors">
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

  if (!item) return <div className="p-8 text-center text-slate-500 font-medium">Carregando informações...</div>;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        
        <div>
          <button
            onClick={() => nav(-1)}
            className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1 mb-4"
          >
            &larr; Voltar
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Consulta de Solicitação</h1>
              <p className="text-sm text-slate-500 mt-1">Pedido #{item.numero_pedido || "-"}</p>
            </div>
            {!["CONCLUIDO", "CANCELADO"].includes(item.status) && (
              <button
                onClick={() => nav(`/estrutura-fisica/tratar/${id}`)}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition-all"
              >
                Editar
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span className="w-2 h-6 bg-blue-500 rounded-full inline-block"></span>
            Detalhes da Solicitação
          </h2>

          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Item titulo="Nº Pedido" valor={item.numero_pedido || "-"} />
            <Item titulo="Nome do solicitante" valor={item.nome_solicitante || "-"} />
            <Item
              titulo="Data da solicitação"
              valor={item.data_solicitacao ? new Date(`${item.data_solicitacao}T00:00:00`).toLocaleDateString("pt-BR") : "-"}
            />
            <Item titulo="Setor" valor={item.setor || "-"} />
            <Item titulo="Responsável da área" valor={item.responsavel_area || "-"} />
            <Item titulo="Prioridade" valor={item.prioridade || "-"} />
            <Item titulo="Status" valor={item.status || "-"} />
            <Item
              titulo="Prazo estimado"
              valor={item.prazo_estimado ? new Date(`${item.prazo_estimado}T00:00:00`).toLocaleDateString("pt-BR") : "-"}
            />

            <Item titulo="Justificativa do impacto" valor={item.justificativa_impacto || "-"} className="sm:col-span-2 lg:col-span-3" />
            <Item titulo="Descrição da demanda" valor={item.descricao_demanda || "-"} className="sm:col-span-2 lg:col-span-3" />

            <div className="sm:col-span-2 lg:col-span-3">
              {renderListaArquivos(item.evidencias_abertura, "Evidências da abertura")}
            </div>
          </dl>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl shadow-sm p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
              <span className="w-2 h-6 bg-blue-500 rounded-full inline-block"></span>
              Última atualização
            </h2>
            <span className="text-sm font-semibold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
              {fmtDataHora(ultima?.created_at)}
            </span>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Item titulo="Ação" valor={ultima?.acao || "-"} className="text-blue-900" />
            <Item titulo="Status aplicado" valor={ultima?.status_aplicado || item?.status || "-"} className="text-blue-900" />
            <Item titulo="Quem vai realizar" valor={ultima?.quem_vai_realizar || item?.quem_vai_realizar || "-"} className="text-blue-900" />
            <Item
              titulo="Valor gasto"
              valor={
                ultima?.valor_gasto != null
                  ? Number(ultima.valor_gasto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : item?.valor_gasto != null
                  ? Number(item.valor_gasto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : "-"
              }
              className="text-blue-900"
            />
            <Item
              titulo="Atualizado por"
              valor={ultima?.realizado_por_nome || item?.concluido_por_nome || item?.cancelado_por_nome || "-"}
              className="text-blue-900 sm:col-span-2"
            />
            <Item
              titulo="Comentários"
              valor={ultima?.comentarios_estrutura || item?.comentarios_estrutura || "-"}
              className="text-blue-900 sm:col-span-2 lg:col-span-3"
            />

            <div className="sm:col-span-2 lg:col-span-3">
              {renderListaArquivos(
                ultima?.evidencias_execucao?.length ? ultima.evidencias_execucao : item.evidencias_execucao,
                "Evidências da execução"
              )}
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span className="w-2 h-6 bg-slate-400 rounded-full inline-block"></span>
            Histórico
          </h2>

          {historico.length === 0 ? (
            <div className="text-center py-6 text-slate-500 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Nenhum histórico registrado.
            </div>
          ) : (
            <ul className="space-y-4">
              {historico.map((h) => (
                <li key={h.id} className="rounded-xl border border-slate-200 p-5 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                    <span className="font-bold text-slate-800 uppercase tracking-wide">{h.acao || "-"}</span>
                    <span className="text-sm font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
                      {fmtDataHora(h.created_at)}
                    </span>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                    <Item titulo="Status aplicado" valor={h.status_aplicado || "-"} />
                    <Item titulo="Atualizado por" valor={h.realizado_por_nome || "-"} />
                    <Item titulo="Quem vai realizar" valor={h.quem_vai_realizar || "-"} />
                    <Item
                      titulo="Valor gasto"
                      valor={
                        h.valor_gasto != null
                          ? Number(h.valor_gasto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                          : "-"
                      }
                    />
                    <Item
                      titulo="Comentários"
                      valor={h.comentarios_estrutura || "-"}
                      className="sm:col-span-2 lg:col-span-4"
                    />
                    <div className="sm:col-span-2 lg:col-span-4">
                      {renderListaArquivos(h.evidencias_execucao, "Evidências")}
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Item({ titulo, valor, className = "" }) {
  return (
    <div className={className}>
      <dt className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{titulo}</dt>
      <dd className="text-sm font-semibold text-slate-800 whitespace-pre-wrap">{valor}</dd>
    </div>
  );
}
