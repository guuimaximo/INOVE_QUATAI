import { useContext, useEffect, useMemo, useState } from "react";
import {
  FaBug,
  FaCheckCircle,
  FaEdit,
  FaEye,
  FaFlagCheckered,
  FaFlask,
  FaPlus,
  FaRedo,
  FaRoute,
  FaSearch,
  FaTimesCircle,
} from "react-icons/fa";
import CampoPrefixo from "../../components/CampoPrefixo";
import { AuthContext } from "../../context/AuthContext";
import { supabase } from "../../supabase";
import {
  ActionButton,
  AttachmentGallery,
  AttachmentInput,
  EmptyState,
  KpiCard,
  PageHero,
  Panel,
  StatusChip,
} from "./SuprimentosUI";
import {
  TESTE_RESULTADOS,
  buildOpenedBy,
  deriveTesteMeta,
  formatDateBR,
  formatDateTimeBR,
  formatKm,
  generateNextControlNumber,
  matchesSearch,
  safeNumber,
  todayISO,
  uploadSuprimentosFiles,
} from "./suprimentosShared";

const EMPTY_FORM = {
  nome_teste: "",
  peca: "",
  codigo_peca: "",
  fornecedor: "",
  objetivo: "",
  prefixo: "",
  data_inicio: todayISO(),
  km_inicial: "",
  km_atual: "",
  prazo_teste: "",
  observacao: "",
  falha_registrada: false,
  data_falha: "",
  km_falha: "",
  descricao_falha: "",
  parecer_tecnico: "",
  resultado_final: "",
  encerrado_em: "",
};

function Field({ label, required = false, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        {label} {required ? "*" : ""}
      </span>
      {children}
    </label>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-800">{value || "—"}</p>
    </div>
  );
}

