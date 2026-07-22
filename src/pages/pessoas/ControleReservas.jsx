import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  FaClock,
  FaExclamationTriangle,
  FaFilter,
  FaPlus,
  FaSave,
  FaSearch,
  FaSync,
  FaTimes,
  FaTrash,
  FaUserClock,
  FaUsers,
} from "react-icons/fa";

import { AuthContext } from "../../context/AuthContext";
import { supabase } from "../../supabase";
import { supabaseBCNT } from "../../supabaseBCNT";

const FIELD_INPUT =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function safeText(value) {
  return String(value || "").trim();
}

function todayIso() {
  // Data local (BRT), nunca UTC: toISOString() joga o dia pra frente depois das 21h.
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function currentMonthKey() {
  return todayIso().slice(0, 7);
}

function formatDateBR(value) {
  const text = safeText(value);
  if (!text) return "-";
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [year, month, day] = text.slice(0, 10).split("-");
    return `${day}/${month}/${year}`;
  }
  return text;
}

function formatDateTimeBR(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function formatHora(value) {
  const text = safeText(value);
  if (!text) return "-";
  return text.slice(0, 5);
}

// Minutos entre entrada e saida; se a saida for menor, assume que virou o dia
// (turno noturno de reserva, ex.: 22:00 -> 06:00).
function minutosTrabalhados(entrada, saida) {
  const e = safeText(entrada);
  const s = safeText(saida);
  if (!e || !s) return null;
  const [h1, m1] = e.split(":").map(Number);
  const [h2, m2] = s.split(":").map(Number);
  if ([h1, m1, h2, m2].some((n) => Number.isNaN(n))) return null;
  let mins = h2 * 60 + m2 - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60;
  return mins;
}

function formatHoras(mins) {
  if (mins == null) return "-";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h && !m) return "0h";
  return `${h}h${m ? ` ${String(m).padStart(2, "0")}min` : ""}`;
}

