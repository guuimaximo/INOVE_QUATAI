import { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaCheckCircle, FaClipboardList, FaExternalLinkAlt, FaPaperclip, FaPlus, FaSearch, FaTimesCircle } from "react-icons/fa";
import { supabase } from "../../supabase";
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

function FileList({ urls = [] }) {
  const list = Array.isArray(urls) ? urls : [];
  if (!list.length) return <span className="text-sm text-slate-400">Sem anexos.</span>;
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {list.map((url, index) => (
        <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">
          <FaPaperclip /> Evidencia {index + 1} <FaExternalLinkAlt className="ml-auto text-xs" />
        </a>
      ))}
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
              <div className="mt-3"><FileList urls={row.evidencias_urls} /></div>
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
                    <div className="mt-3"><FileList urls={mov.anexos_urls} /></div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-slate-200 p-5">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Concluir</h3>
              <textarea rows={4} value={conclusao} onChange={(e) => setConclusao(e.target.value)} className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-emerald-400" placeholder="Conclusao do atendimento." />
              <button type="button" onClick={() => atualizarStatus("Concluido")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700">
                <FaCheckCircle /> Concluir SAC
              </button>
            </section>
            <section className="rounded-3xl border border-slate-200 p-5">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Cancelar</h3>
              <textarea rows={4} value={canceladoMotivo} onChange={(e) => setCanceladoMotivo(e.target.value)} className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-rose-400" placeholder="Motivo do cancelamento." />
              <button type="button" onClick={() => atualizarStatus("Cancelado")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-700">
                <FaTimesCircle /> Cancelar SAC
              </button>
            </section>
          </aside>
        </div>
      </div>
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
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("Todos");
  const [selected, setSelected] = useState(null);

  async function carregar() {
    setLoading(true);
    try {
      let q = supabase.from("sac_atendimentos").select("*").order("created_at", { ascending: false }).limit(300);
      if (status !== "Todos") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      setRows(data || []);
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
      ["Total", total],
      ["Registrado", rows.filter((r) => r.status === "Registrado").length],
      ["Em tratativa", rows.filter((r) => r.status === "Em tratativa").length],
      ["Concluido", rows.filter((r) => r.status === "Concluido").length],
      ["Cancelado", rows.filter((r) => r.status === "Cancelado").length],
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
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-black uppercase text-slate-400">{label}</div>
            <div className="mt-2 text-3xl font-black text-slate-900">{value}</div>
          </div>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtrados.map((row) => (
                <tr key={row.id} onClick={() => setSelected(row)} className="cursor-pointer hover:bg-blue-50/50">
                  <td className="px-4 py-3 font-black text-blue-700">{row.protocolo}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800">{safeText(row.cliente_nome)}</div>
                    <div className="text-xs text-slate-500">{safeText(row.cliente_telefone)}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{safeText(row.carro_prefixo)} • {safeText(row.linha)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{row.grupo_motivo} / {safeText(row.subgrupo_motivo)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{formatDateBR(row.data_atendimento)} {formatTimeBR(row.hora_atendimento)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone(row.status)}`}>{row.status}</span></td>
                </tr>
              ))}
              {filtrados.length === 0 && !loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm font-bold text-slate-400">Nenhum atendimento encontrado.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? <SacModal row={selected} onClose={() => setSelected(null)} onReload={carregar} /> : null}
    </div>
  );
}
