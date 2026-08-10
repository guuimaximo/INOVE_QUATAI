// Tela de Preventivas — Gerencial (1 linha/carro x planos) + Programacao MANUAL da semana.
// Le ultimo_plano (projeto IMPORTACAO_DADOS) via supabaseDados para o Gerencial/Garantia.
// A Programacao da Semana agora e MANUAL: o usuario "programa" carros a partir do Gerencial;
// os itens ficam na tabela public.preventivas_programacao (projeto INOVE, via supabase).
// "Feito" e automatico: casa com o realizado da tabela public.preventivas (prefixo + data).
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FaSync, FaSearch, FaTable, FaCalendarWeek, FaExclamationTriangle, FaWrench, FaShieldAlt,
  FaMoon, FaSun, FaPlus, FaTrash, FaChartBar, FaTimes, FaFilePdf,
} from "react-icons/fa";
import { puxarUltimoPlano } from "../../supabaseDados";
import { supabase } from "../../supabase";
import { useTheme } from "../../context/ThemeContext";
import {
  montarCarros, montarGerencial, montarGarantia, ultimaAtualizacao,
  GERENCIAL_COLS, WINDOW_KM, fmtBR,
} from "./preventivasLogic";

// Tacógrafo (plano por prazo): entra junto na revisão se faltam <= 15 dias.
const JANELA_DIAS_TCO = 15;

const CATEGORIAS = ["Revisão", "Inspeção", "Garantia"];
const CAT_COR = {
  "Revisão": "emerald",
  "Inspeção": "indigo",
  "Garantia": "amber",
};

// Data local (BRT), nunca UTC — ver skill inove-playbook.
function toISODateLocal(d) {
  const x = d instanceof Date ? d : new Date(d);
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
// Segunda-feira da semana atual (chave da semana).
function semanaSegunda() {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - dow);
  return toISODateLocal(d);
}
const soDigitos = (s) => String(s || "").replace(/\D/g, "");

function Badge({ dias }) {
  if (dias == null) return <span className="text-gray-400">—</span>;
  const cls =
    dias <= 0 ? "bg-red-100 text-red-700" :
    dias <= 15 ? "bg-amber-100 text-amber-700" :
    "bg-emerald-100 text-emerald-700";
  const txt = dias <= 0 ? `venc ${-dias}d` : `${dias}d`;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{txt}</span>;
}

