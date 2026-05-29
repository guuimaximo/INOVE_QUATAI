import { useContext, useEffect, useMemo, useState } from "react";
import {
  FaCamera,
  FaCheckCircle,
  FaClipboardList,
  FaCopy,
  FaEye,
  FaPlus,
  FaSearch,
  FaTimesCircle,
  FaTrash,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";
import {
  ACIDENTE_STATUS,
  copyToClipboard,
  formatDateBR,
  formatTimeBR,
  pickUserAudit,
  safeText,
  statusTone,
  uploadAcidenteFiles,
} from "./AcidentesCommon";

function Card({ title, value, tone = "slate" }) {
  const tones = {
    slate: "from-slate-50 to-gray-50 border-slate-200 text-slate-700",
    amber: "from-amber-50 to-yellow-50 border-amber-200 text-amber-700",
    blue: "from-blue-50 to-cyan-50 border-blue-200 text-blue-700",
    emerald: "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700",
    rose: "from-rose-50 to-pink-50 border-rose-200 text-rose-700",
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-5 shadow-sm ${tones[tone]}`}>
      <div className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{title}</div>
      <div className="mt-3 text-3xl font-black text-slate-900">{value}</div>
    </div>
  );
}

function FileList({ urls = [] }) {
  const list = Array.isArray(urls) ? urls : [];
  if (!list.length) return <div className="text-sm font-semibold text-slate-400">Sem anexos.</div>;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {list.map((url, idx) => (
        <a key={`${url}-${idx}`} href={url} target="_blank" rel="noreferrer" className="truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50">
          Anexo {idx + 1}
        </a>
      ))}
    </div>
  );
}

function AcidenteModal({ row, onClose, onChanged }) {
  const { user } = useContext(AuthContext);
  const [tratativas, setTratativas] = useState([]);
  const [descricao, setDescricao] = useState("");
  const [files, setFiles] = useState([]);
  const [parecer, setParecer] = useState(row?.parecer_final || "");
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row?.id) return;
    supabase
      .from("acidentes_tratativas")
      .select("*")
      .eq("acidente_id", row.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setTratativas(data || []));
  }, [row?.id]);

  if (!row) return null;

  async function adicionarTratativa() {
    if (!descricao.trim()) return alert("Descreva a tratativa.");
    setSaving(true);
    try {
      const urls = await uploadAcidenteFiles(files, `${row.id}/tratativas`);
      const { error } = await supabase.from("acidentes_tratativas").insert({
        acidente_id: row.id,
        descricao,
        evidencias_urls: urls,
        ...pickUserAudit(user),
      });
      if (error) throw error;
      setDescricao("");
      setFiles([]);
      const { data } = await supabase.from("acidentes_tratativas").select("*").eq("acidente_id", row.id).order("created_at", { ascending: false });
      setTratativas(data || []);
    } catch (error) {
      alert(`Erro ao salvar tratativa: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  async function concluir() {
    if (!parecer.trim()) return alert("Informe o parecer final.");
    const { error } = await supabase
      .from("acidentes_ocorrencias")
      .update({ status: "Concluido", parecer_final: parecer, concluido_em: new Date().toISOString() })
      .eq("id", row.id);
    if (error) return alert(error.message);
    onChanged();
    onClose();
  }

  async function cancelar() {
    if (!cancelMotivo.trim()) return alert("Informe o motivo do cancelamento.");
    const { error } = await supabase
      .from("acidentes_ocorrencias")
      .update({ status: "Cancelado", cancelado_motivo: cancelMotivo, cancelado_em: new Date().toISOString() })
      .eq("id", row.id);
    if (error) return alert(error.message);
    onChanged();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 p-5">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">Ocorrência #{row.numero_ocorrencia}</div>
            <h2 className="mt-2 text-2xl font-black text-slate-900">{row.prefixo} - {row.linha || "Sem linha"}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{formatDateBR(row.data_ocorrencia)} às {formatTimeBR(row.hora_ocorrencia)} · {row.local}</p>
          </div>
          <button onClick={onClose} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-black text-slate-700">Fechar</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-slate-200 p-4 lg:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone(row.status)}`}>{row.status}</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700">{row.situacao_operacional}</span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <Info label="Motorista" value={`${safeText(row.motorista_chapa)} - ${safeText(row.motorista_nome)}`} />
                <Info label="Terceiro" value={`${safeText(row.veiculo_terceiro)} · ${safeText(row.placa_terceiro)}`} />
                <Info label="Condutor" value={row.condutor_terceiro} />
                <Info label="Tipo" value={row.tipo_acidente} />
              </div>
              <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm font-semibold leading-relaxed text-slate-700">
                {row.descricao}
              </div>
              <div className="mt-4">
                <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Evidências iniciais</div>
                <FileList urls={row.evidencias_urls} />
              </div>
              {row.mensagem_whatsapp ? (
                <button onClick={() => copyToClipboard(row.mensagem_whatsapp).then(() => alert("Mensagem copiada."))} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-3 text-sm font-black text-white">
                  <FaCopy /> Copiar WhatsApp
                </button>
              ) : null}
            </section>

            <section className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Imagens</h3>
              <div className="mt-3 space-y-2 text-sm font-semibold text-slate-600">
                <div>Confirmam: {safeText(row.imagens_confirmam_ocorrencia)}</div>
                <div>Responsabilidade: {safeText(row.imagens_responsabilidade)}</div>
                <div>Observação: {safeText(row.imagens_observacao)}</div>
              </div>
              <div className="mt-4">
                <FileList urls={row.imagens_urls} />
              </div>
            </section>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Nova tratativa</h3>
              <textarea rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none focus:border-blue-400" placeholder="Contato com terceiro, orientação, encaminhamento..." />
              <input type="file" multiple accept="image/*,video/*,application/pdf" onChange={(e) => setFiles(Array.from(e.target.files || []))} className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm" />
              <button disabled={saving} onClick={adicionarTratativa} className="mt-3 rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:bg-slate-400">
                Adicionar tratativa
              </button>
            </section>

            <section className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Encerramento</h3>
              <textarea rows={3} value={parecer} onChange={(e) => setParecer(e.target.value)} className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none focus:border-emerald-400" placeholder="Parecer final para concluir..." />
              <button onClick={concluir} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white">
                <FaCheckCircle /> Concluir
              </button>
              <textarea rows={2} value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)} className="mt-4 w-full rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold outline-none focus:border-rose-400" placeholder="Motivo para cancelar..." />
              <button onClick={cancelar} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-3 text-sm font-black text-white">
                <FaTimesCircle /> Cancelar
              </button>
            </section>
          </div>

          <section className="mt-5 rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Histórico de tratativas</h3>
            <div className="mt-3 space-y-3">
              {tratativas.length === 0 ? <div className="text-sm text-slate-400">Nenhuma tratativa registrada.</div> : tratativas.map((t) => (
                <div key={t.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">{new Date(t.created_at).toLocaleString("pt-BR")} · {safeText(t.criado_por_nome)}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-700">{t.descricao}</div>
                  <div className="mt-2"><FileList urls={t.evidencias_urls} /></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-black text-slate-800">{safeText(value)}</div>
    </div>
  );
}

export default function AcidentesCentral() {
  const { user } = useContext(AuthContext);
  const isAdmin = String(user?.nivel || "").trim().toLowerCase() === "administrador";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(null);

  async function excluirAcidente(row) {
    if (!isAdmin) return;
    const label = row?.numero_ocorrencia || row?.prefixo || "este acidente";
    if (!window.confirm(`Excluir o acidente #${label}? Esta acao nao pode ser desfeita.`)) return;
    const { error } = await supabase.from("acidentes_ocorrencias").delete().eq("id", row.id);
    if (error) {
      console.error("Erro ao excluir acidente:", error);
      window.alert(`Nao foi possivel excluir: ${error.message || error}`);
      return;
    }
    if (selected?.id === row.id) setSelected(null);
    await carregar();
  }

  async function carregar() {
    setLoading(true);
    let query = supabase.from("acidentes_ocorrencias").select("*").order("data_ocorrencia", { ascending: false }).order("hora_ocorrencia", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.numero_ocorrencia, r.prefixo, r.linha, r.motorista_chapa, r.motorista_nome, r.local, r.placa_terceiro, r.veiculo_terceiro, r.descricao]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [busca, rows]);

  const counts = useMemo(() => {
    const base = rows || [];
    return {
      total: base.length,
      imagens: base.filter((r) => r.status === "Aguardando imagens").length,
      aberto: base.filter((r) => r.status === "Em aberto").length,
      concluido: base.filter((r) => r.status === "Concluido").length,
      cancelado: base.filter((r) => r.status === "Cancelado").length,
    };
  }, [rows]);

  return (
    <div className="min-h-screen space-y-5 bg-slate-50 p-4 text-slate-800 md:p-6">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">Acidentes</div>
          <h1 className="mt-3 flex items-center gap-3 text-3xl font-black text-slate-900">
            <span className="rounded-lg bg-blue-50 p-3 text-blue-600"><FaClipboardList /></span>
            Central de Acidentes
          </h1>
          <p className="mt-2 text-sm text-slate-600">Tratativas, imagens e encerramento das ocorrências.</p>
        </div>
        <Link to="/acidentes/lancamento" className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700">
          <FaPlus /> Nova ocorrência
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card title="Total" value={counts.total} />
        <Card title="Aguardando imagens" value={counts.imagens} tone="amber" />
        <Card title="Em aberto" value={counts.aberto} tone="blue" />
        <Card title="Concluídas" value={counts.concluido} tone="emerald" />
        <Card title="Canceladas" value={counts.cancelado} tone="rose" />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row">
        <div className="flex min-w-[240px] flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-3">
          <FaSearch className="mr-2 text-slate-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar prefixo, motorista, placa, local..." className="flex-1 bg-transparent py-3 text-sm font-semibold outline-none" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700">
          <option value="">Todos os status</option>
          {ACIDENTE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-left">
          <thead className="border-b bg-slate-50 text-xs font-black uppercase tracking-[0.18em] text-slate-600">
            <tr>
              <th className="p-4">Ocorrência</th>
              <th className="p-4">Data/Hora</th>
              <th className="p-4">Prefixo/Linha</th>
              <th className="p-4">Motorista</th>
              <th className="p-4">Terceiro</th>
              <th className="p-4">Status</th>
              <th className="p-4">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-400">Carregando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-400">Nenhum acidente encontrado.</td></tr>
            ) : filtrados.map((r) => (
              <tr key={r.id} onClick={() => setSelected(r)} className="cursor-pointer hover:bg-blue-50/40">
                <td className="p-4 font-black text-slate-900">#{r.numero_ocorrencia}</td>
                <td className="p-4 text-sm font-semibold text-slate-600">{formatDateBR(r.data_ocorrencia)}<br />{formatTimeBR(r.hora_ocorrencia)}</td>
                <td className="p-4"><div className="font-black">{r.prefixo}</div><div className="text-xs text-slate-500">{r.linha || "-"}</div></td>
                <td className="p-4"><div className="font-black">{r.motorista_nome || "-"}</div><div className="text-xs text-slate-500">{r.motorista_chapa || "-"}</div></td>
                <td className="p-4"><div className="font-semibold">{r.veiculo_terceiro || "-"}</div><div className="text-xs text-slate-500">{r.placa_terceiro || "-"}</div></td>
                <td className="p-4"><span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone(r.status)}`}>{r.status}</span></td>
                <td className="p-4">
                  <div className="flex gap-2">
                    {r.status === "Aguardando imagens" ? <Link onClick={(e) => e.stopPropagation()} to="/acidentes/imagens" className="rounded-lg bg-amber-100 p-2 text-amber-700"><FaCamera /></Link> : null}
                    <button onClick={(e) => { e.stopPropagation(); setSelected(r); }} className="rounded-lg bg-blue-600 p-2 text-white" title="Detalhes"><FaEye /></button>
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); excluirAcidente(r); }}
                        className="rounded-lg bg-rose-100 p-2 text-rose-700 hover:bg-rose-200"
                        title="Excluir (Administrador)"
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AcidenteModal row={selected} onClose={() => setSelected(null)} onChanged={carregar} />
    </div>
  );
}

