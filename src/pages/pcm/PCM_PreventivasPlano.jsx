// Tela de Preventivas — Gerencial (1 linha/carro x planos) + Programacao da semana.
// Le ultimo_plano (projeto IMPORTACAO_DADOS) via supabaseDados.
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FaSync, FaSearch, FaTable, FaCalendarWeek, FaExclamationTriangle, FaWrench,
} from "react-icons/fa";
import { puxarUltimoPlano } from "../../supabaseDados";
import {
  montarCarros, montarGerencial, montarProgramacao, ultimaAtualizacao,
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
    </div>
  );
}

/* ===================== GERENCIAL ===================== */
function Gerencial({ linhas, aderencia, busca, setBusca, total }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar veículo (ex: 2224)"
            className="pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-800 text-sm w-64"
          />
        </div>
        <span className="text-xs text-gray-500">
          {linhas.length} de {total} veículos · valor = km faltando (negativo) · <span className="text-red-600 font-semibold">vermelho = vencido</span>
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        {/* Tabela larga */}
        <div className="overflow-auto rounded-xl border border-gray-200 dark:border-gray-700 max-h-[70vh]">
          <table className="text-xs border-collapse min-w-max">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-20 bg-emerald-800 text-white px-3 py-2 text-left font-semibold">Prefixo</th>
                <th className="bg-emerald-800 text-white px-2 py-2 font-semibold">Sem.</th>
                <th className="bg-emerald-800 text-white px-2 py-2 font-semibold whitespace-nowrap">Últ. Revisão</th>
                {GERENCIAL_COLS.map((c) => (
                  <th key={c.t} className="bg-emerald-900 text-white px-2 py-2 font-semibold whitespace-nowrap max-w-[90px]">
                    {c.t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={l.veic} className={i % 2 ? "bg-gray-50 dark:bg-gray-800/40" : "bg-white dark:bg-gray-900"}>
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5 font-bold text-gray-800 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700">
                    {l.veic}
                  </td>
                  <td className="px-2 py-1.5 text-center text-gray-500">{l.semana ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center text-gray-500 whitespace-nowrap">{l.dataUlt}</td>
                  {l.cols.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-2 py-1.5 text-center tabular-nums ${
                        cell.venc ? "bg-red-100 text-red-700 font-bold dark:bg-red-900/40 dark:text-red-300" : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {cell.texto}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Aderencia */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden self-start">
          <div className="bg-emerald-700 text-white px-4 py-2.5 font-semibold text-sm">Aderência às Preventivas</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2 text-left font-semibold">Plano</th>
                <th className="px-2 py-2 font-semibold">Atras.</th>
                <th className="px-2 py-2 font-semibold">Total</th>
                <th className="px-2 py-2 font-semibold">Adr.</th>
              </tr>
            </thead>
            <tbody>
              {aderencia.map((a) => (
                <tr key={a.nome} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{a.nome}</td>
                  <td className={`px-2 py-1.5 text-center font-semibold ${a.atrasadas ? "text-red-600" : "text-gray-400"}`}>{a.atrasadas}</td>
                  <td className="px-2 py-1.5 text-center text-gray-500">{a.total}</td>
                  <td className="px-2 py-1.5 text-center font-semibold text-gray-700 dark:text-gray-300">
                    {a.adr == null ? "—" : `${(a.adr * 100).toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ===================== PROGRAMACAO ===================== */
function DiaCard({ dow, data, cars, noite, hoje }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900">
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
          <div key={l} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-900">
            <div className={`text-2xl font-bold ${c === "emerald" ? "text-emerald-700" : c === "indigo" ? "text-indigo-700" : "text-gray-700 dark:text-gray-200"}`}>{n}</div>
            <div className="text-xs text-gray-500">{l}</div>
          </div>
        ))}
      </div>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-2">Preventivas 10.000 — de amanhã até sexta</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {prog.dias10.map((d) => <DiaCard key={"p" + d.data} {...d} />)}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-indigo-700 mb-2">Inspeções 5.000 — hoje à noite + até sexta</h3>
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
              <div key={b.nome} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-900">
                <div className="text-[11px] font-bold uppercase text-indigo-700 mb-1">{b.nome}</div>
                <div className="text-xs text-gray-700 dark:text-gray-300 tabular-nums">{b.veics.join(" · ")}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
