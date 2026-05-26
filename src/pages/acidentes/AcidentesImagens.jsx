import { useContext, useEffect, useMemo, useState } from "react";
import { FaCamera, FaCheckCircle, FaSearch, FaUpload } from "react-icons/fa";
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";
import { formatDateBR, formatTimeBR, safeText, statusTone, uploadAcidenteFiles } from "./AcidentesCommon";

function FileList({ urls = [] }) {
  const list = Array.isArray(urls) ? urls : [];
  if (!list.length) return <div className="text-sm font-semibold text-slate-400">Sem anexos.</div>;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {list.map((url, idx) => (
        <a key={`${url}-${idx}`} href={url} target="_blank" rel="noreferrer" className="truncate rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50">
          Anexo {idx + 1}
        </a>
      ))}
    </div>
  );
}

function ImagemAnaliseModal({ row, onClose, onSaved }) {
  const { user } = useContext(AuthContext);
  const [form, setForm] = useState({
    imagens_confirmam_ocorrencia: row?.imagens_confirmam_ocorrencia || "Inconclusivo",
    imagens_responsabilidade: row?.imagens_responsabilidade || "Inconclusivo",
    imagens_observacao: row?.imagens_observacao || "",
  });
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  if (!row) return null;

  async function salvar() {
    setSaving(true);
    try {
      const novasUrls = await uploadAcidenteFiles(files, `${row.id}/imagens`);
      const imagens_urls = [...(Array.isArray(row.imagens_urls) ? row.imagens_urls : []), ...novasUrls];
      const { error } = await supabase
        .from("acidentes_ocorrencias")
        .update({
          ...form,
          imagens_urls,
          imagens_analisadas_em: new Date().toISOString(),
          imagens_analisadas_por: user?.nome || user?.email || "Sistema",
          status: "Em aberto",
        })
        .eq("id", row.id);
      if (error) throw error;
      alert("Análise de imagens salva. Status alterado para Em aberto.");
      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      alert(`Erro ao salvar análise: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 p-5">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">Análise de imagens</div>
            <h2 className="mt-2 text-2xl font-black text-slate-900">Ocorrência #{row.numero_ocorrencia}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{row.prefixo} · {formatDateBR(row.data_ocorrencia)} às {formatTimeBR(row.hora_ocorrencia)}</p>
          </div>
          <button onClick={onClose} className="rounded-2xl bg-slate-200 px-4 py-2 text-sm font-black text-slate-700">Fechar</button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-relaxed text-slate-700">
            <div className="font-black text-slate-900">{row.local}</div>
            <div className="mt-2">{row.descricao}</div>
          </div>

          <div>
            <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Evidências do lançamento</div>
            <FileList urls={row.evidencias_urls} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-600">Imagem confirma ocorrência?</label>
              <select value={form.imagens_confirmam_ocorrencia} onChange={(e) => setForm({ ...form, imagens_confirmam_ocorrencia: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-blue-400">
                <option>Sim</option>
                <option>Não</option>
                <option>Inconclusivo</option>
                <option>Sem imagem disponível</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-600">Responsabilidade aparente</label>
              <select value={form.imagens_responsabilidade} onChange={(e) => setForm({ ...form, imagens_responsabilidade: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-blue-400">
                <option>Terceiro</option>
                <option>Empresa</option>
                <option>Motorista</option>
                <option>Inconclusivo</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-600">Observação da Ouvidoria</label>
              <textarea rows={4} value={form.imagens_observacao} onChange={(e) => setForm({ ...form, imagens_observacao: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none focus:border-blue-400" />
            </div>
            <div className="md:col-span-2">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center hover:border-blue-300 hover:bg-blue-50/40">
                <FaUpload className="mb-2 text-2xl text-slate-400" />
                <span className="text-sm font-black text-slate-700">Anexar imagens da câmera</span>
                <span className="mt-1 text-xs text-slate-500">{files.length ? `${files.length} arquivo(s) selecionado(s)` : "Fotos, vídeos ou PDF"}</span>
                <input type="file" multiple accept="image/*,video/*,application/pdf" className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
              </label>
            </div>
          </div>

          <button disabled={saving} onClick={salvar} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-400">
            <FaCheckCircle /> {saving ? "Salvando..." : "Salvar análise e liberar para tratativa"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AcidentesImagens() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [selected, setSelected] = useState(null);

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("acidentes_ocorrencias")
      .select("*")
      .eq("status", "Aguardando imagens")
      .order("data_ocorrencia", { ascending: false })
      .order("hora_ocorrencia", { ascending: false });
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
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.prefixo, r.linha, r.motorista_nome, r.motorista_chapa, r.local, r.numero_ocorrencia, r.descricao]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [busca, rows]);

  return (
    <div className="min-h-screen space-y-5 bg-slate-50 p-4 text-slate-800 md:p-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">Acidentes</div>
        <h1 className="mt-3 flex items-center gap-3 text-3xl font-black text-slate-900">
          <span className="rounded-2xl bg-blue-50 p-3 text-blue-600"><FaCamera /></span>
          Imagens de Acidentes
        </h1>
        <p className="mt-2 text-sm text-slate-600">Ocorrências aguardando verificação das imagens de câmera.</p>
      </div>

      <div className="flex items-center rounded-3xl border border-slate-200 bg-white px-4 shadow-sm">
        <FaSearch className="mr-3 text-slate-400" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar prefixo, motorista, local..." className="flex-1 bg-transparent py-4 text-sm font-semibold outline-none" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-400">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-400">Nenhuma ocorrência aguardando imagens.</div>
        ) : filtrados.map((row) => (
          <button key={row.id} onClick={() => setSelected(row)} className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50/30">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-slate-400">Ocorrência #{row.numero_ocorrencia}</div>
                <div className="mt-2 text-xl font-black text-slate-900">{row.prefixo} · {row.linha || "Sem linha"}</div>
                <div className="mt-1 text-sm font-semibold text-slate-500">{formatDateBR(row.data_ocorrencia)} às {formatTimeBR(row.hora_ocorrencia)}</div>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone(row.status)}`}>{row.status}</span>
            </div>
            <div className="mt-4 text-sm font-semibold text-slate-700">{safeText(row.local)}</div>
            <div className="mt-2 line-clamp-2 text-sm text-slate-500">{safeText(row.descricao)}</div>
            <div className="mt-4 text-xs font-black uppercase tracking-wide text-blue-700">Abrir análise de imagens</div>
          </button>
        ))}
      </div>

      <ImagemAnaliseModal row={selected} onClose={() => setSelected(null)} onSaved={carregar} />
    </div>
  );
}

