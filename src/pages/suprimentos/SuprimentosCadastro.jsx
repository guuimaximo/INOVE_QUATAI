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
  FaSync,
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
      <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-blue-950">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatBrasilApiAddress(data) {
  const street = [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(" ");
  const city = [data.municipio, data.uf].filter(Boolean).join("/");
  return [
    [street, data.numero].filter(Boolean).join(", "),
    data.complemento,
    data.bairro,
    city,
    data.cep ? `CEP ${data.cep}` : "",
  ]
    .filter(Boolean)
    .join(" - ");
}

function mergeBrasilApiObs(currentObs, data) {
  const baseObs = String(currentObs || "").split("Consulta BrasilAPI:")[0].trim();
  const address = formatBrasilApiAddress(data);
  const details = [
    data.descricao_situacao_cadastral ? `Situacao cadastral: ${data.descricao_situacao_cadastral}` : null,
    data.cnae_fiscal_descricao ? `CNAE: ${data.cnae_fiscal_descricao}` : null,
    address ? `Endereco: ${address}` : null,
  ].filter(Boolean);

  return [baseObs, details.length ? `Consulta BrasilAPI:\n${details.join("\n")}` : ""].filter(Boolean).join("\n\n");
}

async function fetchBrasilApiCnpj(cnpjValue) {
  const cnpj = onlyDigits(cnpjValue);
  if (cnpj.length !== 14) throw new Error("Informe um CNPJ valido com 14 digitos para consultar na BrasilAPI.");

  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (!response.ok) throw new Error("CNPJ nao encontrado na BrasilAPI.");
  return response.json();
}

function buildFornecedorPatchFromBrasilApi(current, data) {
  return {
    nome: data.razao_social || current.nome,
    cnpj: data.cnpj || current.cnpj,
    telefone: data.ddd_telefone_1 || current.telefone,
    telefone2: data.ddd_telefone_2 || current.telefone2,
    email: data.email || current.email,
    uf: data.uf || current.uf,
    tipo: data.descricao_identificador_matriz_filial || data.porte || current.tipo,
    obs: mergeBrasilApiObs(current.obs, data),
  };
}

function normalizeCatalogValue(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function pecaUniqueKey(peca) {
  const codigo = normalizeCatalogValue(peca.codigo);
  if (codigo) return `codigo:${codigo}`;
  return [
    "descricao",
    normalizeCatalogValue(peca.descricao),
    normalizeCatalogValue(peca.unidade_padrao),
    peca.fornecedor_id || "",
  ].join(":");
}

function dedupePecas(rows) {
  const byKey = new Map();
  rows.forEach((peca) => {
    const key = pecaUniqueKey(peca);
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, peca);
      return;
    }

    const currentScore = Number(Boolean(current.ativo)) + Number(Boolean(current.fornecedor_id));
    const nextScore = Number(Boolean(peca.ativo)) + Number(Boolean(peca.fornecedor_id));
    if (nextScore > currentScore) byKey.set(key, peca);
  });
  return Array.from(byKey.values());
}