function Block({ title, text }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">{title}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">
        {text || "Sem informacoes."}
      </p>
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";

function TesteModal({ open, item, onClose, onSaved, user }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!item) {
      setForm(EMPTY_FORM);
      setExistingAttachments([]);
      setNewFiles([]);
      return;
    }

    setForm({
      nome_teste: item.nome_teste || "",
      peca: item.peca || "",
      codigo_peca: item.codigo_peca || "",
      fornecedor: item.fornecedor || "",
      objetivo: item.objetivo || "",
      prefixo: item.prefixo || "",
      data_inicio: item.data_inicio || todayISO(),
      km_inicial: item.km_inicial ?? "",
      km_atual: item.km_atual ?? "",
      prazo_teste: item.prazo_teste || "",
      observacao: item.observacao || "",
      falha_registrada: item.falha_registrada === true,
      data_falha: item.data_falha || "",
      km_falha: item.km_falha ?? "",
      descricao_falha: item.descricao_falha || "",
      parecer_tecnico: item.parecer_tecnico || "",
      resultado_final: item.resultado_final || "",
      encerrado_em: item.encerrado_em || "",
    });
    setExistingAttachments(Array.isArray(item.anexos) ? item.anexos : []);
    setNewFiles([]);
  }, [item, open]);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const uploaded = await uploadSuprimentosFiles(
        newFiles,
        `testes/${form.prefixo || "sem-prefixo"}`
      );

      const payload = {
        nome_teste: form.nome_teste.trim(),
        peca: form.peca.trim(),
        codigo_peca: form.codigo_peca.trim() || null,
        fornecedor: form.fornecedor.trim(),
        objetivo: form.objetivo.trim() || null,
        prefixo: form.prefixo.trim(),
        data_inicio: form.data_inicio || null,
        km_inicial: safeNumber(form.km_inicial),
        km_atual: safeNumber(form.km_atual),
        prazo_teste: form.prazo_teste || null,
        observacao: form.observacao.trim() || null,
        falha_registrada: form.falha_registrada,
        data_falha: form.falha_registrada ? form.data_falha || null : null,
        km_falha: form.falha_registrada ? safeNumber(form.km_falha) : null,
        descricao_falha: form.falha_registrada ? form.descricao_falha.trim() || null : null,
        parecer_tecnico: form.parecer_tecnico.trim() || null,
        resultado_final: form.resultado_final || null,
        encerrado_em: form.encerrado_em || null,
        anexos: [...existingAttachments, ...uploaded],
        updated_at: new Date().toISOString(),
      };

      if (item?.id) {
        const { error } = await supabase
          .from("suprimentos_testes")
          .update(payload)
          .eq("id", item.id);
        if (error) throw error;
      } else {
        const numeroControle = await generateNextControlNumber(
          "suprimentos_testes",
          "TST"
        );
        const { error } = await supabase.from("suprimentos_testes").insert({
          ...payload,
          numero_controle: numeroControle,
          ...buildOpenedBy(user),
        });
        if (error) throw error;
      }

      onSaved?.();
      onClose?.();
    } catch (error) {
      alert(`Erro ao salvar teste: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[32px] border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-5">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.34em] text-blue-600">
                Suprimentos
              </p>
              <h2 className="mt-3 text-2xl font-black text-slate-900">
                {item ? "Atualizar teste" : "Novo teste"}
              </h2>
              {item?.numero_controle ? (
                <p className="mt-2 text-xs font-black uppercase tracking-[0.24em] text-slate-400">
                  Controle {item.numero_controle}
                </p>
              ) : null}
              <p className="mt-2 text-sm font-medium text-slate-500">
                Acompanhe a peca em campo, a quilometragem do teste e o parecer final
                sem depender de mudanca manual de status.
              </p>
            </div>
            <ActionButton onClick={onClose}>Fechar</ActionButton>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Nome do teste" required>
              <input
                value={form.nome_teste}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, nome_teste: e.target.value }))
                }
                className={inputClass}
                required
              />
            </Field>
            <Field label="Peca" required>
              <input
                value={form.peca}
                onChange={(e) => setForm((prev) => ({ ...prev, peca: e.target.value }))}
                className={inputClass}
                required
              />
            </Field>
            <Field label="Codigo da peca">
              <input
                value={form.codigo_peca}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, codigo_peca: e.target.value }))
                }
                className={inputClass}
              />
            </Field>
            <Field label="Fornecedor / marca" required>
              <input
                value={form.fornecedor}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, fornecedor: e.target.value }))
                }
                className={inputClass}
                required
              />
            </Field>
            <Field label="Prefixo" required>
              <CampoPrefixo
                value={form.prefixo}
                onChange={(value) => setForm((prev) => ({ ...prev, prefixo: value }))}
                label=""
              />
            </Field>
            <Field label="Data de inicio" required>
              <input
                type="date"
                value={form.data_inicio}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, data_inicio: e.target.value }))
                }
                className={inputClass}
                required
              />
            </Field>
            <Field label="KM inicial" required>
              <input
                type="number"
                min="0"
                step="1"
                value={form.km_inicial}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, km_inicial: e.target.value }))
                }
                className={inputClass}
                required
              />
            </Field>
            <Field label="KM atual">
              <input
                type="number"
                min="0"
                step="1"
                value={form.km_atual}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, km_atual: e.target.value }))
                }
                className={inputClass}
              />
            </Field>
            <Field label="Prazo do teste">
              <input
                type="date"
                value={form.prazo_teste}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, prazo_teste: e.target.value }))
                }
                className={inputClass}
              />
            </Field>
            <Field label="Resultado final">
              <select
                value={form.resultado_final}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, resultado_final: e.target.value }))
                }
                className={inputClass}
              >
                <option value="">Em aberto</option>
                {TESTE_RESULTADOS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data de encerramento">
              <input
                type="date"
                value={form.encerrado_em}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, encerrado_em: e.target.value }))
                }
                className={inputClass}
              />
            </Field>
            <label className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={form.falha_registrada}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, falha_registrada: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Falha registrada
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-700">
                  Marque quando a peca apresentou comportamento fora do esperado.
                </p>
              </div>
            </label>
          </div>

          {form.falha_registrada ? (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Data da falha">
                <input
                  type="date"
                  value={form.data_falha}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, data_falha: e.target.value }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="KM da falha">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.km_falha}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, km_falha: e.target.value }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Descricao da falha" className="md:col-span-3">
                <textarea
                  value={form.descricao_falha}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, descricao_falha: e.target.value }))
                  }
                  className={`${inputClass} min-h-[110px]`}
                />
              </Field>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Field label="Objetivo do teste">
              <textarea
                value={form.objetivo}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, objetivo: e.target.value }))
                }
                className={`${inputClass} min-h-[120px]`}
              />
            </Field>
            <Field label="Observacao">
              <textarea
                value={form.observacao}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, observacao: e.target.value }))
                }
                className={`${inputClass} min-h-[120px]`}
              />
            </Field>
            <Field label="Parecer tecnico" className="xl:col-span-2">
              <textarea
                value={form.parecer_tecnico}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, parecer_tecnico: e.target.value }))
                }
                className={`${inputClass} min-h-[120px]`}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Panel
              title="Anexos"
              subtitle="Aceita mais de uma foto ou video do teste em campo."
            >
              <AttachmentInput
                existingUrls={existingAttachments}
                onExistingUrlsChange={setExistingAttachments}
                newFiles={newFiles}
                onNewFilesChange={setNewFiles}
                helperText="Selecione quantas fotos e videos precisar."
              />
            </Panel>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <ActionButton onClick={onClose}>Cancelar</ActionButton>
            <ActionButton
              type="submit"
              tone="blue"
              disabled={saving}
              className={saving ? "opacity-60" : ""}
            >
              {saving ? "Salvando..." : item ? "Atualizar teste" : "Criar teste"}
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function TesteDetail({ item }) {
  if (!item) return null;
  const meta = deriveTesteMeta(item);
  const kmRodado =
    safeNumber(item.km_atual) !== null && safeNumber(item.km_inicial) !== null
      ? Math.max(Number(item.km_atual) - Number(item.km_inicial), 0)
      : null;

  return (
    <Panel
      title={`${item.nome_teste} · ${item.prefixo || "Sem prefixo"}`}
      subtitle={`${item.numero_controle || "Sem controle"} · Aberto por ${
        item.aberto_por_nome || "—"
      } em ${formatDateTimeBR(item.created_at)}`}
      actions={
        <div className="flex flex-wrap gap-2">
          <StatusChip label={meta.status} tone={meta.concluido ? "emerald" : "amber"} />
          <StatusChip label={meta.fase} tone={meta.tone} />
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <Detail label="Controle" value={item.numero_controle} />
          <Detail label="Peca" value={item.peca} />
          <Detail label="Codigo" value={item.codigo_peca} />
          <Detail label="Fornecedor" value={item.fornecedor} />
          <Detail label="Prefixo" value={item.prefixo} />
          <Detail label="Inicio" value={formatDateBR(item.data_inicio)} />
          <Detail label="KM inicial" value={formatKm(item.km_inicial)} />
          <Detail label="KM atual" value={formatKm(item.km_atual)} />
          <Detail label="KM rodado" value={kmRodado !== null ? formatKm(kmRodado) : "—"} />
          <Detail label="Prazo" value={formatDateBR(item.prazo_teste)} />
          <Detail label="Resultado" value={item.resultado_final || "Em aberto"} />
          <Detail label="Falha" value={item.falha_registrada ? "Sim" : "Nao"} />
          <Detail label="KM da falha" value={formatKm(item.km_falha)} />
        </div>

        <div className="space-y-4">
          <Block title="Objetivo" text={item.objetivo} />
          <Block title="Observacao" text={item.observacao} />
          <Block title="Parecer tecnico" text={item.parecer_tecnico} />
          {item.falha_registrada ? (
            <Block title="Descricao da falha" text={item.descricao_falha} />
          ) : null}
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
              Anexos
            </p>
            <div className="mt-3">
              <AttachmentGallery urls={item.anexos} />
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

export default function SuprimentosTestes() {
  const { user } = useContext(AuthContext);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  async function carregar() {
    setLoading(true);
    setErrorMessage("");
    const { data, error } = await supabase
      .from("suprimentos_testes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("SuprimentosTestes:", error);
      setRows([]);
      setErrorMessage(error.message || "Erro ao carregar testes.");
    } else {
      setRows(
        (data || []).map((row) => ({
          ...row,
          anexos: Array.isArray(row?.anexos) ? row.anexos : [],
        }))
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const meta = deriveTesteMeta(row);
      const statusOk = statusFilter === "todos" ? true : meta.status === statusFilter;
      const searchOk = matchesSearch(row, search, [
        "numero_controle",
        "nome_teste",
        "peca",
        "codigo_peca",
        "fornecedor",
        "prefixo",
        "aberto_por_nome",
      ]);
      return statusOk && searchOk;
    });
  }, [rows, search, statusFilter]);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) || filteredRows[0] || null,
    [filteredRows, rows, selectedId]
  );

  const cards = useMemo(() => {
    const ativos = rows.filter((row) => deriveTesteMeta(row).status === "Ativo");
    const concluidos = rows.filter(
      (row) => deriveTesteMeta(row).status === "Concluído"
    );
    const aprovados = rows.filter((row) => row.resultado_final === "Aprovado");
    const reprovados = rows.filter((row) => row.resultado_final === "Reprovado");
    const comFalha = rows.filter((row) => row.falha_registrada);
    const kmTotal = ativos.reduce((sum, row) => {
      const inicial = Number(row.km_inicial || 0);
      const atual = Number(row.km_atual || 0);
      return sum + Math.max(atual - inicial, 0);
    }, 0);
    return { ativos, concluidos, aprovados, reprovados, comFalha, kmTotal };
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Suprimentos"
        title="Testes"
        description="Acompanhe o comportamento da peca em campo, a quilometragem rodada e o parecer tecnico ate a decisao final de compra."
        actions={
          <>
            <ActionButton onClick={carregar}>
              <FaRedo /> Atualizar
            </ActionButton>
            <ActionButton
              tone="blue"
              onClick={() => {
                setEditingItem(null);
                setEditorOpen(true);
              }}
            >
              <FaPlus /> Novo teste
            </ActionButton>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          title="Testes ativos"
          value={cards.ativos.length}
          subtitle="Em campo e sem encerramento final"
          icon={<FaFlask />}
          tone="amber"
        />
        <KpiCard
          title="Testes concluidos"
          value={cards.concluidos.length}
          subtitle="Com parecer e encerramento"
          icon={<FaFlagCheckered />}
          tone="emerald"
        />
        <KpiCard
          title="Aprovados"
          value={cards.aprovados.length}
          subtitle="Liberados para seguir ou comprar"
          icon={<FaCheckCircle />}
          tone="cyan"
        />
        <KpiCard
          title="Reprovados"
          value={cards.reprovados.length}
          subtitle="Sem aderencia tecnica"
          icon={<FaTimesCircle />}
          tone="rose"
        />
        <KpiCard
          title="Com falha"
          value={cards.comFalha.length}
          subtitle="Falhas ja registradas no teste"
          icon={<FaBug />}
          tone="violet"
        />
        <KpiCard
          title="KM em teste"
          value={`${cards.kmTotal.toLocaleString("pt-BR")} km`}
          subtitle="Rodagem acumulada dos testes ativos"
          icon={<FaRoute />}
          tone="blue"
        />
      </section>

      <Panel
        title="Central de testes"
        subtitle="Use a busca para encontrar rapidamente o teste, o prefixo e o responsavel pela abertura."
      >
        <div className="grid gap-3 border-b border-slate-100 pb-4 lg:grid-cols-[1.2fr_0.45fr_0.25fr]">
          <label className="relative block">
            <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar controle, teste, peca, fornecedor ou prefixo..."
              className={`${inputClass} pl-11`}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              Situacao
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={inputClass}
            >
              <option value="todos">Todos</option>
              <option value="Ativo">Ativos</option>
              <option value="Concluído">Concluidos</option>
            </select>
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
              Na tela
            </p>
            <p className="mt-2 text-2xl font-black text-slate-900">{filteredRows.length}</p>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="py-16 text-center text-sm font-semibold text-slate-500">
            Carregando testes...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title="Nenhum teste encontrado"
              subtitle="Abra um teste novo para comecar a acompanhar a peca em campo."
            />
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    <th className="px-4 py-3">Controle</th>
                    <th className="px-4 py-3">Teste</th>
                    <th className="px-4 py-3">Peca</th>
                    <th className="px-4 py-3">Prefixo</th>
                    <th className="px-4 py-3">Quilometragem</th>
                    <th className="px-4 py-3">Situacao</th>
                    <th className="px-4 py-3">Aberto por</th>
                    <th className="px-4 py-3 text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const meta = deriveTesteMeta(row);
                    const kmRodado =
                      safeNumber(row.km_atual) !== null &&
                      safeNumber(row.km_inicial) !== null
                        ? Math.max(Number(row.km_atual) - Number(row.km_inicial), 0)
                        : null;
                    const active = selected?.id === row.id;

                    return (
                      <tr
                        key={row.id}
                        className={`border-t border-slate-100 transition hover:bg-slate-50 ${
                          active ? "bg-blue-50/60" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-black text-slate-700">
                          {row.numero_controle || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedId(row.id)}
                            className="text-left"
                          >
                            <p className="font-black text-slate-900">{row.nome_teste}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {formatDateBR(row.data_inicio)}
                            </p>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-700">{row.peca}</p>
                          <p className="mt-1 text-xs text-slate-500">{row.fornecedor}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {row.prefixo || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-700">
                            {formatKm(row.km_atual || row.km_inicial)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {kmRodado !== null
                              ? `Rodado ${formatKm(kmRodado)}`
                              : "Sem atualizacao"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            <StatusChip
                              label={meta.status}
                              tone={meta.concluido ? "emerald" : "amber"}
                            />
                            <StatusChip label={meta.fase} tone={meta.tone} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-700">
                            {row.aberto_por_nome || "—"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDateBR(row.created_at)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <ActionButton
                              className="px-3 py-2 text-xs"
                              onClick={() => setSelectedId(row.id)}
                            >
                              <FaEye /> Ver
                            </ActionButton>
                            <ActionButton
                              className="px-3 py-2 text-xs"
                              onClick={() => {
                                setEditingItem(row);
                                setEditorOpen(true);
                              }}
                            >
                              <FaEdit /> Editar
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>

      {selected ? <TesteDetail item={selected} /> : null}

      <TesteModal
        open={editorOpen}
        item={editingItem}
        onClose={() => setEditorOpen(false)}
        onSaved={carregar}
        user={user}
      />
    </div>
  );
}
