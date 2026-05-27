import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaBoxOpen,
  FaBuilding,
  FaCheck,
  FaEdit,
  FaFlask,
  FaPlus,
  FaSearch,
  FaShieldAlt,
  FaTimes,
  FaTimesCircle,
  FaToggleOff,
  FaToggleOn,
  FaTruck,
} from "react-icons/fa";
import { supabase } from "../../supabase";
import { EmptyState, PageHero, Panel, StatusChip } from "./SuprimentosUI";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";
const textareaClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 resize-none";

function Field({ label, required = false, children, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-500">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

/* ─── FORNECEDOR MODAL ───────────────────────────────────────── */
function FornecedorModal({ initial = null, onClose, onSaved }) {
  const [form, setForm] = useState(
    initial || { nome: "", cnpj: "", telefone: "", telefone2: "", email: "", contato: "", uf: "", tipo_fornecedor: "", tipo: "", obs: "" }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setF(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.nome.trim()) { setError("Informe o nome do fornecedor."); return; }
    setSaving(true); setError("");
    const payload = {
      nome: form.nome.trim(),
      cnpj: form.cnpj || null,
      telefone: form.telefone || null,
      telefone2: form.telefone2 || null,
      email: form.email || null,
      contato: form.contato || null,
      uf: form.uf || null,
      tipo_fornecedor: form.tipo_fornecedor || null,
      tipo: form.tipo || null,
      obs: form.obs || null,
    };
    const op = initial?.id
      ? supabase.from("suprimentos_fornecedores").update(payload).eq("id", initial.id)
      : supabase.from("suprimentos_fornecedores").insert(payload);
    const { error: err } = await op;
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-600">Fornecedores</p>
            <h2 className="mt-0.5 text-lg font-black text-slate-900">{initial ? "Editar Fornecedor" : "Novo Fornecedor"}</h2>
          </div>
          <button onClick={onClose} className="rounded-2xl p-2 text-slate-400 hover:bg-slate-100"><FaTimes /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <Field label="Nome / Razão Social" required>
            <input className={inputClass} value={form.nome} onChange={(e) => setF("nome", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="CNPJ / CPF">
              <input className={inputClass} placeholder="00.000.000/0000-00" value={form.cnpj} onChange={(e) => setF("cnpj", e.target.value)} />
            </Field>
            <Field label="UF">
              <input className={inputClass} placeholder="ex.: RS" maxLength={2} value={form.uf} onChange={(e) => setF("uf", e.target.value.toUpperCase())} />
            </Field>
            <Field label="Telefone 1">
              <input className={inputClass} placeholder="(00) 00000-0000" value={form.telefone} onChange={(e) => setF("telefone", e.target.value)} />
            </Field>
            <Field label="Telefone 2">
              <input className={inputClass} placeholder="(00) 00000-0000" value={form.telefone2} onChange={(e) => setF("telefone2", e.target.value)} />
            </Field>
            <Field label="E-mail">
              <input className={inputClass} type="email" value={form.email} onChange={(e) => setF("email", e.target.value)} />
            </Field>
            <Field label="Contato (nome)">
              <input className={inputClass} value={form.contato} onChange={(e) => setF("contato", e.target.value)} />
            </Field>
            <Field label="Tipo de Fornecedor">
              <input className={inputClass} placeholder="ex.: Fabricante, Distribuidor…" value={form.tipo_fornecedor} onChange={(e) => setF("tipo_fornecedor", e.target.value)} />
            </Field>
            <Field label="Tipo">
              <input className={inputClass} placeholder="ex.: PJ, PF…" value={form.tipo} onChange={(e) => setF("tipo", e.target.value)} />
            </Field>
          </div>
          <Field label="Observações">
            <textarea rows={2} className={textareaClass} value={form.obs} onChange={(e) => setF("obs", e.target.value)} />
          </Field>
          {error && <p className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── PEÇA MODAL ─────────────────────────────────────────────── */
function PecaModal({ initial = null, onClose, onSaved }) {
  const [form, setForm] = useState(
    initial
      ? { ...initial, fornecedor_id: initial.fornecedor_id || "", fornecedor_nome: initial.suprimentos_fornecedores?.nome || "" }
      : { codigo: "", descricao: "", unidade_padrao: "un", fornecedor_id: "", fornecedor_nome: "", obs: "" }
  );
  const [fOptions, setFOptions] = useState([]);
  const [showFDrop, setShowFDrop] = useState(false);
  const fRef = useRef();
  const fDebounce = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setF(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function searchFornecedor(q) {
    if (!q.trim()) { setFOptions([]); return; }
    const { data } = await supabase
      .from("suprimentos_fornecedores")
      .select("id, nome")
      .ilike("nome", `%${q.trim()}%`)
      .eq("ativo", true)
      .order("nome")
      .limit(10);
    setFOptions(data || []);
  }

  useEffect(() => {
    function handler(e) { if (fRef.current && !fRef.current.contains(e.target)) setShowFDrop(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleSave() {
    if (!form.descricao.trim()) { setError("Informe a descrição da peça."); return; }
    setSaving(true); setError("");
    const payload = {
      codigo: form.codigo || null,
      descricao: form.descricao.trim(),
      unidade_padrao: form.unidade_padrao || "un",
      fornecedor_id: form.fornecedor_id || null,
      obs: form.obs || null,
    };
    const op = initial?.id
      ? supabase.from("suprimentos_pecas").update(payload).eq("id", initial.id)
      : supabase.from("suprimentos_pecas").insert(payload);
    const { error: err } = await op;
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-black text-slate-900">{initial ? "Editar Peça" : "Nova Peça"}</h2>
          <button onClick={onClose} className="rounded-2xl p-2 text-slate-400 hover:bg-slate-100"><FaTimes /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Código">
              <input className={inputClass} placeholder="ex.: 90210" value={form.codigo} onChange={(e) => setF("codigo", e.target.value)} />
            </Field>
            <Field label="Unidade">
              <input className={inputClass} placeholder="un / kg / L / m" value={form.unidade_padrao} onChange={(e) => setF("unidade_padrao", e.target.value)} />
            </Field>
          </div>
          <Field label="Descrição" required>
            <input className={inputClass} placeholder="Nome completo da peça" value={form.descricao} onChange={(e) => setF("descricao", e.target.value)} />
          </Field>
          <Field label="Fornecedor">
            <div ref={fRef} className="relative">
              <input
                className={inputClass}
                placeholder="Digite para buscar fornecedor…"
                value={form.fornecedor_nome}
                autoComplete="off"
                onChange={(e) => {
                  setF("fornecedor_nome", e.target.value);
                  setF("fornecedor_id", "");
                  setShowFDrop(true);
                  clearTimeout(fDebounce.current);
                  fDebounce.current = setTimeout(() => searchFornecedor(e.target.value), 300);
                }}
                onFocus={() => { if (fOptions.length > 0) setShowFDrop(true); }}
              />
              {form.fornecedor_id && (
                <button
                  type="button"
                  onClick={() => { setF("fornecedor_id", ""); setF("fornecedor_nome", ""); setFOptions([]); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
                >
                  <FaTimes />
                </button>
              )}
              {showFDrop && fOptions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                  {fOptions.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setF("fornecedor_id", f.id);
                        setF("fornecedor_nome", f.nome);
                        setShowFDrop(false);
                      }}
                      className="flex w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-blue-50 border-b border-slate-50 last:border-0"
                    >
                      {f.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>
          <Field label="Observações">
            <textarea rows={2} className={textareaClass} value={form.obs} onChange={(e) => setF("obs", e.target.value)} />
          </Field>
          {error && <p className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── FORNECEDORES TAB ───────────────────────────────────────── */
// Busca server-side: 75k registros — nunca carrega tudo de uma vez
const PAGE_SIZE = 50;

function FornecedoresTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const debounceRef = useRef(null);

  async function buscar(q) {
    setLoading(true);
    let query = supabase
      .from("suprimentos_fornecedores")
      .select("*")
      .order("nome")
      .limit(PAGE_SIZE);
    if (q.trim()) {
      query = query.or(`nome.ilike.%${q.trim()}%,cnpj.ilike.%${q.trim()}%`);
    }
    const { data } = await query;
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { buscar(""); }, []);

  function handleSearch(val) {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(val), 350);
  }

  async function toggleAtivo(f) {
    await supabase.from("suprimentos_fornecedores").update({ ativo: !f.ativo }).eq("id", f.id);
    buscar(search);
  }

  return (
    <div className="space-y-4">
      {/* barra topo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 min-w-[260px]">
          <FaSearch className="flex-shrink-0 text-slate-400 text-xs" />
          <input
            className="bg-transparent text-sm font-semibold text-slate-700 placeholder:text-slate-400 outline-none flex-1"
            placeholder="Buscar por nome ou CNPJ…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => { setSearch(""); buscar(""); }} className="text-slate-400 hover:text-slate-600">
              <FaTimesCircle />
            </button>
          )}
        </div>
        <button
          onClick={() => setModal({})}
          className="flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700"
        >
          <FaPlus /> Novo Fornecedor
        </button>
      </div>

      {/* hint */}
      {!search && (
        <p className="text-xs text-slate-400 font-semibold">
          Mostrando os primeiros {PAGE_SIZE} fornecedores. Use a busca para filtrar entre os{" "}
          <span className="font-black text-slate-600">75.834</span> cadastrados.
        </p>
      )}
      {search && !loading && (
        <p className="text-xs text-slate-400 font-semibold">
          {rows.length === PAGE_SIZE
            ? `Mostrando os primeiros ${PAGE_SIZE} resultados para "${search}".`
            : `${rows.length} resultado(s) para "${search}".`}
        </p>
      )}

      {/* tabela */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm font-semibold text-slate-400">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Buscando…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<FaBuilding />} title="Nenhum fornecedor encontrado" description={search ? "Tente outro termo de busca." : "Cadastre o primeiro fornecedor."} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-4 py-3 text-left">Nome / Razão Social</th>
                <th className="px-4 py-3 text-left">CNPJ / CPF</th>
                <th className="px-4 py-3 text-left">Telefone</th>
                <th className="px-4 py-3 text-left">Contato</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id} className="border-t border-slate-100 hover:bg-blue-50/30 transition">
                  <td className="px-4 py-3 font-bold text-slate-800">{f.nome}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{f.cnpj || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{f.telefone || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{f.contato || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusChip tone={f.ativo ? "emerald" : "slate"}>{f.ativo ? "Ativo" : "Inativo"}</StatusChip>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setModal({ initial: f })}
                        className="rounded-xl p-2 text-blue-600 hover:bg-blue-50"
                        title="Editar"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => toggleAtivo(f)}
                        className={`rounded-xl p-2 ${f.ativo ? "text-slate-400 hover:bg-slate-100" : "text-emerald-600 hover:bg-emerald-50"}`}
                        title={f.ativo ? "Inativar" : "Ativar"}
                      >
                        {f.ativo ? <FaToggleOn /> : <FaToggleOff />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <FornecedorModal
          initial={modal.initial || null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); buscar(search); }}
        />
      )}
    </div>
  );
}

/* ─── PEÇAS TAB ──────────────────────────────────────────────── */
function PecasTab() {
  const [pecas, setPecas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const debounceRef = useRef(null);

  async function buscar(q) {
    setLoading(true);
    let query = supabase
      .from("suprimentos_pecas")
      .select("*, suprimentos_fornecedores(nome)")
      .order("descricao")
      .limit(PAGE_SIZE);
    if (q.trim()) {
      query = query.or(`descricao.ilike.%${q.trim()}%,codigo.ilike.%${q.trim()}%`);
    }
    const { data } = await query;
    setPecas(data || []);
    setLoading(false);
  }

  useEffect(() => { buscar(""); }, []);

  function handleSearch(val) {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(val), 350);
  }

  async function toggleAtivo(p) {
    await supabase.from("suprimentos_pecas").update({ ativo: !p.ativo }).eq("id", p.id);
    buscar(search);
  }

  const filtered = pecas;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 min-w-[260px]">
          <FaSearch className="flex-shrink-0 text-slate-400 text-xs" />
          <input
            className="bg-transparent text-sm font-semibold text-slate-700 placeholder:text-slate-400 outline-none flex-1"
            placeholder="Buscar por código ou descrição…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => { setSearch(""); buscar(""); }} className="text-slate-400 hover:text-slate-600">
              <FaTimesCircle />
            </button>
          )}
        </div>
        <button onClick={() => setModal({})} className="flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700">
          <FaPlus /> Nova Peça
        </button>
      </div>

      {!search && (
        <p className="text-xs text-slate-400 font-semibold">
          Mostrando os primeiros {PAGE_SIZE} itens. Use a busca para filtrar entre os{" "}
          <span className="font-black text-slate-600">17.954</span> cadastrados.
        </p>
      )}
      {search && !loading && (
        <p className="text-xs text-slate-400 font-semibold">
          {filtered.length === PAGE_SIZE
            ? `Primeiros ${PAGE_SIZE} resultados para "${search}".`
            : `${filtered.length} resultado(s) para "${search}".`}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm font-semibold text-slate-400">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Buscando…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<FaBoxOpen />} title="Nenhuma peça encontrada" description={search ? "Tente outro termo de busca." : "Cadastre a primeira peça do catálogo."} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-black uppercase tracking-widest text-slate-400">
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Descrição</th>
                <th className="px-4 py-3 text-left">Unid.</th>
                <th className="px-4 py-3 text-left">Fornecedor</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-500">{p.codigo || "—"}</td>
                  <td className="px-4 py-3 font-semibold">{p.descricao}</td>
                  <td className="px-4 py-3 text-slate-600">{p.unidade_padrao}</td>
                  <td className="px-4 py-3 text-slate-600">{p.suprimentos_fornecedores?.nome || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusChip tone={p.ativo ? "emerald" : "slate"}>{p.ativo ? "Ativo" : "Inativo"}</StatusChip>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setModal({ initial: { ...p, fornecedor_id: p.fornecedor_id || "" } })} className="rounded-xl p-2 text-blue-600 hover:bg-blue-50" title="Editar"><FaEdit /></button>
                      <button onClick={() => toggleAtivo(p)} className={`rounded-xl p-2 ${p.ativo ? "text-slate-500 hover:bg-slate-100" : "text-emerald-600 hover:bg-emerald-50"}`} title={p.ativo ? "Inativar" : "Ativar"}>
                        {p.ativo ? <FaToggleOn /> : <FaToggleOff />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <PecaModal
          initial={modal.initial || null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); buscar(search); }}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════ */
const TABS = [
  { key: "fornecedores", label: "Fornecedores", icon: <FaBuilding /> },
  { key: "pecas", label: "Catálogo de Peças", icon: <FaBoxOpen /> },
];

export default function SuprimentosCadastro() {
  const [activeTab, setActiveTab] = useState("fornecedores");

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHero
        eyebrow="Suprimentos · Cadastro"
        title="Cadastro"
        description="Gerencie o cadastro de fornecedores e o catálogo de peças utilizados em Garantias, Testes e Serviço Externo."
      />

      <Panel>
        {/* tabs */}
        <div className="mb-5 flex gap-2 border-b border-slate-100 pb-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-black transition ${
                activeTab === t.key
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {activeTab === "fornecedores" && <FornecedoresTab />}
        {activeTab === "pecas" && <PecasTab />}
      </Panel>
    </div>
  );
}
