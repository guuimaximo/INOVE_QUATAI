// Tela de Preventivas — Gerencial (1 linha/carro x planos) + Programacao da semana.
// Le ultimo_plano (projeto IMPORTACAO_DADOS) via supabaseDados.
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FaSync, FaSearch, FaTable, FaCalendarWeek, FaExclamationTriangle, FaWrench, FaShieldAlt,
  FaMoon, FaSun,
} from "react-icons/fa";
import { puxarUltimoPlano } from "../../supabaseDados";
import { useTheme } from "../../context/ThemeContext";
import {
  montarCarros, montarGerencial, montarProgramacao, montarGarantia, ultimaAtualizacao,
  GERENCIAL_COLS, fmtBR,
} from "./preventivasLogic";

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

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      const data = await puxarUltimoPlano();
      setRows(data);
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const cars = useMemo(() => (rows.length ? montarCarros(rows) : new Map()), [rows]);
  const gerencial = useMemo(() => (cars.size ? montarGerencial(cars) : null), [cars]);
  const prog = useMemo(() => (cars.size ? montarProgramacao(montarCarros(rows)) : null), [cars, rows]);
  const garantia = useMemo(() => (cars.size ? montarGarantia(montarCarros(rows)) : null), [cars, rows]);
  const atualizado = useMemo(() => (rows.length ? ultimaAtualizacao(rows) : null), [rows]);

  const linhasFiltradas = useMemo(() => {
    if (!gerencial) return [];
    const q = busca.trim().toLowerCase();
    return q ? gerencial.linhas.filter((l) => l.veic.toLowerCase().includes(q)) : gerencial.linhas;
  }, [gerencial, busca]);

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
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {[
          ["gerencial", "Gerencial", FaTable],
          ["programacao", "Programação da Semana", FaCalendarWeek],
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
          aderencia={gerencial.aderencia}
          busca={busca}
          setBusca={setBusca}
          total={gerencial.linhas.length}
        />
      )}

      {!loading && !erro && aba === "programacao" && prog && <Programacao prog={prog} />}

      {!loading && !erro && aba === "garantia" && garantia && <Garantia itens={garantia} />}
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

function Gerencial({ linhas, aderencia, busca, setBusca, total }) {
  // ordenacao por clique no cabecalho. key: "veic" | "ult" | idx da coluna
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
          {linhas.length} de {total} veículos · <span className="text-red-600 font-semibold">vermelho = vencido</span> · clique no cabeçalho p/ ordenar
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
          <div className="overflow-auto max-h-[72vh]">
            <table className="border-separate border-spacing-0 text-[12.5px] w-full">
              <thead>
                <tr>
                  <th onClick={() => clicar("veic")} className={`${thBase} sticky left-0 z-20 text-left pl-3.5 min-w-[92px]`}>
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
                  return (
                    <tr key={l.veic} className="group">
                      <td
                        className={`sticky left-0 z-[5] pl-3.5 pr-2 py-2 text-left font-bold text-[#0f5d4a] dark:text-emerald-300 border-r border-gray-200 dark:border-gray-700 border-b border-gray-100 dark:border-gray-800 ${
                          zebra ? "bg-[#f8fafb] dark:bg-gray-800" : "bg-white dark:bg-gray-800"
                        } group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20`}
                        style={{ boxShadow: "2px 0 4px -2px rgba(0,0,0,.08)" }}
                      >
                        {l.veic}
                      </td>
                      <td className={`px-1.5 py-2 text-center text-[11px] text-gray-400 border-b border-gray-100 dark:border-gray-800 ${zbg} group-hover:bg-emerald-50/60`}>
                        {l.dataUlt}
                      </td>
                      {l.cols.map((cell, j) => (
                        <td
                          key={j}
                          className={`px-1.5 py-2 text-center tabular-nums border-b border-gray-100 dark:border-gray-800 ${
                            cell.venc
                              ? "bg-red-50 text-red-700 font-bold dark:bg-red-900/40 dark:text-red-300"
                              : `text-gray-600 dark:text-gray-300 ${zbg}`
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

        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden self-start shadow-sm bg-white dark:bg-gray-800">
          <div className="bg-emerald-700 text-white px-4 py-3 font-semibold text-sm">Aderência às Preventivas</div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {aderencia.map((a) => {
              const pct = a.adr == null ? null : a.adr * 100;
              return (
                <div key={a.nome} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] text-gray-700 dark:text-gray-300">{a.nome}</span>
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {pct == null ? "—" : `${pct.toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct ?? 0}%` }} />
                    </div>
                    <span className={`text-[11px] tabular-nums ${a.atrasadas ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                      {a.atrasadas}/{a.total}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== PROGRAMACAO ===================== */
function DiaCard({ dow, data, cars, noite, hoje }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
      <div className={`px-3 py-1.5 text-center text-white ${hoje ? "bg-amber-600" : noite ? "bg-indigo-800" : "bg-emerald-800"}`}>
        <div className="text-xs font-bold">{dow.split("-")[0].toUpperCase()}</div>
        <div className="text-[10px] opacity-80">{data}</div>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {cars.length === 0 && <div className="px-3 py-3 text-center text-xs text-gray-400 italic">livre</div>}
        {cars.map((c) => {
          const venc = c.gat != null && c.gat <= 0;
          return (
            <div key={c.veic} className={`px-3 py-2 flex items-center justify-between gap-2 ${venc ? "bg-red-50 dark:bg-red-900/30" : ""}`}>
              <span className={`font-bold text-sm ${noite ? "text-indigo-700 dark:text-indigo-300" : "text-emerald-800 dark:text-emerald-300"}`}>{c.veic}</span>
              <span className="text-right">
                <Badge dias={c.gat} />
                {c.drv && <span className="ml-1 text-[9px] text-gray-400">{c.drv}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Programacao({ prog }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["Preventivas 10.000", prog.nPrev, "emerald"],
          ["Inspeções 5.000", prog.nInsp, "indigo"],
          ["Dias programados", prog.dias10.length, "gray"],
          ["Serviços conciliados", prog.boxes.length, "gray"],
        ].map(([l, n, c]) => (
          <div key={l} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800">
            <div className={`text-2xl font-bold ${c === "emerald" ? "text-emerald-700 dark:text-emerald-400" : c === "indigo" ? "text-indigo-700 dark:text-indigo-400" : "text-gray-700 dark:text-gray-200"}`}>{n}</div>
            <div className="text-xs text-gray-500">{l}</div>
          </div>
        ))}
      </div>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-2">Preventivas 10.000 — de amanhã até sexta</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {prog.dias10.map((d) => <DiaCard key={"p" + d.data} {...d} />)}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-400 mb-2">Inspeções 5.000 — hoje à noite + até sexta</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <DiaCard dow="HOJE" data={prog.hoje} cars={prog.hoje5} noite hoje />
          {prog.dias5.map((d) => <DiaCard key={"i" + d.data} {...d} noite />)}
        </div>
      </section>

      {prog.boxes.length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Serviços que vão junto nas preventivas</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {prog.boxes.map((b) => (
              <div key={b.nome} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800">
                <div className="text-[11px] font-bold uppercase text-indigo-700 dark:text-indigo-400 mb-1">{b.nome}</div>
                <div className="text-xs text-gray-700 dark:text-gray-300 tabular-nums">{b.veics.join(" · ")}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