/* ─── FORNECEDOR MODAL ───────────────────────────────────────── */
function FornecedorModal({ initial = null, onClose, onSaved }) {
  const [form, setForm] = useState(
    initial || { nome: "", cnpj: "", telefone: "", telefone2: "", email: "", contato: "", uf: "", tipo_fornecedor: "", tipo: "", obs: "" }
  );
  const [saving, setSaving] = useState(false);
  const [consultingCnpj, setConsultingCnpj] = useState(false);
  const [error, setError] = useState("");

  function setF(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleConsultCnpj() {
    const cnpj = onlyDigits(form.cnpj);
    if (cnpj.length !== 14) {
      setError("Informe um CNPJ valido com 14 digitos para consultar na BrasilAPI.");
      return;
    }

    setConsultingCnpj(true);
    setError("");
    try {
      const data = await fetchBrasilApiCnpj(cnpj);
      setForm((current) => ({ ...current, ...buildFornecedorPatchFromBrasilApi(current, data) }));
    } catch (err) {
      setError(err.message || "Nao foi possivel consultar o CNPJ na BrasilAPI.");
    } finally {
      setConsultingCnpj(false);
    }
  }

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
              <div className="flex gap-2">
                <input className={inputClass} placeholder="00.000.000/0000-00" value={form.cnpj} onChange={(e) => setF("cnpj", e.target.value)} />
                <button
                  type="button"
                  onClick={handleConsultCnpj}
                  disabled={consultingCnpj}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                  title="Consultar CNPJ na BrasilAPI"
                >
                  <FaSearch />
                  {consultingCnpj ? "Buscando" : "Buscar"}
                </button>
              </div>
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
      codigo: form.codigo?.trim() || null,
      descricao: form.descricao.trim(),
      unidade_padrao: form.unidade_padrao || "un",
      fornecedor_id: form.fornecedor_id || null,
      obs: form.obs || null,
    };
    if (payload.codigo) {
      let duplicateQuery = supabase
        .from("suprimentos_pecas")
        .select("id, descricao")
        .eq("codigo", payload.codigo)
        .limit(1);
      if (initial?.id) duplicateQuery = duplicateQuery.neq("id", initial.id);
      const { data: duplicate, error: duplicateError } = await duplicateQuery;
      if (duplicateError) {
        setSaving(false);
        setError(duplicateError.message);
        return;
      }
      if (duplicate?.length) {
        setSaving(false);
        setError(`Codigo ja cadastrado em: ${duplicate[0].descricao}. Edite a peca existente.`);
        return;
      }
    }
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
const CNPJ_BULK_PAGE_SIZE = 100;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function FornecedoresTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [updatingBrasilApi, setUpdatingBrasilApi] = useState(false);
  const [updatingIds, setUpdatingIds] = useState(() => new Set());
  const [updateMessage, setUpdateMessage] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);
  const debounceRef = useRef(null);
  const bulkCancelRef = useRef(false);

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

  async function updateFornecedorBrasilApi(f) {
    const cnpj = onlyDigits(f.cnpj);
    if (cnpj.length !== 14) {
      setUpdateMessage("Esse fornecedor nao tem CNPJ valido para consultar na BrasilAPI.");
      return false;
    }

    setUpdatingIds((current) => new Set(current).add(f.id));
    setUpdateMessage("");
    try {
      const data = await fetchBrasilApiCnpj(cnpj);
      const patch = buildFornecedorPatchFromBrasilApi(f, data);
      const { error: err } = await supabase.from("suprimentos_fornecedores").update(patch).eq("id", f.id);
      if (err) throw err;
      setRows((current) => current.map((row) => (row.id === f.id ? { ...row, ...patch } : row)));
      setUpdateMessage(`Fornecedor "${patch.nome}" atualizado pela BrasilAPI.`);
      return true;
    } catch (err) {
      setUpdateMessage(err.message || "Nao foi possivel atualizar esse fornecedor pela BrasilAPI.");
      return false;
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(f.id);
        return next;
      });
    }
  }

  async function updateVisibleBrasilApi() {
    const targets = rows.filter((f) => onlyDigits(f.cnpj).length === 14);
    if (!targets.length) {
      setUpdateMessage("Nenhum fornecedor visivel tem CNPJ valido para consultar.");
      return;
    }

    const ok = window.confirm(`Atualizar ${targets.length} fornecedor(es) visiveis pela BrasilAPI?`);
    if (!ok) return;

    setUpdatingBrasilApi(true);
    setUpdateMessage(`Atualizando ${targets.length} fornecedor(es) pela BrasilAPI...`);
    let updated = 0;
    let failed = 0;
    for (const fornecedor of targets) {
      const success = await updateFornecedorBrasilApi(fornecedor);
      if (success) updated += 1;
      else failed += 1;
    }
    setUpdatingBrasilApi(false);
    setUpdateMessage(`${updated} fornecedor(es) atualizado(s).${failed ? ` ${failed} com erro.` : ""}`);
  }

  async function updateAllBrasilApi() {
    const ok = window.confirm(
      "Atualizar todos os fornecedores com CNPJ pela BrasilAPI? Esse processo consulta em lotes e pode demorar bastante para 75 mil cadastros."
    );
    if (!ok) return;

    bulkCancelRef.current = false;
    setBulkUpdating(true);
    setUpdateMessage("");
    setBulkProgress({ total: 0, processed: 0, updated: 0, failed: 0, skipped: 0 });

    let offset = 0;
    let total = 0;
    let processed = 0;
    let updated = 0;
    let failed = 0;
    let skipped = 0;

    try {
      while (!bulkCancelRef.current) {
        const { data, count, error: fetchError } = await supabase
          .from("suprimentos_fornecedores")
          .select("id, nome, cnpj, telefone, telefone2, email, uf, tipo, obs", { count: "exact" })
          .not("cnpj", "is", null)
          .order("id", { ascending: true })
          .range(offset, offset + CNPJ_BULK_PAGE_SIZE - 1);

        if (fetchError) throw fetchError;
        if (typeof count === "number") total = count;
        if (!data?.length) break;

        for (const fornecedor of data) {
          if (bulkCancelRef.current) break;
          processed += 1;

          if (onlyDigits(fornecedor.cnpj).length !== 14) {
            skipped += 1;
            setBulkProgress({ total, processed, updated, failed, skipped });
            continue;
          }

          try {
            const brasilApiData = await fetchBrasilApiCnpj(fornecedor.cnpj);
            const patch = buildFornecedorPatchFromBrasilApi(fornecedor, brasilApiData);
            const { error: updateError } = await supabase
              .from("suprimentos_fornecedores")
              .update(patch)
              .eq("id", fornecedor.id);
            if (updateError) throw updateError;

            updated += 1;
            setRows((current) => current.map((row) => (row.id === fornecedor.id ? { ...row, ...patch } : row)));
          } catch {
            failed += 1;
          }

          setBulkProgress({ total, processed, updated, failed, skipped });
          await wait(80);
        }

        offset += CNPJ_BULK_PAGE_SIZE;
      }

      setUpdateMessage(
        bulkCancelRef.current
          ? `Atualizacao pausada: ${updated} atualizado(s), ${failed} erro(s), ${skipped} ignorado(s).`
          : `Atualizacao concluida: ${updated} atualizado(s), ${failed} erro(s), ${skipped} ignorado(s).`
      );
    } catch (err) {
      setUpdateMessage(err.message || "Nao foi possivel atualizar todos os fornecedores pela BrasilAPI.");
    } finally {
      setBulkUpdating(false);
      bulkCancelRef.current = false;
    }
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={updateVisibleBrasilApi}
            disabled={updatingBrasilApi || bulkUpdating || loading || rows.length === 0}
            className="flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-100 disabled:cursor-wait disabled:opacity-50"
          >
            <FaSync className={updatingBrasilApi ? "animate-spin" : ""} /> Atualizar CNPJs visiveis
          </button>
          <button
            onClick={updateAllBrasilApi}
            disabled={bulkUpdating || updatingBrasilApi || loading}
            className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-700 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-50"
          >
            <FaSync className={bulkUpdating ? "animate-spin" : ""} /> Atualizar todos CNPJs
          </button>
          {bulkUpdating && (
            <button
              onClick={() => { bulkCancelRef.current = true; }}
              className="flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-sm font-black text-rose-700 hover:bg-rose-100"
            >
              <FaTimes /> Pausar
            </button>
          )}
          <button
            onClick={() => setModal({})}
            disabled={bulkUpdating}
            className="flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700"
          >
            <FaPlus /> Novo Fornecedor
          </button>
        </div>
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
      {updateMessage && (
        <p className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700">
          {updateMessage}
        </p>
      )}
      {bulkProgress && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              BrasilAPI: {bulkProgress.processed.toLocaleString("pt-BR")} / {bulkProgress.total ? bulkProgress.total.toLocaleString("pt-BR") : "..."} processado(s)
            </span>
            <span>
              {bulkProgress.updated.toLocaleString("pt-BR")} atualizado(s) · {bulkProgress.failed.toLocaleString("pt-BR")} erro(s) · {bulkProgress.skipped.toLocaleString("pt-BR")} ignorado(s)
            </span>
          </div>
          {bulkProgress.total > 0 && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(100, (bulkProgress.processed / bulkProgress.total) * 100)}%` }}
              />
            </div>
          )}
        </div>
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
                        onClick={() => updateFornecedorBrasilApi(f)}
                        disabled={updatingIds.has(f.id) || updatingBrasilApi || onlyDigits(f.cnpj).length !== 14}
                        className="rounded-xl p-2 text-cyan-700 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:text-slate-300"
                        title="Atualizar pela BrasilAPI"
                      >
                        <FaSync className={updatingIds.has(f.id) ? "animate-spin" : ""} />
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
  const [rawCount, setRawCount] = useState(0);
  const debounceRef = useRef(null);

  async function buscar(q) {
    setLoading(true);
    let query = supabase
      .from("suprimentos_pecas")
      .select("*, suprimentos_fornecedores(nome)")
      .order("descricao")
      .limit(PAGE_SIZE * 4);
    if (q.trim()) {
      query = query.or(`descricao.ilike.%${q.trim()}%,codigo.ilike.%${q.trim()}%`);
    }
    const { data } = await query;
    setRawCount(data?.length || 0);
    setPecas(dedupePecas(data || []).slice(0, PAGE_SIZE));
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
          Mostrando os primeiros {PAGE_SIZE} itens unicos. Use a busca para filtrar entre os{" "}
          <span className="font-black text-slate-600">17.954</span> cadastrados.
        </p>
      )}
      {search && !loading && (
        <p className="text-xs text-slate-400 font-semibold">
          {rawCount > filtered.length
            ? `${filtered.length} item(ns) unico(s) para "${search}" (${rawCount - filtered.length} duplicado(s) oculto(s) neste lote).`
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
        description=""
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
