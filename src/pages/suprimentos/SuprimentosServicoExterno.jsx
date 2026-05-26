import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  FaArrowLeft,
  FaBan,
  FaBoxOpen,
  FaClipboardList,
  FaEye,
  FaFileAlt,
  FaFilter,
  FaPencilAlt,
  FaPlus,
  FaPrint,
  FaRedo,
  FaSearch,
  FaTimes,
  FaTimesCircle,
  FaTruck,
  FaTruckLoading,
  FaUndoAlt,
} from "react-icons/fa";
import { AuthContext } from "../../context/AuthContext";
import { supabase } from "../../supabase";
import {
  ActionButton,
  EmptyState,
  KpiCard,
  PageHero,
  Panel,
  StatusChip,
} from "./SuprimentosUI";
import { formatDateBR, formatDateTimeBR, todayISO } from "./suprimentosShared";

/* ─── helpers ─────────────────────────────────────────────────── */
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

function statusMeta(status) {
  if (status === "Retornado") return { tone: "emerald", label: "Retornado" };
  if (status === "Cancelado") return { tone: "rose", label: "Cancelado" };
  return { tone: "amber", label: "Em posse do terceiro" };
}

const EMPTY_ITEM = { descricao: "", quantidade: "1", unidade: "un", numero_serie: "", obs: "" };

function ItemRow({ item, index, onChange, onRemove, readOnly }) {
  function handle(field) {
    return (e) => onChange(index, { ...item, [field]: e.target.value });
  }
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2 pr-2">
        <input
          className={inputClass + " min-w-[160px]"}
          placeholder="Descrição do item"
          value={item.descricao}
          onChange={handle("descricao")}
          disabled={readOnly}
        />
      </td>
      <td className="py-2 pr-2 w-20">
        <input
          className={inputClass}
          type="number"
          min="1"
          placeholder="Qtd"
          value={item.quantidade}
          onChange={handle("quantidade")}
          disabled={readOnly}
        />
      </td>
      <td className="py-2 pr-2 w-24">
        <input
          className={inputClass}
          placeholder="un"
          value={item.unidade}
          onChange={handle("unidade")}
          disabled={readOnly}
        />
      </td>
      <td className="py-2 pr-2 w-40">
        <input
          className={inputClass}
          placeholder="Nº série / patrimônio"
          value={item.numero_serie}
          onChange={handle("numero_serie")}
          disabled={readOnly}
        />
      </td>
      <td className="py-2 pr-2">
        <input
          className={inputClass}
          placeholder="Obs."
          value={item.obs}
          onChange={handle("obs")}
          disabled={readOnly}
        />
      </td>
      {!readOnly && (
        <td className="py-2 w-8">
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="rounded-xl p-2 text-rose-400 hover:bg-rose-50 hover:text-rose-600"
          >
            <FaTimes />
          </button>
        </td>
      )}
    </tr>
  );
}

