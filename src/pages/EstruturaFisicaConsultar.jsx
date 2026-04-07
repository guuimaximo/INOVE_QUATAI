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
      <div className="mt-2">
        <span className="block text-sm text-gray-600 mb-2">{label}</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {arr.map((u, i) => {
            const pdf = isPdf(u);
            const img = !pdf && isImageUrl(u);

            return (
              <a
                key={`${u}-${i}`}
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border bg-white p-2 hover:shadow-sm"
              >
                {img ? (
                  <img
                    src={u}
                    alt={fileNameFromUrl(u)}
                    className="h-24 w-full object-cover rounded"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-24 flex items-center justify-center text-sm font-semibold text-gray-600">
                    {pdf ? "PDF" : "ARQ"}
                  </div>
                )}
                <div className="mt-2 text-xs text-blue-700 underline break-words">
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

  if (!item) return <div className="p-6">Carregando...</div>;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Consultar</h1>
        {!["CONCLUIDO", "CANCELADO"].includes(item.status) && (
          <button
            onClick={() => nav(`/estrutura-fisica/tratar/${id}`)}
            className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
          >
            Editar
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Detalhes da Solicitação</h2>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Item titulo="Nº Pedido" valor={item.numero_pedido || "-"} />
          <Item titulo="Nome do solicitante" valor={item.nome_solicitante || "-"} />
          <Item
            titulo="Data da solicitação"
            valor={
              item.data_solicitacao
                ? new Date(`${item.data_solicitacao}T00:00:00`).toLocaleDateString("pt-BR")
                : "-"
            }
          />
          <Item titulo="Setor" valor={item.setor || "-"} />
          <Item titulo="Responsável da área" valor={item.responsavel_area || "-"} />
          <Item titulo="Prioridade" valor={item.prioridade || "-"} />
          <Item titulo="Status" valor={item.status || "-"} />
          <Item
            titulo="Prazo estimado"
            valor={
              item.prazo_estimado
                ? new Date(`${item.prazo_estimado}T00:00:00`).toLocaleDateString("pt-BR")
                : "-"
            }
          />

          <Item
            titulo="Justificativa do impacto"
            valor={item.justificativa_impacto || "-"}
            className="md:col-span-2"
          />

          <Item
            titulo="Descrição da demanda"
            valor={item.descricao_demanda || "-"}
            className="md:col-span-2"
          />

          <div className="md:col-span-2">
            {renderListaArquivos(item.evidencias_abertura, "Evidências da abertura")}
          </div>
        </dl>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Última atualização</h2>
          <span className="text-sm opacity-80">{fmtDataHora(ultima?.created_at)}</span>
        </div>

        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Item titulo="Ação" valor={ultima?.acao || "-"} />
          <Item titulo="Status aplicado" valor={ultima?.status_aplicado || item?.status || "-"} />
          <Item titulo="Quem vai realizar" valor={ultima?.quem_vai_realizar || item?.quem_vai_realizar || "-"} />
          <Item
            titulo="Valor gasto"
            valor={
              ultima?.valor_gasto != null
                ? Number(ultima.valor_gasto).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })
                : item?.valor_gasto != null
                ? Number(item.valor_gasto).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })
                : "-"
            }
          />
          <Item
            titulo="Atualizado por"
            valor={ultima?.realizado_por_nome || item?.concluido_por_nome || item?.cancelado_por_nome || "-"}
          />
          <Item
            titulo="Comentários"
            valor={ultima?.comentarios_estrutura || item?.comentarios_estrutura || "-"}
            className="md:col-span-2"
          />

          <div className="md:col-span-2">
            {renderListaArquivos(
              ultima?.evidencias_execucao?.length
                ? ultima.evidencias_execucao
                : item.evidencias_execucao,
              "Evidências da execução"
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="font-semibold mb-3">Histórico</h2>

        {historico.length === 0 ? (
          <div className="text-gray-500">Sem histórico.</div>
        ) : (
          <ul className="space-y-3">
            {historico.map((h) => (
              <li key={h.id} className="rounded border p-3">
                <div className="text-sm text-gray-600">{fmtDataHora(h.created_at)}</div>
                <div className="font-medium">{h.acao || "-"}</div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  <Item titulo="Status aplicado" valor={h.status_aplicado || "-"} />
                  <Item titulo="Atualizado por" valor={h.realizado_por_nome || "-"} />
                  <Item titulo="Quem vai realizar" valor={h.quem_vai_realizar || "-"} />
                  <Item
                    titulo="Valor gasto"
                    valor={
                      h.valor_gasto != null
                        ? Number(h.valor_gasto).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })
                        : "-"
                    }
                  />
                  <Item
                    titulo="Comentários"
                    valor={h.comentarios_estrutura || "-"}
                    className="md:col-span-2"
                  />
                  <div className="md:col-span-2">
                    {renderListaArquivos(h.evidencias_execucao, "Evidências")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Item({ titulo, valor, className = "" }) {
  return (
    <div className={className}>
      <dt className="text-sm text-gray-500">{titulo}</dt>
      <dd className="font-medium whitespace-pre-wrap">{valor}</dd>
    </div>
  );
}
