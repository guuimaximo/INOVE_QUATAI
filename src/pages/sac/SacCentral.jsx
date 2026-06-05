import { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaCheckCircle, FaClipboardList, FaFilePdf, FaPaperclip, FaPlay, FaPlus, FaSearch, FaTimesCircle } from "react-icons/fa";
import MediaPreviewModal from "../../components/MediaPreviewModal";
import { supabase } from "../../supabase";
import { InoveStatCard } from "../../components/InovePage";
import { AuthContext } from "../../context/AuthContext";
import {
  SAC_STATUS,
  formatDateBR,
  formatTimeBR,
  pickMovementUser,
  safeText,
  statusTone,
  uploadSacFiles,
} from "./SacCommon";

function detectMediaKind(url = "") {
  const u = String(url).toLowerCase();
  if (/\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/.test(u)) return "video";
  if (/\.pdf(\?|#|$)/.test(u)) return "pdf";
  if (/\.(jpe?g|png|gif|webp|bmp|heic|heif|avif)(\?|#|$)/.test(u)) return "image";
  return "other";
}

function FileList({ urls = [], onOpen }) {
  const list = Array.isArray(urls) ? urls : [];
  if (!list.length) return <span className="text-sm text-slate-400">Sem anexos.</span>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {list.map((url, index) => {
        const kind = detectMediaKind(url);
        return (
          <button
            key={`${url}-${index}`}
            type="button"
            onClick={() => onOpen?.({ url, title: `Evidencia ${index + 1}` })}
            className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm transition hover:border-blue-400 hover:shadow-md"
            title={`Abrir Evidencia ${index + 1}`}
          >
            {kind === "image" ? (
              <img src={url} alt={`Evidencia ${index + 1}`} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
            ) : kind === "video" ? (
              <>
                <video src={url} className="h-full w-full object-cover" preload="metadata" muted playsInline />
                <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                  <FaPlay className="text-3xl drop-shadow-md" />
                </span>
              </>
            ) : kind === "pdf" ? (
              <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-rose-600">
                <FaFilePdf className="text-3xl" />
                <span className="text-xs font-bold">PDF</span>
              </span>
            ) : (
              <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-600">
                <FaPaperclip className="text-2xl" />
                <span className="text-xs font-bold">Anexo</span>
              </span>
            )}
            <span className="absolute bottom-1 left-1 right-1 truncate rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">
              Evidencia {index + 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SacModal({ row, onClose, onReload }) {
  const { user } = useContext(AuthContext);
  const [movs, setMovs] = useState([]);
  const [descricao, setDescricao] = useState("");
  const [files, setFiles] = useState([]);
  const [conclusao, setConclusao] = useState(row?.conclusao || "");
  const [canceladoMotivo, setCanceladoMotivo] = useState(row?.cancelado_motivo || "");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!row?.id) return;
    supabase
      .from("sac_movimentacoes")
      .select("*")
      .eq("sac_id", row.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setMovs(data || []));
  }, [row?.id]);

  async function adicionarMovimentacao() {
    if (!descricao.trim()) {
      alert("Descreva a movimentacao.");
      return;
    }
    setSaving(true);
    try {
      const anexos_urls = await uploadSacFiles(files, `${row.id}/movimentacoes`);
      const { error } = await supabase.from("sac_movimentacoes").insert({
        sac_id: row.id,
        tipo: "Tratativa",
        descricao,
        anexos_urls,
        ...pickMovementUser(user),
      });
      if (error) throw error;
      // legado: SACs antigos com status "Registrado" sobem pra "Em tratativa" ao receber 1ª movimentação
      if (row.status === "Registrado") {
        await supabase.from("sac_atendimentos").update({ status: "Em tratativa" }).eq("id", row.id);
      }
      const { data } = await supabase
        .from("sac_movimentacoes")
        .select("*")
        .eq("sac_id", row.id)
        .order("created_at", { ascending: false });
      setMovs(data || []);
      setDescricao("");
      setFiles([]);
      onReload?.();
    } catch (error) {
      console.error(error);
      alert(`Erro ao salvar movimentacao: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  async function atualizarStatus(status) {
    const payload = { status };
    if (status === "Concluido") {
      if (!conclusao.trim()) return alert("Informe a conclusao.");
      payload.conclusao = conclusao;
      payload.concluido_em = new Date().toISOString();
    }
    if (status === "Cancelado") {
      if (!canceladoMotivo.trim()) return alert("Informe o motivo do cancelamento.");
      payload.cancelado_motivo = canceladoMotivo;
      payload.cancelado_em = new Date().toISOString();
    }
    const { error } = await supabase.from("sac_atendimentos").update(payload).eq("id", row.id);
    if (error) {
      alert(`Erro ao atualizar status: ${error.message}`);
      return;
    }
    onReload?.();
    onClose?.();
  }

  if (!row) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">SAC</div>
            <h2 className="text-2xl font-black text-slate-900">{row.protocolo}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-200">
            Fechar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <section className="rounded-3xl border border-slate-200 p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone(row.status)}`}>{row.status}</span>
                {row.tratativa_id ? (
                  <Link to={`/tratar/${row.tratativa_id}`} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">
                    Tratativa vinculada
                  </Link>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Info label="Atendimento" value={`${formatDateBR(row.data_atendimento)} ${formatTimeBR(row.hora_atendimento)}`} />
                <Info label="Origem" value={row.origem} />
                <Info label="Atendente" value={row.atendente_nome || row.atendente_login} />
                <Info label="Cliente" value={row.cliente_nome} />
                <Info label="Telefone" value={row.cliente_telefone} />
                <Info label="Motivo" value={`${row.grupo_motivo} / ${row.subgrupo_motivo || "-"}`} />
                <Info label="Veiculo" value={row.carro_prefixo} />
                <Info label="Linha" value={row.linha} />
                <Info label="Operador" value={[row.operador_chapa, row.operador_nome].filter(Boolean).join(" - ")} />
              </div>
              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-black uppercase text-slate-400">Detalhamento</div>
                <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-700">{row.detalhamento}</p>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 p-5">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Evidencias</h3>
              <div className="mt-3"><FileList urls={row.evidencias_urls} onOpen={setPreview} /></div>
            </section>

            <section className="rounded-3xl border border-slate-200 p-5">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Nova movimentacao</h3>
              <textarea rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400" placeholder="Registre contato, retorno ao cliente, encaminhamento ou acao aplicada." />
              <input type="file" multiple accept="image/*,video/*,application/pdf" onChange={(e) => setFiles(Array.from(e.target.files || []))} className="mt-3 block w-full text-sm text-slate-600" />
              <button type="button" disabled={saving} onClick={adicionarMovimentacao} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-400">
                <FaPlus /> Adicionar movimentacao
              </button>
            </section>

            <section className="rounded-3xl border border-slate-200 p-5">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Historico</h3>
              <div className="mt-3 space-y-3">
                {movs.length === 0 ? <div className="text-sm text-slate-400">Nenhuma movimentacao registrada.</div> : movs.map((mov) => (
                  <div key={mov.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-500">
                      <span>{mov.criado_por_nome || mov.criado_por_login || "SAC"}</span>
                      <span>{new Date(mov.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-700">{mov.descricao}</p>
                    <div className="mt-3"><FileList urls={mov.anexos_urls} onOpen={setPreview} /></div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            {/* Em tratativa pela Operação — só aguarda, nada de concluir/cancelar */}
            {row.status === "Em tratativa" && (
              <section className="rounded-3xl border-2 border-amber-300 bg-amber-50/60 p-5">
                <div className="text-xs font-black uppercase tracking-wide text-amber-800 flex items-center gap-2">
                  ⏳ Aguardando Operação
                </div>
                <p className="mt-2 text-sm text-amber-800/90">
                  A Operação está tratando este caso. Quando a tratativa for concluída,
                  o SAC volta automaticamente como <b>"Aguardando retorno ao cliente"</b> e
                  você poderá concluir.
                </p>
                {row.tratativa_id ? (
                  <Link
                    to={`/tratar/${row.tratativa_id}`}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-xs font-black text-white hover:bg-amber-700"
                  >
                    Ver tratativa →
                  </Link>
                ) : null}
              </section>
            )}

            {/* Aguardando retorno ao cliente — abre as opções */}
            {row.status === "Aguardando resposta ao cliente" && (
              <>
                <section className="rounded-3xl border-2 border-rose-300 bg-rose-50/60 p-5">
                  <div className="text-xs font-black uppercase tracking-wide text-rose-700 flex items-center gap-1">
                    🔔 Aguardando retorno
                  </div>
                  <p className="mt-2 text-xs text-rose-700/80">
                    A Operação já tratou. Registre o retorno ao cliente e conclua o SAC.
                  </p>
                </section>
                <section className="rounded-3xl border border-emerald-200 bg-emerald-50/30 p-5">
                  <h3 className="text-sm font-black uppercase tracking-wide text-emerald-800 flex items-center gap-2">
                    <FaCheckCircle /> Concluir
                  </h3>
                  <textarea
                    rows={4}
                    value={conclusao}
                    onChange={(e) => setConclusao(e.target.value)}
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-emerald-400"
                    placeholder="Descreva o retorno dado ao cliente."
                  />
                  <button
                    type="button"
                    onClick={() => atualizarStatus("Concluido")}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700"
                  >
                    <FaCheckCircle /> Concluir e Retornar ao Cliente
                  </button>
                </section>
                <section className="rounded-3xl border border-rose-200 bg-white p-5">
                  <h3 className="text-sm font-black uppercase tracking-wide text-rose-700 flex items-center gap-2">
                    <FaTimesCircle /> Cancelar
                  </h3>
                  <textarea
                    rows={3}
                    value={canceladoMotivo}
                    onChange={(e) => setCanceladoMotivo(e.target.value)}
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-rose-400"
                    placeholder="Motivo do cancelamento."
                  />
                  <button
                    type="button"
                    onClick={() => atualizarStatus("Cancelado")}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white border-2 border-rose-300 text-rose-700 px-4 py-2.5 text-sm font-black hover:bg-rose-50"
                  >
                    <FaTimesCircle /> Cancelar SAC
                  </button>
                </section>
              </>
            )}

            {/* Já fechado */}
            {row.status === "Concluido" && (
              <section className="rounded-3xl border-2 border-emerald-300 bg-emerald-50/60 p-5">
                <div className="text-xs font-black uppercase tracking-wide text-emerald-700 flex items-center gap-2">
                  <FaCheckCircle /> Concluído
                </div>
                {row.conclusao ? (
                  <p className="mt-2 text-sm text-emerald-900 whitespace-pre-wrap">{row.conclusao}</p>
                ) : (
                  <p className="mt-2 text-xs text-emerald-700/80">Sem texto de conclusão registrado.</p>
                )}
                {row.concluido_em ? (
                  <p className="mt-2 text-[10px] text-emerald-700/70">Fechado em {new Date(row.concluido_em).toLocaleString("pt-BR")}</p>
                ) : null}
              </section>
            )}
            {row.status === "Cancelado" && (
              <section className="rounded-3xl border-2 border-slate-300 bg-slate-50 p-5">
                <div className="text-xs font-black uppercase tracking-wide text-slate-700 flex items-center gap-2">
                  <FaTimesCircle /> Cancelado
                </div>
                {row.cancelado_motivo ? (
                  <p className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">{row.cancelado_motivo}</p>
                ) : (
                  <p className="mt-2 text-xs text-slate-600">Sem motivo registrado.</p>
                )}
              </section>
            )}
          </aside>
        </div>
      </div>
      <MediaPreviewModal
        open={Boolean(preview?.url)}
        url={preview?.url}
        title={preview?.title || "Evidencia"}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs font-black uppercase text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-black text-slate-800">{safeText(value)}</div>
    </div>
  );
}

export default function SacCentral() {
  const { user } = useContext(AuthContext);
  const isAdmin = String(user?.nivel || "").trim().toLowerCase() === "administrador";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("Todos");
  const [selected, setSelected] = useState(null);

  async function excluirSac(row) {
    if (!isAdmin || !row?.id) return;
    const label = row?.protocolo || row?.cliente_nome || "este atendimento";
    if (!window.confirm(`Excluir o SAC "${label}"? Esta acao nao pode ser desfeita.`)) return;
    const { error } = await supabase.from("sac_atendimentos").delete().eq("id", row.id);
    if (error) {
      console.error("Erro ao excluir SAC:", error);
      window.alert(`Nao foi possivel excluir: ${error.message || error}`);
      return;
    }
    if (selected?.id === row.id) setSelected(null);
    await carregar();
  }

  async function carregar() {
    setLoading(true);
    try {
      let q = supabase.from("sac_atendimentos").select("*").order("created_at", { ascending: false }).limit(300);
      if (status !== "Todos") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      // Ordena por prioridade do fluxo: Aguardando resposta → Em tratativa → Concluido → Cancelado
      const peso = {
        "Aguardando resposta ao cliente": 0,
        "Em tratativa": 1,
        Concluido: 2,
        Cancelado: 3,
      };
      const ordenado = [...(data || [])].sort((a, b) => {
        const pa = peso[a.status] ?? 99;
        const pb = peso[b.status] ?? 99;
        if (pa !== pb) return pa - pb;
        return (b.created_at || "").localeCompare(a.created_at || "");
      });
      setRows(ordenado);
    } catch (error) {
      console.error(error);
      alert(`Erro ao carregar SAC: ${error?.message || error}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [status]);

  const filtrados = useMemo(() => {
    const term = busca.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [row.protocolo, row.cliente_nome, row.cliente_telefone, row.carro_prefixo, row.linha, row.operador_nome, row.operador_chapa, row.grupo_motivo, row.subgrupo_motivo]
        .some((v) => String(v || "").toLowerCase().includes(term))
    );
  }, [busca, rows]);

  const cards = useMemo(() => {
    const total = rows.length;
    return [
      { label: "Total", value: total, tone: "blue" },
      {
        label: "Aguardando retorno",
        value: rows.filter((r) => r.status === "Aguardando resposta ao cliente").length,
        tone: "rose",
      },
      { label: "Em tratativa", value: rows.filter((r) => r.status === "Em tratativa").length, tone: "amber" },
      { label: "Concluido", value: rows.filter((r) => r.status === "Concluido").length, tone: "emerald" },
      { label: "Cancelado", value: rows.filter((r) => r.status === "Cancelado").length, tone: "rose" },
    ];
  }, [rows]);

  return (
    <div className="min-h-screen space-y-5 bg-slate-50 p-4 text-slate-800 md:p-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">SAC</div>
            <h1 className="mt-3 flex items-center gap-3 text-3xl font-black text-slate-900">
              <span className="rounded-2xl bg-blue-50 p-3 text-blue-600"><FaClipboardList /></span>
              Central de atendimentos
            </h1>
          </div>
          <Link to="/sac/lancamento" className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700">
            Novo atendimento
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((c) => (
          <InoveStatCard key={c.label} title={c.label} value={c.value} tone={c.tone} />
        ))}
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar protocolo, cliente, telefone, veiculo, linha ou operador..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:border-blue-400" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold outline-none focus:border-blue-400">
            <option value="Todos">Todos os status</option>
            {SAC_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Protocolo</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Operacao</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Atendimento</th>
                <th className="px-4 py-3">Status</th>
                {isAdmin ? <th className="px-4 py-3 text-right">Acoes</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtrados.map((row) => {
                const aguardando = row.status === "Aguardando resposta ao cliente";
                return (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className={`cursor-pointer transition ${aguardando ? "bg-rose-50/70 hover:bg-rose-100/70 border-l-4 border-rose-500" : "hover:bg-blue-50/50"}`}
                >
                  <td className="px-4 py-3 font-black text-blue-700">
                    <div className="flex items-center gap-2">
                      {aguardando && <span className="text-rose-600" title="Aguardando retorno ao cliente">🔔</span>}
                      {row.protocolo}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800">{safeText(row.cliente_nome)}</div>
                    <div className="text-xs text-slate-500">{safeText(row.cliente_telefone)}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{safeText(row.carro_prefixo)} • {safeText(row.linha)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{row.grupo_motivo} / {safeText(row.subgrupo_motivo)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{formatDateBR(row.data_atendimento)} {formatTimeBR(row.hora_atendimento)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${aguardando ? "border-rose-300 bg-rose-100 text-rose-800" : statusTone(row.status)}`}>
                      {aguardando ? "AGUARDANDO RETORNO" : row.status}
                    </span>
                  </td>
                  {isAdmin ? (
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => excluirSac(row)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                        title="Excluir SAC (Administrador)"
                      >
                        <FaTimesCircle /> Excluir
                      </button>
                    </td>
                  ) : null}
                </tr>
                );
              })}
              {filtrados.length === 0 && !loading ? (
                <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-10 text-center text-sm font-bold text-slate-400">Nenhum atendimento encontrado.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? <SacModal row={selected} onClose={() => setSelected(null)} onReload={carregar} /> : null}
    </div>
  );
}