/* ─── print ficha ─────────────────────────────────────────────── */
function printFicha(record) {
  const itensHtml = (record.itens || [])
    .map(
      (it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${it.descricao || ""}</td>
      <td>${it.quantidade || ""} ${it.unidade || ""}</td>
      <td>${it.numero_serie || ""}</td>
      <td>${it.obs || ""}</td>
    </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Serviço Externo ${record.numero_saida}</title>
<style>
  * { box-sizing: border-box; font-family: Arial, sans-serif; }
  body { margin: 0; padding: 24px; font-size: 13px; color: #1e293b; }
  h1 { font-size: 20px; font-weight: 900; margin: 0 0 2px; }
  .sub { font-size: 11px; color: #64748b; margin-bottom: 16px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 16px; }
  .field label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; }
  .field p { margin: 2px 0 0; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { background: #f1f5f9; }
  th { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; padding: 6px 8px; text-align: left; border: 1px solid #e2e8f0; }
  td { padding: 5px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
  .sig { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .sig-block { border-top: 1.5px solid #1e293b; padding-top: 6px; font-size: 11px; }
  .sig-block p { margin: 2px 0; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 11px; font-weight: 900; }
  .badge-amber { background: #fef3c7; color: #92400e; }
  .badge-emerald { background: #d1fae5; color: #065f46; }
  .badge-rose { background: #ffe4e6; color: #9f1239; }
  @media print { body { padding: 10mm 14mm; } }
</style>
</head>
<body>
  <h1>Serviço Externo — Ficha de Saída</h1>
  <p class="sub">Gerado em ${new Date().toLocaleString("pt-BR")}</p>

  <div class="grid">
    <div class="field"><label>Número</label><p>${record.numero_saida || "—"}</p></div>
    <div class="field"><label>Status</label><p><span class="badge badge-${statusMeta(record.status).tone}">${record.status}</span></p></div>
    <div class="field"><label>Nota de Saída (Simples Remessa)</label><p>${record.nota_saida_numero || "—"} ${record.nota_saida_data ? "· " + formatDateBR(record.nota_saida_data) : ""}</p></div>
    <div class="field"><label>Nota de Retorno</label><p>${record.nota_retorno_numero || "—"} ${record.nota_retorno_data ? "· " + formatDateBR(record.nota_retorno_data) : ""}</p></div>
    <div class="field"><label>Terceiro</label><p>${record.terceiro_nome || "—"}</p></div>
    <div class="field"><label>CPF / CNPJ</label><p>${record.terceiro_cpf_cnpj || "—"}</p></div>
    <div class="field"><label>Telefone</label><p>${record.terceiro_telefone || "—"}</p></div>
    <div class="field"><label>Endereço</label><p>${record.terceiro_endereco || "—"}</p></div>
    <div class="field" style="grid-column:1/-1"><label>Motivo / Serviço</label><p>${record.motivo || "—"}</p></div>
    ${record.observacao ? `<div class="field" style="grid-column:1/-1"><label>Observações</label><p>${record.observacao}</p></div>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Descrição</th>
        <th>Qtd / Un.</th>
        <th>Nº série / Patrimônio</th>
        <th>Obs.</th>
      </tr>
    </thead>
    <tbody>
      ${itensHtml || '<tr><td colspan="5">Nenhum item.</td></tr>'}
    </tbody>
  </table>

  <div class="sig">
    <div class="sig-block">
      <p><strong>Responsável pela entrega</strong></p>
      <p style="margin-top:4px; font-size:11px; color:#64748b">${record.criado_por_nome || "—"}</p>
      <p style="margin-top:4px; font-size:11px; color:#64748b">Data: _____ / _____ / ________</p>
    </div>
    <div class="sig-block">
      <p><strong>Assinatura do Terceiro (recebimento)</strong></p>
      <p style="margin-top:4px; font-size:11px; color:#64748b">${record.terceiro_nome || "—"}</p>
      <p style="margin-top:4px; font-size:11px; color:#64748b">Data: _____ / _____ / ________</p>
    </div>
    <div class="sig-block" style="margin-top:32px">
      <p><strong>Responsável pelo recebimento (retorno)</strong></p>
      <p style="margin-top:4px; font-size:11px; color:#64748b">Data: _____ / _____ / ________</p>
    </div>
    <div class="sig-block" style="margin-top:32px">
      <p><strong>Assinatura do Terceiro (devolução)</strong></p>
      <p style="margin-top:4px; font-size:11px; color:#64748b">Data: _____ / _____ / ________</p>
    </div>
  </div>
</body>
</html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

/* ─── initial form state ──────────────────────────────────────── */
function emptyForm() {
  return {
    nota_saida_numero: "",
    nota_saida_data: todayISO(),
    nota_retorno_numero: "",
    nota_retorno_data: "",
    terceiro_nome: "",
    terceiro_cpf_cnpj: "",
    terceiro_telefone: "",
    terceiro_endereco: "",
    motivo: "",
    observacao: "",
    itens: [{ ...EMPTY_ITEM }],
  };
}

/* ════════════════════════════════════════════════════════════════
   MODAL — NOVO REGISTRO
═══════════════════════════════════════════════════════════════════ */
function NovoModal({ onClose, onSaved, userInfo }) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setF(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleItemChange(index, newItem) {
    const updated = [...form.itens];
    updated[index] = newItem;
    setForm((f) => ({ ...f, itens: updated }));
  }

  function addItem() {
    setForm((f) => ({ ...f, itens: [...f.itens, { ...EMPTY_ITEM }] }));
  }

  function removeItem(index) {
    setForm((f) => ({ ...f, itens: f.itens.filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    if (!form.terceiro_nome.trim()) { setError("Informe o nome do terceiro."); return; }
    if (!form.motivo.trim()) { setError("Informe o motivo / serviço."); return; }
    const validItens = form.itens.filter((it) => it.descricao.trim());
    if (validItens.length === 0) { setError("Adicione ao menos um item."); return; }

    setSaving(true);
    setError("");

    const { error: err } = await supabase.from("suprimentos_servico_externo").insert({
      nota_saida_numero: form.nota_saida_numero || null,
      nota_saida_data: form.nota_saida_data || null,
      terceiro_nome: form.terceiro_nome.trim(),
      terceiro_cpf_cnpj: form.terceiro_cpf_cnpj || null,
      terceiro_telefone: form.terceiro_telefone || null,
      terceiro_endereco: form.terceiro_endereco || null,
      motivo: form.motivo.trim(),
      observacao: form.observacao || null,
      itens: validItens,
      criado_por_id: userInfo?.id || null,
      criado_por_login: userInfo?.login || null,
      criado_por_nome: userInfo?.nome || null,
    });

    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-600">Serviço Externo</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">Nova Saída</h2>
          </div>
          <button onClick={onClose} className="rounded-2xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <FaTimes />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Nota de saída */}
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Nota Fiscal de Saída (Simples Remessa)</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Número da NF">
                <input className={inputClass} placeholder="ex.: 001234" value={form.nota_saida_numero} onChange={(e) => setF("nota_saida_numero", e.target.value)} />
              </Field>
              <Field label="Data de Emissão">
                <input type="date" className={inputClass} value={form.nota_saida_data} onChange={(e) => setF("nota_saida_data", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Terceiro */}
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Dados do Terceiro</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome / Razão Social" required className="col-span-2">
                <input className={inputClass} placeholder="Nome completo ou razão social" value={form.terceiro_nome} onChange={(e) => setF("terceiro_nome", e.target.value)} />
              </Field>
              <Field label="CPF / CNPJ">
                <input className={inputClass} placeholder="000.000.000-00" value={form.terceiro_cpf_cnpj} onChange={(e) => setF("terceiro_cpf_cnpj", e.target.value)} />
              </Field>
              <Field label="Telefone">
                <input className={inputClass} placeholder="(00) 00000-0000" value={form.terceiro_telefone} onChange={(e) => setF("terceiro_telefone", e.target.value)} />
              </Field>
              <Field label="Endereço" className="col-span-2">
                <input className={inputClass} placeholder="Rua, número, cidade..." value={form.terceiro_endereco} onChange={(e) => setF("terceiro_endereco", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Motivo */}
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Motivo / Serviço</p>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Descrição do serviço" required>
                <textarea rows={2} className={textareaClass} placeholder="Descreva o motivo da saída / serviço a ser realizado..." value={form.motivo} onChange={(e) => setF("motivo", e.target.value)} />
              </Field>
              <Field label="Observações internas">
                <textarea rows={2} className={textareaClass} placeholder="Informações adicionais..." value={form.observacao} onChange={(e) => setF("observacao", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Itens */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Itens enviados</p>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 rounded-2xl bg-blue-600 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-700"
              >
                <FaPlus /> Adicionar item
              </button>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs font-black uppercase tracking-widest text-slate-500">
                    <th className="px-3 py-2 text-left">Descrição</th>
                    <th className="px-3 py-2 text-left w-20">Qtd</th>
                    <th className="px-3 py-2 text-left w-24">Un.</th>
                    <th className="px-3 py-2 text-left w-40">Nº série / Pat.</th>
                    <th className="px-3 py-2 text-left">Obs.</th>
                    <th className="px-3 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="px-3">
                  {form.itens.map((item, i) => (
                    <ItemRow
                      key={i}
                      item={item}
                      index={i}
                      onChange={handleItemChange}
                      onRemove={removeItem}
                      readOnly={false}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* sticky footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4 rounded-b-[28px]">
          <button onClick={onClose} className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <FaTruckLoading /> {saving ? "Salvando…" : "Registrar saída"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MODAL — DETALHES / AÇÕES
═══════════════════════════════════════════════════════════════════ */
function DetalheModal({ record, onClose, onUpdated }) {
  const [tab, setTab] = useState("detalhes"); // detalhes | retorno | cancelar
  const [retornoForm, setRetornoForm] = useState({
    nota_retorno_numero: record.nota_retorno_numero || "",
    nota_retorno_data: record.nota_retorno_data || todayISO(),
    retornado_obs: record.retornado_obs || "",
  });
  const [cancelarMotivo, setCancelarMotivo] = useState(record.cancelado_motivo || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const meta = statusMeta(record.status);

  async function registrarRetorno() {
    setSaving(true);
    setError("");
    const { error: err } = await supabase
      .from("suprimentos_servico_externo")
      .update({
        status: "Retornado",
        nota_retorno_numero: retornoForm.nota_retorno_numero || null,
        nota_retorno_data: retornoForm.nota_retorno_data || null,
        retornado_obs: retornoForm.retornado_obs || null,
        retornado_em: new Date().toISOString(),
      })
      .eq("id", record.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onUpdated();
  }

  async function cancelar() {
    if (!cancelarMotivo.trim()) { setError("Informe o motivo do cancelamento."); return; }
    setSaving(true);
    setError("");
    const { error: err } = await supabase
      .from("suprimentos_servico_externo")
      .update({
        status: "Cancelado",
        cancelado_motivo: cancelarMotivo.trim(),
        cancelado_em: new Date().toISOString(),
      })
      .eq("id", record.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onUpdated();
  }

  const canAct = record.status === "Em posse do terceiro";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-600">Serviço Externo</p>
              <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
            </div>
            <h2 className="mt-1 text-xl font-black text-slate-900">{record.numero_saida}</h2>
            <p className="mt-0.5 text-sm font-semibold text-slate-500">{record.terceiro_nome}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => printFicha(record)}
              className="flex items-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              <FaPrint /> Imprimir
            </button>
            <button onClick={onClose} className="rounded-2xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <FaTimes />
            </button>
          </div>
        </div>

        {/* tabs */}
        {canAct && (
          <div className="flex gap-1 border-b border-slate-100 px-6 pt-3">
            {[["detalhes", <FaClipboardList />, "Detalhes"], ["retorno", <FaUndoAlt />, "Registrar Retorno"], ["cancelar", <FaBan />, "Cancelar"]].map(
              ([key, icon, label]) => (
                <button
                  key={key}
                  onClick={() => { setTab(key); setError(""); }}
                  className={`flex items-center gap-1.5 rounded-t-2xl px-4 py-2 text-xs font-black transition ${
                    tab === key
                      ? "bg-blue-600 text-white"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  }`}
                >
                  {icon} {label}
                </button>
              )
            )}
          </div>
        )}

        <div className="px-6 py-5 space-y-5">
          {/* ── DETALHES ── */}
          {(tab === "detalhes" || !canAct) && (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <InfoField label="Nota de Saída" value={`${record.nota_saida_numero || "—"} ${record.nota_saida_data ? "· " + formatDateBR(record.nota_saida_data) : ""}`} />
                <InfoField label="Nota de Retorno" value={`${record.nota_retorno_numero || "—"} ${record.nota_retorno_data ? "· " + formatDateBR(record.nota_retorno_data) : ""}`} />
                <InfoField label="Terceiro" value={record.terceiro_nome} />
                <InfoField label="CPF / CNPJ" value={record.terceiro_cpf_cnpj} />
                <InfoField label="Telefone" value={record.terceiro_telefone} />
                <InfoField label="Endereço" value={record.terceiro_endereco} />
                <InfoField label="Motivo / Serviço" value={record.motivo} className="col-span-2" />
                {record.observacao && <InfoField label="Observações" value={record.observacao} className="col-span-2" />}
                {record.retornado_obs && <InfoField label="Obs. do retorno" value={record.retornado_obs} className="col-span-2" />}
                {record.cancelado_motivo && <InfoField label="Motivo do cancelamento" value={record.cancelado_motivo} className="col-span-2" />}
                <InfoField label="Criado por" value={record.criado_por_nome} />
                <InfoField label="Criado em" value={formatDateTimeBR(record.created_at)} />
                {record.retornado_em && <InfoField label="Retornado em" value={formatDateTimeBR(record.retornado_em)} />}
                {record.cancelado_em && <InfoField label="Cancelado em" value={formatDateTimeBR(record.cancelado_em)} />}
              </div>

              {/* itens */}
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">Itens</p>
                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs font-black uppercase tracking-widest text-slate-500">
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Descrição</th>
                        <th className="px-3 py-2 text-left">Qtd</th>
                        <th className="px-3 py-2 text-left">Nº série / Pat.</th>
                        <th className="px-3 py-2 text-left">Obs.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(record.itens || []).map((it, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-semibold text-slate-400">{i + 1}</td>
                          <td className="px-3 py-2 font-semibold">{it.descricao}</td>
                          <td className="px-3 py-2 text-slate-600">{it.quantidade} {it.unidade}</td>
                          <td className="px-3 py-2 text-slate-600">{it.numero_serie || "—"}</td>
                          <td className="px-3 py-2 text-slate-500">{it.obs || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── RETORNO ── */}
          {tab === "retorno" && canAct && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-600">Informe os dados da nota de retorno para confirmar que os itens foram devolvidos.</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nº da Nota de Retorno">
                  <input className={inputClass} placeholder="ex.: 005678" value={retornoForm.nota_retorno_numero} onChange={(e) => setRetornoForm((f) => ({ ...f, nota_retorno_numero: e.target.value }))} />
                </Field>
                <Field label="Data da Nota de Retorno">
                  <input type="date" className={inputClass} value={retornoForm.nota_retorno_data} onChange={(e) => setRetornoForm((f) => ({ ...f, nota_retorno_data: e.target.value }))} />
                </Field>
                <Field label="Observações do retorno" className="col-span-2">
                  <textarea rows={3} className={textareaClass} placeholder="Condições dos itens, observações..." value={retornoForm.retornado_obs} onChange={(e) => setRetornoForm((f) => ({ ...f, retornado_obs: e.target.value }))} />
                </Field>
              </div>
            </div>
          )}

          {/* ── CANCELAR ── */}
          {tab === "cancelar" && canAct && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-600">Informe o motivo do cancelamento desta saída.</p>
              <Field label="Motivo do cancelamento" required>
                <textarea rows={3} className={textareaClass} placeholder="Descreva o motivo..." value={cancelarMotivo} onChange={(e) => setCancelarMotivo(e.target.value)} />
              </Field>
            </div>
          )}

          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4 rounded-b-[28px]">
          <button onClick={onClose} className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-50">
            Fechar
          </button>
          {tab === "retorno" && canAct && (
            <button
              onClick={registrarRetorno}
              disabled={saving}
              className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <FaUndoAlt /> {saving ? "Salvando…" : "Confirmar retorno"}
            </button>
          )}
          {tab === "cancelar" && canAct && (
            <button
              onClick={cancelar}
              disabled={saving}
              className="flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-50"
            >
              <FaBan /> {saving ? "Salvando…" : "Cancelar saída"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value, className = "" }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800">{value || "—"}</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════ */
const STATUS_FILTER_OPTIONS = ["Todos", "Em posse do terceiro", "Retornado", "Cancelado"];

export default function SuprimentosServicoExterno() {
  const { user } = useContext(AuthContext);
  const userInfo = useMemo(() => ({
    id: user?.id || null,
    login: user?.login || user?.usuario || null,
    nome: user?.nome || user?.name || null,
  }), [user]);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [statusFilter, setStatusFilter] = useState("Todos");
  const [search, setSearch] = useState("");

  const [showNovo, setShowNovo] = useState(false);
  const [selected, setSelected] = useState(null);

  async function carregar() {
    setLoading(true);
    setErrorMsg("");
    const { data, error } = await supabase
      .from("suprimentos_servico_externo")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg(error.message);
      setRecords([]);
    } else {
      setRecords(data || []);
    }
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchStatus = statusFilter === "Todos" || r.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        (r.numero_saida || "").toLowerCase().includes(q) ||
        (r.terceiro_nome || "").toLowerCase().includes(q) ||
        (r.motivo || "").toLowerCase().includes(q) ||
        (r.nota_saida_numero || "").toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [records, statusFilter, search]);

  const kpis = useMemo(() => {
    const total = records.length;
    const emPosse = records.filter((r) => r.status === "Em posse do terceiro").length;
    const retornados = records.filter((r) => r.status === "Retornado").length;
    return { total, emPosse, retornados };
  }, [records]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHero
        eyebrow="Suprimentos · Serviço Externo"
        title="Serviço Externo"
        description="Rastreie tudo que sai da empresa para terceiros — nota de saída (simples remessa), nota de retorno e ficha para assinatura."
        actions={
          <button
            onClick={() => setShowNovo(true)}
            className="flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow hover:bg-blue-700"
          >
            <FaPlus /> Nova saída
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard title="Total registros" value={kpis.total} icon={<FaClipboardList />} tone="blue" />
        <KpiCard title="Em posse do terceiro" value={kpis.emPosse} icon={<FaTruck />} tone="amber" />
        <KpiCard title="Retornados" value={kpis.retornados} icon={<FaUndoAlt />} tone="emerald" />
      </div>

      {/* filtros */}
      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTER_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-2xl px-3 py-1.5 text-xs font-black transition ${
                  statusFilter === s
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <FaSearch className="text-slate-400" />
            <input
              className="bg-transparent outline-none text-sm font-semibold text-slate-700 placeholder:text-slate-400 w-48"
              placeholder="Buscar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-700">
                <FaTimesCircle />
              </button>
            )}
          </div>
        </div>
      </Panel>

      {/* tabela */}
      <Panel>
        {errorMsg && (
          <div className="mb-4 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700">
            {errorMsg}
          </div>
        )}
        {loading ? (
          <div className="py-16 text-center text-sm font-semibold text-slate-400">Carregando…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FaBoxOpen />}
            title="Nenhum registro encontrado"
            description="Registre uma nova saída para começar a rastrear."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-black uppercase tracking-widest text-slate-400">
                  <th className="pb-3 text-left pr-4">Nº</th>
                  <th className="pb-3 text-left pr-4">Status</th>
                  <th className="pb-3 text-left pr-4">Terceiro</th>
                  <th className="pb-3 text-left pr-4">Motivo</th>
                  <th className="pb-3 text-left pr-4">NF Saída</th>
                  <th className="pb-3 text-left pr-4">Data</th>
                  <th className="pb-3 text-left pr-4">Itens</th>
                  <th className="pb-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const meta = statusMeta(r.status);
                  return (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-3 pr-4 font-black text-blue-700">{r.numero_saida}</td>
                      <td className="py-3 pr-4">
                        <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
                      </td>
                      <td className="py-3 pr-4 font-semibold">{r.terceiro_nome}</td>
                      <td className="py-3 pr-4 text-slate-600 max-w-[200px] truncate">{r.motivo}</td>
                      <td className="py-3 pr-4 text-slate-600">{r.nota_saida_numero || "—"}</td>
                      <td className="py-3 pr-4 text-slate-600">{formatDateBR(r.nota_saida_data)}</td>
                      <td className="py-3 pr-4 text-slate-600">{(r.itens || []).length} item(s)</td>
                      <td className="py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelected(r)}
                            className="rounded-xl p-2 text-blue-600 hover:bg-blue-50"
                            title="Ver detalhes"
                          >
                            <FaEye />
                          </button>
                          <button
                            onClick={() => printFicha(r)}
                            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                            title="Imprimir ficha"
                          >
                            <FaPrint />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showNovo && (
        <NovoModal
          onClose={() => setShowNovo(false)}
          onSaved={() => { setShowNovo(false); carregar(); }}
          userInfo={userInfo}
        />
      )}

      {selected && (
        <DetalheModal
          record={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { setSelected(null); carregar(); }}
        />
      )}
    </div>
  );
}