export default function PCM_PreventivasPlano() {
  const { dark, toggleDark } = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [aba, setAba] = useState("gerencial");
  const [busca, setBusca] = useState("");

  // Programacao manual (tabela preventivas_programacao) + realizadas (tabela preventivas).
  const semana = useMemo(() => semanaSegunda(), []);
  const [progItems, setProgItems] = useState([]);
  const [realizadas, setRealizadas] = useState([]);
  const [modal, setModal] = useState(null); // { prefixo }
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      const [data, prog, real] = await Promise.all([
        puxarUltimoPlano(),
        supabase
          .from("preventivas_programacao")
          .select("*")
          .eq("semana", semana)
          .order("data_planejada", { ascending: true }),
        // realizadas recentes p/ casar o "feito" (ultimos 60 dias)
        supabase
          .from("preventivas")
          .select("prefixo,tipo,data_realizacao")
          .gte("data_realizacao", toISODateLocal(new Date(Date.now() - 60 * 86400000))),
      ]);
      setRows(data);
      if (!prog.error) setProgItems(prog.data || []);
      if (!real.error) setRealizadas(real.data || []);
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [semana]);

  useEffect(() => { carregar(); }, [carregar]);

  const cars = useMemo(() => (rows.length ? montarCarros(rows) : new Map()), [rows]);
  const gerencial = useMemo(() => (cars.size ? montarGerencial(cars) : null), [cars]);
  const garantia = useMemo(() => (cars.size ? montarGarantia(montarCarros(rows)) : null), [cars, rows]);
  const atualizado = useMemo(() => (rows.length ? ultimaAtualizacao(rows) : null), [rows]);

  // "Feito" automatico: para cada item programado, existe uma preventiva realizada
  // do mesmo prefixo (comparando so digitos) com data_realizacao >= data_planejada.
  const progComStatus = useMemo(() => {
    return progItems.map((it) => {
      const dig = soDigitos(it.prefixo);
      const feito = realizadas.some(
        (r) =>
          soDigitos(r.prefixo) &&
          (soDigitos(r.prefixo) === dig || soDigitos(r.prefixo).endsWith(dig) || dig.endsWith(soDigitos(r.prefixo))) &&
          (!it.data_planejada || String(r.data_realizacao || "") >= String(it.data_planejada))
      );
      return { ...it, feito };
    });
  }, [progItems, realizadas]);

  // Programado por carro (chave = prefixo/veic, igual ao l.veic do Gerencial),
  // para mostrar a data programada como etiqueta na aba Gerencial.
  const progPorCarro = useMemo(() => {
    const m = {};
    for (const it of progComStatus) (m[it.prefixo] || (m[it.prefixo] = [])).push(it);
    for (const k in m)
      m[k].sort((a, b) => (String(a.data_planejada || "") < String(b.data_planejada || "") ? -1 : 1));
    return m;
  }, [progComStatus]);

  // O que trocar junto na revisão (regra do dono): entra todo plano satélite
  // VENCIDO ou a <= 3.000 km de vencer (janela WINDOW_KM). O Tacógrafo (plano por
  // prazo) entra se faltam <= 15 dias. Pula INSP 5.000 / REVISÃO / REV.VENCIDA
  // (esses são "quando fazer", não "o que trocar").
  // Convenção do dado: v >= 0 já vencido; v < 0 => faltam -v (km ou dias).
  const duePorCarro = useMemo(() => {
    const m = {};
    if (!gerencial) return m;
    for (const l of gerencial.linhas) {
      const due = [];
      l.cols.forEach((c, j) => {
        if (j <= 2 || c.v == null) return;
        const col = GERENCIAL_COLS[j];
        const dentro = col.tipo === "dias" ? c.v >= -JANELA_DIAS_TCO : c.v >= -WINDOW_KM;
        if (dentro) due.push(col.t);
      });
      m[l.veic] = due;
    }
    return m;
  }, [gerencial]);

  const linhasFiltradas = useMemo(() => {
    if (!gerencial) return [];
    const q = busca.trim().toLowerCase();
    return q ? gerencial.linhas.filter((l) => l.veic.toLowerCase().includes(q)) : gerencial.linhas;
  }, [gerencial, busca]);

  async function salvarProgramacao({ id, prefixo, categoria, tipo, data_planejada, turno }) {
    setSalvando(true);
    try {
      const dados = {
        prefixo,
        categoria,
        tipo: tipo || null,
        data_planejada: data_planejada || null,
        turno: turno || "Dia",
      };
      const { error } = id
        ? await supabase
            .from("preventivas_programacao")
            .update({ ...dados, atualizado_em: new Date().toISOString() })
            .eq("id", id)
        : await supabase.from("preventivas_programacao").insert({ ...dados, semana });
      if (error) throw error;
      setModal(null);
      const { data } = await supabase
        .from("preventivas_programacao").select("*").eq("semana", semana)
        .order("data_planejada", { ascending: true });
      setProgItems(data || []);
    } catch (e) {
      alert("Erro ao salvar: " + (e.message || e));
    } finally {
      setSalvando(false);
    }
  }

  async function removerProgramacao(id) {
    if (!window.confirm("Remover este item da programação?")) return;
    const { error } = await supabase.from("preventivas_programacao").delete().eq("id", id);
    if (error) { alert("Erro ao remover: " + error.message); return; }
    setProgItems((p) => p.filter((x) => x.id !== id));
  }

  // Arrastar: solta o carro num dia/turno → muda data_planejada e turno.
  async function moverItem(id, novaData, novoTurno) {
    const atual = progItems.find((x) => x.id === id);
    if (!atual) return;
    const turnoAtual = atual.turno || "Dia";
    if (atual.data_planejada === novaData && turnoAtual === novoTurno) return;
    setProgItems((p) => p.map((x) => (x.id === id ? { ...x, data_planejada: novaData, turno: novoTurno } : x)));
    const { error } = await supabase
      .from("preventivas_programacao")
      .update({ data_planejada: novaData, turno: novoTurno, atualizado_em: new Date().toISOString() })
      .eq("id", id);
    if (error) { alert("Erro ao mover: " + error.message); carregar(); }
  }

  async function baixarPDF() {
    const el = document.getElementById("prog-print");
    if (!el) return;
    try {
      const [{ default: html2canvas }, jspdfMod] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const jsPDF = jspdfMod.jsPDF || jspdfMod.default;
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(img, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`programacao_semana_${semana}.pdf`);
    } catch (e) {
      alert("Erro ao gerar PDF: " + (e.message || e));
    }
  }

  const hoje = new Date();
  const atrasoDias = atualizado ? Math.round((hoje - atualizado) / 86400000) : null;
  const frescor =
    atrasoDias == null ? { cls: "bg-gray-100 text-gray-600", txt: "—" } :
    atrasoDias <= 1 ? { cls: "bg-emerald-100 text-emerald-700", txt: "dado do dia" } :
    atrasoDias <= 3 ? { cls: "bg-amber-100 text-amber-700", txt: `${atrasoDias} dias atrás` } :
    { cls: "bg-red-100 text-red-700", txt: `${atrasoDias} dias atrás` };

  return (
    <div className="w-full max-w-[98vw] 2xl:max-w-[1800px] mx-auto p-4 md:p-6 space-y-5">
      {/* Cabecalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white grid place-items-center">
            <FaWrench className="text-lg" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 leading-tight">Preventivas</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Garagem Quataí (046) · plano vs. programação</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${frescor.cls}`}>
            Sistema até {atualizado ? fmtBR(atualizado) : "—"} · {frescor.txt}
          </span>
          <button
            onClick={toggleDark}
            title={dark ? "Modo claro" : "Modo escuro"}
            aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
            className="w-9 h-9 grid place-items-center rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-amber-300 transition"
          >
            {dark ? <FaSun /> : <FaMoon />}
          </button>
          <button
            onClick={carregar}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-100 text-sm font-medium transition"
          >
            <FaSync className={loading ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
        {[
          ["gerencial", "Gerencial", FaTable],
          ["programacao", "Programação da Semana", FaCalendarWeek],
          ["resumo", "Resumo", FaChartBar],
          ["garantia", "Garantia", FaShieldAlt],
        ].map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setAba(k)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              aba === k
                ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            <Icon /> {label}
          </button>
        ))}
      </div>

      {erro && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 text-red-700 text-sm">
          <FaExclamationTriangle /> Erro ao carregar: {erro}
        </div>
      )}
      {loading && (
        <div className="grid place-items-center py-20 text-gray-400">
          <FaSync className="animate-spin text-3xl mb-3" />
          <p className="text-sm">Carregando planos…</p>
        </div>
      )}

      {!loading && !erro && aba === "gerencial" && gerencial && (
        <Gerencial
          linhas={linhasFiltradas}
          busca={busca}
          setBusca={setBusca}
          total={gerencial.linhas.length}
          prog={progPorCarro}
          onProgramar={(prefixo) => setModal({ prefixo })}
        />
      )}

      {!loading && !erro && aba === "programacao" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={baixarPDF}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition"
            >
              <FaFilePdf /> Baixar PDF
            </button>
          </div>
          <div id="prog-print" className="bg-white dark:bg-gray-900 rounded-xl p-3">
            <Programacao
              itens={progComStatus}
              onRemover={removerProgramacao}
              onMover={moverItem}
              onEditar={(it) => setModal(it)}
              semana={semana}
              duePorCarro={duePorCarro}
            />
          </div>
        </div>
      )}

      {!loading && !erro && aba === "resumo" && gerencial && (
        <Resumo aderencia={gerencial.aderencia} itens={progComStatus} />
      )}

      {!loading && !erro && aba === "garantia" && garantia && <Garantia itens={garantia} />}

      {modal && (
        <ProgramarModal
          item={modal}
          salvando={salvando}
          onClose={() => setModal(null)}
          onSalvar={salvarProgramacao}
        />
      )}
    </div>
  );
}

/* ===================== MODAL PROGRAMAR ===================== */
function ProgramarModal({ item, salvando, onClose, onSalvar }) {
  const editando = !!item.id;
  const prefixo = item.prefixo;
  const [categoria, setCategoria] = useState(item.categoria || "Revisão");
  const [tipo, setTipo] = useState(item.tipo || "");
  const [data, setData] = useState(item.data_planejada || toISODateLocal(new Date()));
  const [turno, setTurno] = useState(item.turno || "Dia");
  const inputCls =
    "w-full rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500";
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">{editando ? "Editar preventiva" : "Programar preventiva"}</div>
            <div className="text-lg font-black text-gray-900 dark:text-gray-100">Carro {prefixo}</div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600"><FaTimes /></button>
        </div>
        <div className="p-5 space-y-4">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Categoria</span>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={`${inputCls} mt-1`}>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Tipo (opcional)</span>
            <input value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Ex.: Preventiva 10.000, Óleo motor…" className={`${inputCls} mt-1`} />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Data planejada</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <div className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Turno</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {[["Dia", "☀️ Dia"], ["Noite", "🌙 Noite"]].map(([v, txt]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTurno(v)}
                  className={`px-3 py-2 rounded-lg text-sm font-bold border transition ${
                    turno === v
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-emerald-400"
                  }`}
                >
                  {txt}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800">Cancelar</button>
          <button
            disabled={salvando}
            onClick={() => onSalvar({ id: item.id, prefixo, categoria, tipo: tipo.trim(), data_planejada: data, turno })}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60"
          >
            {salvando ? "Salvando…" : editando ? "Salvar" : "Programar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== GARANTIA ===================== */
function Garantia({ itens }) {
  const pend = itens.filter((g) => !g.done).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold dark:bg-amber-900/40 dark:text-amber-300">
          {pend} a chamar
        </span>
        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold dark:bg-emerald-900/40 dark:text-emerald-300">
          {itens.length - pend} feitos
        </span>
        <span>Revisão 60.000 na concessionária · &quot;Chamar em&quot; já desconta o save de 500 km.</span>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
        <div className="overflow-auto max-h-[72vh]">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                {["Veículo", "Odômetro", "Falta p/ 60k", "km/dia", "Vence 60k", "Chamar em", "Status"].map((h, i) => (
                  <th
                    key={h}
                    className={`sticky top-0 bg-[#8a4b12] text-white font-semibold text-[11px] uppercase tracking-wide px-3 py-2.5 whitespace-nowrap ${
                      i === 0 ? "text-left" : "text-center"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.map((g, i) => {
                const zebra = i % 2 === 1;
                const zbg = g.done
                  ? "bg-emerald-50 dark:bg-emerald-900/20"
                  : zebra
                  ? "bg-[#fdf6ef] dark:bg-gray-800/50"
                  : "bg-white dark:bg-gray-800";
                return (
                  <tr key={g.veic} className="border-b border-gray-100 dark:border-gray-700/60">
                    <td className={`px-3 py-2.5 font-bold text-gray-800 dark:text-gray-100 ${zbg}`}>
                      {g.veic}
                      <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-900 dark:bg-amber-800/50 dark:text-amber-200 font-semibold">
                        {g.milestone / 1000}k
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 text-center tabular-nums text-gray-600 dark:text-gray-300 ${zbg}`}>
                      {g.odom.toLocaleString("pt-BR")}
                    </td>
                    <td className={`px-3 py-2.5 text-center tabular-nums text-gray-600 dark:text-gray-300 ${zbg}`}>
                      {g.falta.toLocaleString("pt-BR")}
                    </td>
                    <td className={`px-3 py-2.5 text-center tabular-nums text-gray-500 ${zbg}`}>{g.kmdia}</td>
                    <td className={`px-3 py-2.5 text-center text-gray-500 ${zbg}`}>{g.done ? "—" : g.vence}</td>
                    <td className={`px-3 py-2.5 text-center font-bold ${g.done ? "text-gray-400" : "text-emerald-700 dark:text-emerald-400"} ${zbg}`}>
                      {g.done ? "—" : g.alvo}
                    </td>
                    <td className={`px-3 py-2.5 text-center ${zbg}`}>
                      {g.done ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                          OK ✓
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          PROGRAMAR
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ===================== GERENCIAL ===================== */
const fmtNum = (v) =>
  v == null || v === "" ? "" : typeof v === "number" ? v.toLocaleString("pt-BR") : v;

const fmtDia = (iso) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "s/data");

// Categoria "dominante" de um carro programado (prioridade Revisão > Inspeção >
// Garantia) e o tom de fundo da linha no Gerencial.
const catDaLinha = (items) => {
  if (!items || !items.length) return null;
  for (const c of ["Revisão", "Inspeção", "Garantia"])
    if (items.some((p) => p.categoria === c)) return c;
  return items[0].categoria;
};
const tintLinha = (cat) =>
  cat === "Revisão"
    ? "bg-orange-100 dark:bg-orange-900"
    : cat === "Inspeção"
    ? "bg-yellow-100 dark:bg-yellow-900"
    : cat === "Garantia"
    ? "bg-green-100 dark:bg-green-900"
    : null;

function Gerencial({ linhas, busca, setBusca, total, prog = {}, onProgramar }) {
  const [sort, setSort] = useState({ key: null, dir: -1 });
  const clicar = (key) =>
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: -1 }));

  const ordenadas = useMemo(() => {
    if (sort.key == null) return linhas;
    const val = (l) => {
      if (sort.key === "veic") return l.veic;
      if (sort.key === "ult") return l.dataUlt;
      const c = l.cols[sort.key];
      return typeof c.v === "number" ? c.v : c.venc ? 0 : -1e9;
    };
    return [...linhas].sort((a, b) => {
      const x = val(a), y = val(b);
      return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
    });
  }, [linhas, sort]);

  const seta = (key) => (sort.key === key ? (sort.dir === -1 ? " ▼" : " ▲") : "");
  const thBase =
    "sticky top-0 z-10 bg-[#0f5d4a] text-white font-semibold text-[10px] uppercase tracking-wide px-1.5 py-2.5 text-center whitespace-nowrap cursor-pointer select-none hover:bg-[#0c4e3e] transition";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar veículo (ex: 2224)"
            className="pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-800 text-sm w-64 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <span className="text-xs text-gray-500">
          {linhas.length} de {total} veículos · <span className="text-red-600 font-semibold">vermelho = vencido</span> · clique no cabeçalho p/ ordenar · <span className="text-emerald-700 font-semibold">+</span> programa a semana · <span className="text-emerald-700 font-semibold">etiqueta</span> = data programada (verde = feita)
        </span>
      </div>

      <div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
          <div className="overflow-auto max-h-[72vh]">
            <table className="border-separate border-spacing-0 text-[12.5px] w-full">
              <thead>
                <tr>
                  <th className={`${thBase} sticky left-0 z-20`}></th>
                  <th onClick={() => clicar("veic")} className={`${thBase} text-left pl-2 min-w-[92px]`}>
                    Prefixo{seta("veic")}
                  </th>
                  <th onClick={() => clicar("ult")} className={thBase}>
                    Últ.<span className="block text-[9px] opacity-75 font-normal normal-case">revisão{seta("ult")}</span>
                  </th>
                  {GERENCIAL_COLS.map((c, idx) => {
                    const p = c.t.split(" ");
                    return (
                      <th key={c.t} onClick={() => clicar(idx)} className={thBase}>
                        {p[0]}
                        {p[1] && <span className="block text-[9px] opacity-75 font-normal">{p.slice(1).join(" ")}</span>}
                        {seta(idx)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((l, i) => {
                  const zebra = i % 2 === 1;
                  const zbg = zebra ? "bg-[#f8fafb] dark:bg-gray-800/40" : "";
                  const tint = tintLinha(catDaLinha(prog[l.veic]));
                  const stickyBg = tint || (zebra ? "bg-[#f8fafb] dark:bg-gray-800" : "bg-white dark:bg-gray-800");
                  return (
                    <tr key={l.veic} className="group">
                      <td className={`sticky left-0 z-[5] px-1 py-1 text-center border-r border-gray-100 border-b border-gray-100 dark:border-gray-800 ${stickyBg} group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20`}>
                        <button
                          onClick={() => onProgramar(l.veic)}
                          title="Programar este carro na semana"
                          className="w-6 h-6 grid place-items-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          <FaPlus className="text-[10px]" />
                        </button>
                      </td>
                      <td
                        className={`sticky left-8 z-[5] pl-2 pr-2 py-2 text-left font-bold text-[#0f5d4a] dark:text-emerald-300 border-r border-gray-200 dark:border-gray-700 border-b border-gray-100 dark:border-gray-800 ${stickyBg} group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20`}
                        style={{ boxShadow: "2px 0 4px -2px rgba(0,0,0,.08)" }}
                      >
                        {l.veic}
                        {(prog[l.veic] || []).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {prog[l.veic].map((p) => (
                              <span
                                key={p.id}
                                title={`${p.categoria}${p.tipo ? " · " + p.tipo : ""} — ${p.feito ? "feito" : "programado"}${p.data_planejada ? " p/ " + fmtDia(p.data_planejada) : ""}`}
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold leading-none text-[9px] ${
                                  p.feito
                                    ? "bg-emerald-600 text-white"
                                    : p.categoria === "Revisão"
                                    ? "bg-orange-500 text-white"
                                    : p.categoria === "Inspeção"
                                    ? "bg-yellow-400 text-yellow-900"
                                    : "bg-green-600 text-white"
                                }`}
                              >
                                {p.feito && "✓"}
                                {fmtDia(p.data_planejada)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className={`px-1.5 py-2 text-center text-[11px] text-gray-400 border-b border-gray-100 dark:border-gray-800 ${tint || zbg} group-hover:bg-emerald-50/60`}>
                        {l.dataUlt}
                      </td>
                      {l.cols.map((cell, j) => (
                        <td
                          key={j}
                          className={`px-1.5 py-2 text-center tabular-nums border-b border-gray-100 dark:border-gray-800 ${
                            cell.venc
                              ? "bg-red-50 text-red-700 font-bold dark:bg-red-900/40 dark:text-red-300"
                              : `text-gray-600 dark:text-gray-300 ${tint || zbg}`
                          } group-hover:bg-emerald-50/60`}
                        >
                          {cell.texto === null || cell.texto === "" ? <span className="text-gray-300">·</span> : fmtNum(cell.texto)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== PROGRAMACAO (MANUAL — visual de cards por dia) ===================== */
const DOW = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
function diasUteis(segundaISO) {
  const base = new Date(segundaISO + "T00:00:00");
  const hojeISO = toISODateLocal(new Date());
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = toISODateLocal(d);
    return {
      iso,
      label: DOW[d.getDay()],
      dm: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      hoje: iso === hojeISO,
    };
  });
}

// Cor da etiqueta da categoria (escrita por extenso ao lado do carro).
const COR_CAT = {
  "Revisão": "bg-orange-500 text-white",
  "Inspeção": "bg-yellow-400 text-yellow-900",
  "Garantia": "bg-green-600 text-white",
};

function ItemCarro({ it, onRemover, onEditar }) {
  const cor = COR_CAT[it.categoria] || "bg-gray-400 text-white";
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", it.id); e.dataTransfer.effectAllowed = "move"; }}
      onClick={() => onEditar?.(it)}
      title="Clique para editar · arraste para mover"
      className={`group/i px-3 py-2.5 flex items-start justify-between gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 ${it.feito ? "bg-emerald-100 dark:bg-emerald-900/40" : ""}`}
    >
      <div className="min-w-0">
        <span className={`block font-black text-xl leading-tight tabular-nums ${it.feito ? "text-emerald-800 dark:text-emerald-300" : "text-gray-800 dark:text-gray-100"}`}>{it.prefixo}</span>
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase leading-none ${cor}`}>{it.categoria}</span>
          {it.tipo && <span className="text-[12px] font-medium text-gray-600 dark:text-gray-300 truncate">{it.tipo}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {it.feito && <span className="text-emerald-600 dark:text-emerald-400 font-bold text-lg" title="feito">✓</span>}
        <button
          onClick={(e) => { e.stopPropagation(); onRemover(it.id); }}
          title="Remover"
          className="text-gray-300 hover:text-red-600 opacity-0 group-hover/i:opacity-100 transition"
        >
          <FaTrash className="text-xs" />
        </button>
      </div>
    </div>
  );
}

// Card de um dia para UM turno (Dia OU Noite). É alvo de "soltar".
function DiaTurnoCard({ dia, turno, itens, onRemover, onMover, onEditar }) {
  const [over, setOver] = useState(false);
  const doDia = itens.filter(
    (it) => it.data_planejada === dia.iso && (it.turno || "Dia") === turno
  );
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!over) setOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onMover?.(id, dia.iso, turno);
      }}
      className={`rounded-xl border overflow-hidden bg-white dark:bg-gray-800 transition ${over ? "border-emerald-500 ring-2 ring-emerald-400" : "border-gray-200 dark:border-gray-700"}`}
    >
      <div className={`px-3 py-2 text-center text-white ${dia.hoje ? "bg-amber-600" : "bg-slate-700"}`}>
        <div className="text-sm font-bold tracking-wide">{dia.label}</div>
        <div className="text-[11px] opacity-80">{dia.dm}</div>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800 min-h-[40px]">
        {doDia.length === 0 && <div className="px-3 py-3 text-center text-xs text-gray-400 italic">livre</div>}
        {doDia.map((it) => <ItemCarro key={it.id} it={it} onRemover={onRemover} onEditar={onEditar} />)}
      </div>
    </div>
  );
}

function Programacao({ itens, onRemover, onMover, onEditar, semana, duePorCarro = {} }) {
  const dias = useMemo(() => diasUteis(semana), [semana]);
  const porCat = useMemo(() => {
    const m = { "Revisão": [], "Inspeção": [], "Garantia": [] };
    for (const it of itens) (m[it.categoria] || (m[it.categoria] = [])).push(it);
    return m;
  }, [itens]);
  const nFeito = itens.filter((it) => it.feito).length;

  // "O que precisa trocar" agregado das REVISÕES programadas: por serviço, quais
  // carros (cujo item está vencido no Gerencial). É o "serviços que vão junto".
  const servicos = useMemo(() => {
    const map = new Map();
    for (const it of porCat["Revisão"] || []) {
      for (const s of duePorCarro[it.prefixo] || []) {
        if (!map.has(s)) map.set(s, new Set());
        map.get(s).add(it.prefixo);
      }
    }
    return [...map.entries()]
      .map(([nome, set]) => ({ nome, carros: [...set].sort() }))
      .sort((a, b) => b.carros.length - a.carros.length);
  }, [porCat, duePorCarro]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["Revisões", (porCat["Revisão"] || []).length, "emerald"],
          ["Inspeção", (porCat["Inspeção"] || []).length, "indigo"],
          ["Garantia", (porCat["Garantia"] || []).length, "amber"],
          ["Feitas na semana", nFeito, "gray"],
        ].map(([l, n, c]) => (
          <div key={l} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800">
            <div
              className={`text-2xl font-bold ${
                c === "emerald"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : c === "indigo"
                  ? "text-indigo-700 dark:text-indigo-400"
                  : c === "amber"
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-gray-700 dark:text-gray-200"
              }`}
            >
              {n}
            </div>
            <div className="text-xs text-gray-500">{l}</div>
          </div>
        ))}
      </div>

      {itens.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-400">
          Nenhuma preventiva programada nesta semana. Use o <span className="font-bold text-emerald-600">+</span> no Gerencial para montar a programação.
        </div>
      )}

      {itens.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1"><span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-orange-500 text-white">Revisão</span></span>
            <span className="inline-flex items-center gap-1"><span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-yellow-400 text-yellow-900">Inspeção</span></span>
            <span className="inline-flex items-center gap-1"><span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-green-600 text-white">Garantia</span></span>
            <span className="text-gray-400">· arraste o carro para mover entre dias e entre Dia/Noite</span>
          </div>

          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">
              ☀️ Dia
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {dias.map((d) => (
                <DiaTurnoCard key={"dia-" + d.iso} dia={d} turno="Dia" itens={itens} onRemover={onRemover} onMover={onMover} onEditar={onEditar} />
              ))}
            </div>
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
              🌙 Noite
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {dias.map((d) => (
                <DiaTurnoCard key={"noite-" + d.iso} dia={d} turno="Noite" itens={itens} onRemover={onRemover} onMover={onMover} onEditar={onEditar} />
              ))}
            </div>
          </section>
        </>
      )}

      {servicos.length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-1">
            Serviços que vão junto — o que trocar nas revisões
          </h3>
          <p className="text-[11px] text-gray-400 mb-2">
            Satélites vencidos ou a ≤ {WINDOW_KM.toLocaleString("pt-BR")} km de vencer (Tacógrafo: ≤ {JANELA_DIAS_TCO} dias).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {servicos.map((b) => (
              <div key={b.nome} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800">
                <div className="text-[11px] font-bold uppercase text-indigo-700 dark:text-indigo-400 mb-1">
                  {b.nome} <span className="text-gray-400 font-semibold">· {b.carros.length}</span>
                </div>
                <div className="text-xs text-gray-700 dark:text-gray-300 tabular-nums">{b.carros.join(" · ")}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ===================== RESUMO ===================== */
function Resumo({ aderencia, itens }) {
  const porCat = useMemo(() => {
    const m = {};
    for (const c of CATEGORIAS) m[c] = { total: 0, feito: 0 };
    for (const it of itens) {
      const b = m[it.categoria] || (m[it.categoria] = { total: 0, feito: 0 });
      b.total += 1;
      if (it.feito) b.feito += 1;
    }
    return m;
  }, [itens]);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Programação da semana — planejado × feito</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CATEGORIAS.map((c) => {
            const b = porCat[c] || { total: 0, feito: 0 };
            const pct = b.total ? (b.feito / b.total) * 100 : null;
            const cor = CAT_COR[c];
            return (
              <div key={c} className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
                <div className={`text-xs font-bold uppercase ${cor === "emerald" ? "text-emerald-700" : cor === "indigo" ? "text-indigo-700" : "text-amber-800"}`}>{c === "Revisão" ? "Revisões" : c}</div>
                <div className="mt-1 text-2xl font-black text-gray-800 dark:text-gray-100">{pct == null ? "—" : `${pct.toFixed(0)}%`}</div>
                <div className="text-xs text-gray-500">{b.feito}/{b.total} feitas</div>
                <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct ?? 0}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Aderência por item (do plano)</h3>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {aderencia.map((a) => {
            const pct = a.adr == null ? null : a.adr * 100;
            return (
              <div key={a.nome} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] text-gray-700 dark:text-gray-300">{a.nome}</span>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{pct == null ? "—" : `${pct.toFixed(1)}%`}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct ?? 0}%` }} />
                  </div>
                  <span className={`text-[11px] tabular-nums ${a.atrasadas ? "text-red-600 font-semibold" : "text-gray-400"}`}>{a.atrasadas}/{a.total}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