async function fetchReservas() {
  const { data, error } = await supabase
    .from("reservas_motoristas")
    .select("*")
    .order("data_referencia", { ascending: false })
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function fetchMotoristas() {
  const pageSize = 1000;
  const rows = [];
  let start = 0;
  while (true) {
    const { data, error } = await supabaseBCNT
      .from("funcionarios_atualizada")
      .select("id_funcionario, nr_cracha, nm_funcionario, nm_funcao, status")
      .order("nm_funcionario", { ascending: true })
      .range(start, start + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    start += pageSize;
  }
  // So motoristas: a reserva e sempre de motorista a disposicao. Se o cadastro
  // usar outro rotulo de funcao e o filtro nao achar ninguem, cai pra lista
  // completa para o modulo nunca ficar inutilizavel.
  const motoristas = rows.filter((f) => normalizeText(f.nm_funcao).includes("motorista"));
  return motoristas.length ? motoristas : rows;
}

function CardKPI({ titulo, valor, sub, cor = "slate", icon }) {
  const styles = {
    slate: "border-slate-200 bg-slate-50 text-slate-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 ${styles[cor] || styles.slate}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70">{titulo}</div>
        {icon ? <span className="text-base opacity-60">{icon}</span> : null}
      </div>
      <div className="mt-1 text-2xl font-black">{valor}</div>
      {sub ? <div className="mt-0.5 text-[11px] opacity-75">{sub}</div> : null}
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
      {hint ? <span className="text-[10px] text-slate-400">{hint}</span> : null}
    </label>
  );
}

function formVazio() {
  return {
    data_referencia: todayIso(),
    hora_entrada: "",
    hora_saida: "",
    cobertura: "",
    observacao: "",
  };
}

function ReservaModal({ open, onClose, onSave, saving, motoristas, editar }) {
  const [buscaFunc, setBuscaFunc] = useState("");
  const [funcionario, setFuncionario] = useState(null);
  const [showLista, setShowLista] = useState(false);
  const [form, setForm] = useState(formVazio());
  const buscaRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (editar) {
      setFuncionario({
        id_funcionario: editar.funcionario_id,
        nr_cracha: editar.funcionario_cracha,
        nm_funcionario: editar.funcionario_nome,
        nm_funcao: editar.funcionario_funcao,
      });
      setBuscaFunc(`${editar.funcionario_nome || ""} — ${editar.funcionario_cracha || "sem chapa"}`);
      setForm({
        data_referencia: editar.data_referencia || todayIso(),
        hora_entrada: formatHora(editar.hora_entrada) === "-" ? "" : formatHora(editar.hora_entrada),
        hora_saida: formatHora(editar.hora_saida) === "-" ? "" : formatHora(editar.hora_saida),
        cobertura: editar.cobertura || "",
        observacao: editar.observacao || "",
      });
    } else {
      setFuncionario(null);
      setBuscaFunc("");
      setForm(formVazio());
    }
    setShowLista(false);
  }, [open, editar]);

  const motoristasFiltrados = useMemo(() => {
    const termo = normalizeText(buscaFunc);
    if (!termo) return motoristas.slice(0, 30);
    return motoristas
      .filter((f) => normalizeText(`${f.nm_funcionario} ${f.nr_cracha} ${f.nm_funcao}`).includes(termo))
      .slice(0, 30);
  }, [buscaFunc, motoristas]);

  const minutos = minutosTrabalhados(form.hora_entrada, form.hora_saida);

  if (!open) return null;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selecionarFuncionario(f) {
    setFuncionario(f);
    setBuscaFunc(`${f.nm_funcionario} — ${f.nr_cracha || "sem chapa"}`);
    setShowLista(false);
  }

  function handleSalvar() {
    if (!funcionario) {
      window.alert("Selecione o motorista.");
      return;
    }
    if (!form.data_referencia) {
      window.alert("Informe o dia.");
      return;
    }
    onSave({ funcionario, form });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 bg-white/80 px-6 py-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">Pessoas · Controle de Reservas</div>
            <div className="mt-1 text-xl font-black text-slate-900">{editar ? "Editar reserva" : "Nova reserva"}</div>
            <div className="text-sm text-slate-500">Motorista de reserva à disposição da empresa no dia.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <FaTimes />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Field label="Motorista" hint="Busque por nome ou chapa (lista só de motoristas).">
            {funcionario ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-900">{funcionario.nm_funcionario}</div>
                  <div className="truncate text-xs text-slate-500">
                    {funcionario.nr_cracha ? `Chapa ${funcionario.nr_cracha}` : "Sem chapa"}
                    {funcionario.nm_funcao ? ` · ${funcionario.nm_funcao}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFuncionario(null);
                    setBuscaFunc("");
                    setShowLista(false);
                    window.setTimeout(() => buscaRef.current?.focus(), 0);
                  }}
                  className="shrink-0 rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  Trocar
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  ref={buscaRef}
                  className={`${FIELD_INPUT} w-full`}
                  value={buscaFunc}
                  placeholder="Buscar por nome ou chapa"
                  onChange={(event) => {
                    setBuscaFunc(event.target.value);
                    setShowLista(true);
                  }}
                  onFocus={() => setShowLista(true)}
                  onBlur={() => window.setTimeout(() => setShowLista(false), 150)}
                />
                {showLista ? (
                  <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {motoristasFiltrados.length ? (
                      motoristasFiltrados.map((f, index) => (
                        <button
                          key={f.id_funcionario || f.nr_cracha || `${f.nm_funcionario}-${index}`}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            selecionarFuncionario(f);
                          }}
                          className="flex w-full flex-col border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                        >
                          <span className="text-sm font-bold text-slate-900">{f.nm_funcionario}</span>
                          <span className="text-xs text-slate-500">
                            {f.nr_cracha ? `Chapa ${f.nr_cracha}` : "Sem chapa"}
                            {f.nm_funcao ? ` · ${f.nm_funcao}` : ""}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-sm text-slate-400">Nenhum motorista encontrado.</div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </Field>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Dia">
              <input
                className={FIELD_INPUT}
                type="date"
                value={form.data_referencia}
                onChange={(event) => updateField("data_referencia", event.target.value)}
              />
            </Field>
            <Field label="Hora de entrada">
              <input
                className={FIELD_INPUT}
                type="time"
                value={form.hora_entrada}
                onChange={(event) => updateField("hora_entrada", event.target.value)}
              />
            </Field>
            <Field label="Hora de saída">
              <input
                className={FIELD_INPUT}
                type="time"
                value={form.hora_saida}
                onChange={(event) => updateField("hora_saida", event.target.value)}
              />
            </Field>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Horas no dia</span>
            <span className="ml-2 font-bold text-slate-800">{formatHoras(minutos)}</span>
            {form.hora_saida && form.hora_entrada && minutos != null && form.hora_saida < form.hora_entrada ? (
              <span className="ml-2 text-[11px] text-amber-600">(vira o dia — turno noturno)</span>
            ) : null}
          </div>

          <Field label="Onde/o que cobriu (opcional)" hint="Ex.: linha 42, garagem, cobriu falta do carro 1234.">
            <input
              className={FIELD_INPUT}
              value={form.cobertura}
              onChange={(event) => updateField("cobertura", event.target.value)}
              placeholder="Veículo, linha ou setor atendido"
            />
          </Field>

          <Field label="Observação (opcional)">
            <textarea
              className={`${FIELD_INPUT} min-h-[80px] resize-y`}
              value={form.observacao}
              onChange={(event) => updateField("observacao", event.target.value)}
              placeholder="Alguma informação relevante do dia."
            />
          </Field>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSalvar}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FaSave />
            {saving ? "Salvando..." : editar ? "Salvar alterações" : "Salvar reserva"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ControleReservas() {
  const { user } = useContext(AuthContext);

  const [reservas, setReservas] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [saving, setSaving] = useState(false);

  const [busca, setBusca] = useState("");
  const [mesFiltro, setMesFiltro] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editar, setEditar] = useState(null);

  async function carregar() {
    setLoading(true);
    setErro("");
    try {
      const [lista, funcs] = await Promise.all([fetchReservas(), fetchMotoristas()]);
      setReservas(lista);
      setMotoristas(funcs);
    } catch (error) {
      console.error(error);
      setErro(error.message || "Falha ao carregar as reservas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtradas = useMemo(() => {
    const termo = normalizeText(busca);
    return reservas.filter((item) => {
      if (mesFiltro && String(item.data_referencia || "").slice(0, 7) !== mesFiltro) return false;
      if (
        termo &&
        !normalizeText(`${item.funcionario_nome} ${item.funcionario_cracha} ${item.cobertura}`).includes(termo)
      ) {
        return false;
      }
      return true;
    });
  }, [reservas, busca, mesFiltro]);

  const kpis = useMemo(() => {
    const mesAtual = currentMonthKey();
    const hoje = todayIso();
    let hojeCount = 0;
    let doMes = 0;
    let minutosMes = 0;
    const motoristasMes = new Set();
    for (const item of reservas) {
      const dia = String(item.data_referencia || "").slice(0, 10);
      if (dia === hoje) hojeCount += 1;
      if (dia.slice(0, 7) === mesAtual) {
        doMes += 1;
        motoristasMes.add(item.funcionario_cracha || item.funcionario_nome || item.id);
        const mins = minutosTrabalhados(item.hora_entrada, item.hora_saida);
        if (mins != null) minutosMes += mins;
      }
    }
    return { hojeCount, doMes, minutosMes, motoristasMes: motoristasMes.size };
  }, [reservas]);

  async function handleSalvar({ funcionario, form }) {
    setSaving(true);
    try {
      const agora = new Date().toISOString();
      const base = {
        funcionario_id: funcionario.id_funcionario || null,
        funcionario_cracha: funcionario.nr_cracha || null,
        funcionario_nome: funcionario.nm_funcionario || null,
        funcionario_funcao: funcionario.nm_funcao || null,
        data_referencia: form.data_referencia || null,
        hora_entrada: safeText(form.hora_entrada) || null,
        hora_saida: safeText(form.hora_saida) || null,
        cobertura: safeText(form.cobertura) || null,
        observacao: safeText(form.observacao) || null,
        atualizado_por_login: user?.login || null,
        atualizado_por_nome: user?.nome || null,
        atualizado_em: agora,
      };
      if (editar?.id) {
        const { error } = await supabase.from("reservas_motoristas").update(base).eq("id", editar.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reservas_motoristas").insert({
          ...base,
          criado_por_login: user?.login || null,
          criado_por_nome: user?.nome || null,
          criado_em: agora,
        });
        if (error) throw error;
      }
      setModalOpen(false);
      setEditar(null);
      await carregar();
    } catch (error) {
      console.error(error);
      window.alert(`Falha ao salvar reserva: ${error.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleExcluir(item) {
    if (!item?.id) return;
    if (!window.confirm(`Excluir a reserva de ${item.funcionario_nome || "motorista"} em ${formatDateBR(item.data_referencia)}?`)) {
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("reservas_motoristas").delete().eq("id", item.id);
      if (error) throw error;
      await carregar();
    } catch (error) {
      console.error(error);
      window.alert(`Falha ao excluir: ${error.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  function abrirNova() {
    setEditar(null);
    setModalOpen(true);
  }

  function abrirEdicao(item) {
    setEditar(item);
    setModalOpen(true);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-2xl font-black text-slate-900">
            <FaUserClock className="text-blue-600" />
            Controle de Reservas
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Motoristas de reserva à disposição da empresa — dia, entrada e saída.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={carregar}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <FaSync className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={abrirNova}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            <FaPlus />
            Nova reserva
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CardKPI titulo="Reservas hoje" valor={kpis.hojeCount} cor="blue" icon={<FaUserClock />} />
        <CardKPI titulo="No mês" valor={kpis.doMes} cor="slate" icon={<FaClock />} />
        <CardKPI titulo="Motoristas no mês" valor={kpis.motoristasMes} cor="emerald" icon={<FaUsers />} />
        <CardKPI titulo="Horas no mês" valor={formatHoras(kpis.minutosMes)} cor="amber" icon={<FaClock />} />
      </div>

      <div className="mt-5 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <FaSearch className="text-slate-400" />
          <input
            className="w-full text-sm text-slate-700 outline-none"
            placeholder="Buscar por nome, chapa ou cobertura"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">
            <FaFilter />
          </span>
          <input
            className={FIELD_INPUT}
            type="month"
            value={mesFiltro}
            onChange={(event) => setMesFiltro(event.target.value)}
          />
        </div>
      </div>

      {erro ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {erro}
        </div>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">Dia</th>
                <th className="px-4 py-3">Entrada</th>
                <th className="px-4 py-3">Saída</th>
                <th className="px-4 py-3">Horas</th>
                <th className="px-4 py-3">Cobertura</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Carregando...
                  </td>
                </tr>
              ) : filtradas.length ? (
                filtradas.map((item) => {
                  const mins = minutosTrabalhados(item.hora_entrada, item.hora_saida);
                  return (
                    <tr
                      key={item.id}
                      className="cursor-pointer hover:bg-slate-50/70"
                      onClick={() => abrirEdicao(item)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{item.funcionario_nome || "-"}</div>
                        <div className="text-xs text-slate-500">
                          {item.funcionario_cracha ? `Chapa ${item.funcionario_cracha}` : "Sem chapa"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatDateBR(item.data_referencia)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatHora(item.hora_entrada)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatHora(item.hora_saida)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{formatHoras(mins)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="max-w-[220px] truncate" title={item.cobertura || ""}>
                          {item.cobertura || "-"}
                        </div>
                        {item.observacao ? (
                          <div className="max-w-[220px] truncate text-xs text-slate-400" title={item.observacao}>
                            {item.observacao}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleExcluir(item);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          title="Excluir reserva"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Nenhuma reserva encontrada. Clique em "Nova reserva" para lançar a primeira.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && filtradas.length ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <FaExclamationTriangle className="text-slate-300" />
          Clique numa linha para editar. Última atualização respeita o fuso local (BRT).
        </div>
      ) : null}

      <ReservaModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditar(null);
        }}
        onSave={handleSalvar}
        saving={saving}
        motoristas={motoristas}
        editar={editar}
      />
    </div>
  );
}
