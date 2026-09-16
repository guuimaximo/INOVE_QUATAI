// Resumo de Preventivas — a primeira aba. Responde, nesta ordem: como está a frota,
// como vai a semana (planejado × feito e o que ficou para trás), como foram as
// últimas semanas, e o que fazer agora (vencidos e o que vence nos próximos dias).
// Toda a conta vem pronta de preventivasLogic (montarPendencias / marcarFeitos).
import { useMemo, useRef, useState } from "react";
import {
  FaCheckCircle, FaExclamationTriangle, FaClock, FaPlus, FaCalendarCheck,
  FaChevronDown, FaChevronRight, FaShieldAlt, FaBus, FaTools, FaSearch,
} from "react-icons/fa";
import { isoMaisDias } from "./preventivasLogic";

const DOW = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const dm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "s/data");
const dow = (iso) => DOW[new Date(iso + "T00:00:00").getDay()];
const fmtInt = (n) => Number(n || 0).toLocaleString("pt-BR");
const pctDe = (a, b) => (b ? (a / b) * 100 : null);
const fmtPct = (p, casas = 0) =>
  p == null ? "—" : `${p.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
// Hífen não-quebrável: o número do carro nunca parte em duas linhas.
const semQuebra = (s) => String(s ?? "").replace(/-/g, "‑");

// Mesmas etiquetas da Programação da Semana.
const CAT_ETQ = {
  "Revisão": "bg-orange-500 text-white",
  "Inspeção": "bg-yellow-400 text-yellow-900",
  "Garantia": "bg-green-600 text-white",
};

// Cores de estado (validadas p/ daltonismo nos dois temas): feita = verde,
// ficou para trás = vermelho, a fazer = trilho neutro. Sempre com ícone + texto.
const COR_FEITA = "bg-emerald-600";
const COR_ATRASADA = "bg-red-600 dark:bg-red-500";
const COR_AFAZER = "bg-gray-200 dark:bg-gray-700";

const TOM = {
  bom: { chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", Icone: FaCheckCircle },
  alerta: { chip: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", Icone: FaClock },
  critico: { chip: "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300", Icone: FaExclamationTriangle },
  neutro: { chip: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300", Icone: FaBus },
};

function Cartao({ titulo, sub, acao, children, className = "", cartaoRef }) {
  return (
    <section
      ref={cartaoRef}
      className={`rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">{titulo}</h3>
          {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>}
        </div>
        {acao}
      </header>
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}

// Medidor: o trilho é um passo claro da mesma cor do preenchimento.
function Medidor({ valor, total, className = "" }) {
  const p = total ? Math.min(100, (valor / total) * 100) : 0;
  return (
    <div className={`h-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 overflow-hidden ${className}`}>
      <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${p}%` }} />
    </div>
  );
}

function Kpi({ rotulo, valor, complemento, detalhe, tom = "neutro", IconeProprio, medidor, onClick }) {
  const t = TOM[tom] || TOM.neutro;
  const Icone = IconeProprio || t.Icone;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`text-left rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-4 flex flex-col gap-2 ${
        onClick ? "hover:border-emerald-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{rotulo}</span>
        <span className={`w-7 h-7 rounded-lg grid place-items-center text-sm ${t.chip}`} aria-hidden>
          <Icone />
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-gray-900 dark:text-gray-50 leading-none">{valor}</span>
        {complemento && <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{complemento}</span>}
      </div>
      {medidor && <Medidor valor={medidor.valor} total={medidor.total} />}
      {detalhe && <span className="text-xs text-gray-500 dark:text-gray-400">{detalhe}</span>}
    </Tag>
  );
}

function Legenda({ itens }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
      {itens.map(([cor, txt]) => (
        <span key={txt} className="inline-flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-sm ${cor}`} aria-hidden />
          {txt}
        </span>
      ))}
    </div>
  );
}

// Situação do carro na agenda: já programado (e para quando) ou botão de programar.
function AcaoCarro({ veic, agenda, onProgramar }) {
  const ag = agenda[veic];
  if (ag && ag.length) {
    const prox = ag[0];
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 whitespace-nowrap"
        title={ag.map((a) => `${a.categoria} · ${dm(a.data_planejada)}`).join("\n")}
      >
        <FaCalendarCheck aria-hidden /> programado {dm(prox.data_planejada)}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onProgramar(veic)}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap transition"
    >
      <FaPlus className="text-[9px]" aria-hidden /> Programar
    </button>
  );
}

/* ---------------- Semana: planejado × feito ---------------- */
function CartaoSemana({ itens, semana, hojeISO, sistemaISO, nav, onEditar }) {
  const limite = sistemaISO && sistemaISO < hojeISO ? sistemaISO : hojeISO;
  const estado = (it) =>
    it.feito ? "feita" : it.data_planejada && it.data_planejada < limite ? "atrasada" : "afazer";

  const { dias, porCat, atrasadas, totais } = useMemo(() => {
    // Seg a Sex sempre; sábado e domingo só quando têm carro programado.
    const dias = Array.from({ length: 7 }, (_, i) => {
      const iso = isoMaisDias(semana, i);
      return { iso, feita: [], atrasada: [], afazer: [] };
    }).filter((d, i) => i < 5 || itens.some((it) => it.data_planejada === d.iso));
    const porCat = {};
    const atrasadas = [];
    const totais = { feita: 0, atrasada: 0, afazer: 0 };
    for (const it of itens) {
      const e = estado(it);
      totais[e] += 1;
      const c = (porCat[it.categoria] ||= { total: 0, feitas: 0 });
      c.total += 1;
      if (e === "feita") c.feitas += 1;
      const d = dias.find((x) => x.iso === it.data_planejada);
      if (d) d[e].push(it);
      if (e === "atrasada") atrasadas.push(it);
    }
    atrasadas.sort((a, b) => String(a.data_planejada).localeCompare(String(b.data_planejada)));
    return { dias, porCat, atrasadas, totais };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, semana, limite]);

  const maxDia = Math.max(1, ...dias.map((d) => d.feita.length + d.atrasada.length + d.afazer.length));
  const total = itens.length;
  const lista = (arr) => arr.map((it) => `${it.prefixo} (${it.categoria})`).join("\n");

  return (
    <Cartao
      titulo="Semana — planejado × feito"
      sub={total ? `${totais.feita} de ${total} feitas · ${fmtPct(pctDe(totais.feita, total))}` : "Nada programado nesta semana"}
      acao={nav}
      className="lg:col-span-2"
    >
      {total === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          Use o <b className="text-emerald-600">+</b> no Gerencial (ou em “Vencidos agora”, abaixo) para montar a semana.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {["Revisão", "Inspeção", "Garantia"].map((c) => {
              const b = porCat[c] || { total: 0, feitas: 0 };
              return (
                <div key={c} className="rounded-xl bg-gray-50 dark:bg-gray-900/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${CAT_ETQ[c]}`}>{c}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{fmtPct(pctDe(b.feitas, b.total))}</span>
                  </div>
                  <div className="mt-2 text-lg font-bold text-gray-900 dark:text-gray-50">
                    {b.feitas}
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400"> de {b.total}</span>
                  </div>
                  <Medidor valor={b.feitas} total={b.total} className="mt-1.5" />
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            {dias.map((d) => {
              const n = d.feita.length + d.atrasada.length + d.afazer.length;
              const hoje = d.iso === hojeISO;
              return (
                <div key={d.iso} className="grid grid-cols-[72px_1fr_88px] items-center gap-3">
                  <div className={`text-xs leading-tight ${hoje ? "font-bold text-emerald-700 dark:text-emerald-400" : "text-gray-600 dark:text-gray-300"}`}>
                    <div className="font-semibold">{dow(d.iso)}{hoje && " · hoje"}</div>
                    <div className="text-[11px] opacity-80">{dm(d.iso)}</div>
                  </div>
                  <div className="h-5 flex items-stretch gap-[2px]" style={{ width: `${(n / maxDia) * 100}%` }}>
                    {n === 0 && <span className="text-[11px] text-gray-400 italic self-center">livre</span>}
                    {[["feita", COR_FEITA, "feitas"], ["atrasada", COR_ATRASADA, "ficaram para trás"], ["afazer", COR_AFAZER, "a fazer"]].map(
                      ([k, cor, nome]) =>
                        d[k].length > 0 && (
                          <div
                            key={k}
                            className={`${cor} rounded-[4px] min-w-[6px] cursor-default`}
                            style={{ flexGrow: d[k].length, flexBasis: 0 }}
                            title={`${dow(d.iso)} ${dm(d.iso)} · ${d[k].length} ${nome}\n${lista(d[k])}`}
                          />
                        )
                    )}
                  </div>
                  <div className="text-xs text-right text-gray-600 dark:text-gray-300">
                    {n ? (
                      <>
                        <b className="text-gray-900 dark:text-gray-50">{d.feita.length}</b>/{n} feitas
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              );
            })}
            <div className="pt-1">
              <Legenda itens={[[COR_FEITA, "feita (OS aberta)"], [COR_ATRASADA, "ficou para trás"], [COR_AFAZER, "a fazer"]]} />
            </div>
            {sistemaISO && sistemaISO < hojeISO && isoMaisDias(semana, 6) >= sistemaISO && (
              <p className="text-[11px] text-gray-400">
                O sistema tem dados até {dm(sistemaISO)}: o que é de {dm(sistemaISO)} em diante só fica verde depois da próxima atualização.
              </p>
            )}
          </div>

          {atrasadas.length > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-900/10">
              <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-300">
                <FaExclamationTriangle aria-hidden /> Ficaram para trás ({atrasadas.length}) — sem OS aberta no dia programado
              </div>
              <ul className="divide-y divide-red-100 dark:divide-red-900/40">
                {atrasadas.map((it) => (
                  <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-gray-900 dark:text-gray-50 whitespace-nowrap">{semQuebra(it.prefixo)}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${CAT_ETQ[it.categoria] || ""}`}>{it.categoria}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {dow(it.data_planejada)} {dm(it.data_planejada)} · {it.turno || "Dia"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEditar(it)}
                      className="px-2 py-1 rounded-md text-[11px] font-bold text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition"
                    >
                      Reprogramar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Cartao>
  );
}

/* ---------------- Histórico: últimas semanas ---------------- */
function CartaoHistorico({ semanas, semanaVista, semanaAtual, onSemana }) {
  const fechadas = semanas.filter((s) => s.semana < semanaAtual && s.total > 0);
  const media = fechadas.length
    ? pctDe(fechadas.reduce((a, s) => a + s.feitas, 0), fechadas.reduce((a, s) => a + s.total, 0))
    : null;
  return (
    <Cartao
      titulo="Últimas semanas"
      sub={media == null ? "programadas × feitas" : `Semanas fechadas: ${fmtPct(media)} feitas`}
    >
      <div className="flex items-end gap-2 h-44 border-b border-gray-200 dark:border-gray-700">
        {semanas.map((s) => {
          const p = pctDe(s.feitas, s.total);
          const vista = s.semana === semanaVista;
          return (
            <button
              key={s.semana}
              type="button"
              onClick={() => onSemana(s.semana)}
              title={`Semana de ${dm(s.semana)}: ${s.feitas} de ${s.total} feitas${s.semana === semanaAtual ? " (em andamento)" : ""}`}
              className="group flex-1 h-full flex flex-col justify-end items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
            >
              <span className={`text-xs ${vista ? "font-bold text-gray-900 dark:text-gray-50" : "text-gray-500 dark:text-gray-400"}`}>
                {fmtPct(p)}
              </span>
              <span
                className={`w-full max-w-[44px] rounded-t-[4px] transition ${
                  vista ? "bg-emerald-600" : "bg-gray-300 dark:bg-gray-600 group-hover:bg-emerald-300 dark:group-hover:bg-emerald-800"
                }`}
                style={{ height: `${Math.max(p ?? 0, s.total ? 2 : 0) * 0.78}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex gap-2 pt-1.5">
        {semanas.map((s) => (
          <div key={s.semana} className="flex-1 text-center leading-tight">
            <div className={`text-[11px] ${s.semana === semanaVista ? "font-bold text-gray-800 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}>
              {dm(s.semana)}
            </div>
            <div className="text-[10px] text-gray-400 tabular-nums">
              {s.total ? `${s.feitas}/${s.total}` : "—"}
              {s.semana === semanaAtual && <span className="block">atual</span>}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 mt-3">Clique numa semana para ver o detalhe dela.</p>
    </Cartao>
  );
}

/* ---------------- Vencidos agora ---------------- */
const NIVEIS = [
  ["todos", "Todos"],
  [0, "Revisão"],
  [1, "Inspeção"],
  [2, "Só itens satélite"],
];
function CartaoVencidos({ vencidos, filtro, setFiltro, agenda, onProgramar, cartaoRef }) {
  const [busca, setBusca] = useState("");
  const q = busca.replace(/\D/g, "");
  const lista = vencidos.filter(
    (v) => (filtro === "todos" || v.nivel === filtro) && (!q || v.veic.replace(/\D/g, "").includes(q))
  );
  const semAgenda = vencidos.filter((v) => !(agenda[v.veic] || []).length).length;
  return (
    <Cartao
      cartaoRef={cartaoRef}
      titulo={`Vencidos agora · ${vencidos.length} carros`}
      sub={vencidos.length ? `${semAgenda} ainda sem programação` : "Nenhum carro com plano vencido"}
    >
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {NIVEIS.map(([k, txt]) => {
          const n = k === "todos" ? vencidos.length : vencidos.filter((v) => v.nivel === k).length;
          const ativo = filtro === k;
          return (
            <button
              key={String(k)}
              type="button"
              onClick={() => setFiltro(k)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                ativo
                  ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100"
                  : "border-gray-200 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"
              }`}
            >
              {txt} <span className="opacity-70">{n}</span>
            </button>
          );
        })}
        <div className="relative ml-auto">
          <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]" aria-hidden />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Carro"
            aria-label="Buscar carro"
            className="pl-7 pr-2 py-1 w-28 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-900 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[420px] overflow-auto -mx-1 px-1">
        {lista.length === 0 && <li className="py-6 text-center text-sm text-gray-400">Nada aqui.</li>}
        {lista.map((v) => (
          <li key={v.veic} className="flex items-start justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <div className="font-bold text-gray-900 dark:text-gray-50 whitespace-nowrap">{semQuebra(v.veic)}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {v.itens.map((i) => (
                  <span
                    key={i.nome}
                    className={`px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap ${
                      i.principal
                        ? "bg-red-50 text-red-700 font-semibold dark:bg-red-900/40 dark:text-red-300"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {i.nome} +{fmtInt(i.excesso)} {i.un}
                  </span>
                ))}
              </div>
            </div>
            <AcaoCarro veic={v.veic} agenda={agenda} onProgramar={onProgramar} />
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

/* ---------------- Vencem nos próximos dias ---------------- */
function CartaoProximos({ proximos, horizonteDias, agenda, onProgramar }) {
  return (
    <Cartao
      titulo={`Vencem nos próximos ${horizonteDias} dias · ${proximos.length} carros`}
      sub="Pelo km/dia de cada carro — dá para encaixar na programação antes de vencer"
    >
      <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[462px] overflow-auto -mx-1 px-1">
        {proximos.length === 0 && <li className="py-6 text-center text-sm text-gray-400">Nenhum carro perto de vencer.</li>}
        {proximos.map((v) => (
          <li key={v.veic} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0 flex items-center gap-3">
              <span
                className={`w-12 shrink-0 text-center rounded-md py-1 text-xs font-bold ${
                  v.dias <= 2
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                }`}
                title="dias estimados até vencer"
              >
                ~{v.dias}d
              </span>
              <div className="min-w-0">
                <div className="font-bold text-gray-900 dark:text-gray-50 whitespace-nowrap">{semQuebra(v.veic)}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {v.nome} · faltam {fmtInt(v.faltam)} km
                </div>
              </div>
            </div>
            <AcaoCarro veic={v.veic} agenda={agenda} onProgramar={onProgramar} />
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

/* ---------------- Itens do plano ---------------- */
function CartaoItens({ aderencia, porItem }) {
  const [aberto, setAberto] = useState(null);
  const comVencido = aderencia.filter((a) => a.atrasadas > 0).sort((a, b) => b.atrasadas - a.atrasadas);
  const emDia = aderencia.filter((a) => a.atrasadas === 0);
  const max = Math.max(1, ...comVencido.map((a) => a.atrasadas));
  return (
    <Cartao
      titulo="Itens do plano com carro vencido"
      sub="Aderência = carros em dia ÷ carros que têm o plano. Clique num item para ver os carros."
      className="lg:col-span-2"
    >
      {comVencido.length === 0 ? (
        <p className="py-4 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
          <FaCheckCircle aria-hidden /> Nenhum item vencido na frota.
        </p>
      ) : (
        <ul className="space-y-1">
          {comVencido.map((a) => {
            const abrir = aberto === a.nome;
            const carros = porItem.get(a.nome) || [];
            return (
              <li key={a.nome}>
                <button
                  type="button"
                  onClick={() => setAberto(abrir ? null : a.nome)}
                  aria-expanded={abrir}
                  className="w-full grid grid-cols-[12px_88px_1fr_auto] sm:grid-cols-[16px_120px_1fr_150px] items-center gap-2 sm:gap-3 px-1 sm:px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 text-left transition"
                >
                  <span className="text-gray-400 text-[10px]">{abrir ? <FaChevronDown /> : <FaChevronRight />}</span>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">{a.nome}</span>
                  <span className="h-3 flex items-center">
                    <span className="h-full rounded-r-[4px] bg-red-600 dark:bg-red-500" style={{ width: `${(a.atrasadas / max) * 100}%` }} />
                  </span>
                  <span className="text-xs text-right text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    <b className="text-gray-900 dark:text-gray-50">{a.atrasadas}</b> {a.atrasadas === 1 ? "carro" : "carros"} ·{" "}
                    {fmtPct(a.adr == null ? null : a.adr * 100, 1)}
                  </span>
                </button>
                {abrir && (
                  <div className="flex flex-wrap gap-1.5 pl-9 pr-2 pb-2 pt-1">
                    {carros.map((c) => (
                      <span
                        key={c.veic}
                        className="px-2 py-1 rounded-md text-[11px] bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 whitespace-nowrap"
                      >
                        <b>{semQuebra(c.veic)}</b> <span className="text-red-700 dark:text-red-300">+{fmtInt(c.excesso)} {c.un}</span>
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {emDia.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
            <FaCheckCircle className="text-emerald-600" aria-hidden /> Em dia na frota toda ({emDia.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {emDia.map((a) => (
              <span key={a.nome} className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                {a.nome}
              </span>
            ))}
          </div>
        </div>
      )}
    </Cartao>
  );
}

/* ---------------- Garantia (resumo) ---------------- */
function CartaoGarantia({ garantia, onAbrir }) {
  const pend = garantia.filter((g) => !g.done);
  return (
    <Cartao
      titulo="Garantia — próximas na concessionária"
      sub={`${pend.length} a chamar · ${garantia.length - pend.length} em dia`}
      acao={
        <button type="button" onClick={onAbrir} className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
          ver tudo
        </button>
      }
    >
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {pend.length === 0 && <li className="py-6 text-center text-sm text-gray-400">Todos em dia.</li>}
        {pend.slice(0, 6).map((g) => (
          <li key={g.veic} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <div className="font-bold text-gray-900 dark:text-gray-50 whitespace-nowrap">
                {semQuebra(g.veic)}
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200 font-semibold">
                  {g.milestone / 1000}k
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                faltam {fmtInt(g.falta)} km
                {g.oleoVenc != null && <span className="text-red-700 dark:text-red-300 font-semibold"> · óleo vencido +{fmtInt(g.oleoVenc)} km</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-gray-400">chamar em</div>
              <div className="text-sm font-bold text-gray-900 dark:text-gray-50">{g.oleoVenc != null ? "já" : g.alvo.slice(0, 5)}</div>
            </div>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

/* ---------------- Tela ---------------- */
export default function PreventivasResumo({
  gerencial, pendencias, garantia, itensSemana, semana, semanaAtual, historico,
  agenda, hojeISO, sistemaISO, navSemana, onSemana, onProgramar, onEditar, onIrPara,
}) {
  const [filtroVenc, setFiltroVenc] = useState("todos");
  const refVencidos = useRef(null);
  const irParaVencidos = (nivel) => {
    setFiltroVenc(nivel);
    refVencidos.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const frota = gerencial.linhas.length;
  const nVenc = pendencias.vencidos.length;
  const revVenc = gerencial.aderencia.find((a) => a.nome === "REVISÃO")?.atrasadas ?? 0;
  const inspVenc = gerencial.aderencia.find((a) => a.nome === "INSP 5.000")?.atrasadas ?? 0;

  const feitas = itensSemana.filter((i) => i.feito).length;
  const limite = sistemaISO && sistemaISO < hojeISO ? sistemaISO : hojeISO;
  const atrasadas = itensSemana.filter((i) => !i.feito && i.data_planejada && i.data_planejada < limite).length;

  const garPend = (garantia || []).filter((g) => !g.done);
  const garJa = garPend.filter((g) => g.oleoVenc != null).length;
  const garProx = garPend[0];
  const em7 = isoMaisDias(hojeISO, 7);
  const garAlvoISO = garProx ? garProx.alvo.split("/").reverse().join("-") : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Kpi
          rotulo="Frota sem nada vencido"
          valor={fmtInt(frota - nVenc)}
          complemento={`de ${fmtInt(frota)}`}
          medidor={{ valor: frota - nVenc, total: frota }}
          detalhe={`${fmtPct(pctDe(frota - nVenc, frota))} dos carros`}
          tom={nVenc === 0 ? "bom" : pctDe(frota - nVenc, frota) >= 90 ? "alerta" : "critico"}
          onClick={() => irParaVencidos("todos")}
        />
        <Kpi
          rotulo="Revisões vencidas"
          valor={revVenc}
          detalhe={revVenc ? "revisão 10.000 passou do km" : "nenhuma vencida"}
          tom={revVenc ? "critico" : "bom"}
          IconeProprio={FaTools}
          onClick={() => irParaVencidos(0)}
        />
        <Kpi
          rotulo="Inspeções vencidas"
          valor={inspVenc}
          detalhe={inspVenc ? "inspeção 5.000 passou do km" : "nenhuma vencida"}
          tom={inspVenc ? "critico" : "bom"}
          IconeProprio={FaSearch}
          onClick={() => irParaVencidos(1)}
        />
        <Kpi
          rotulo={semana === semanaAtual ? "Semana atual" : `Semana de ${dm(semana)}`}
          valor={feitas}
          complemento={`de ${itensSemana.length} feitas`}
          medidor={{ valor: feitas, total: itensSemana.length }}
          detalhe={atrasadas ? `${atrasadas} ${atrasadas === 1 ? "ficou" : "ficaram"} para trás` : "nada atrasado"}
          tom={atrasadas ? "critico" : "bom"}
          IconeProprio={atrasadas ? FaExclamationTriangle : FaCalendarCheck}
          onClick={() => onIrPara("programacao")}
        />
        <Kpi
          rotulo="Garantia a chamar"
          valor={garPend.length}
          detalhe={
            garJa
              ? `${garJa} com óleo vencido — chamar já`
              : garProx
              ? `próxima: ${garProx.veic} em ${garProx.alvo.slice(0, 5)}`
              : "todos em dia"
          }
          tom={garJa ? "critico" : garAlvoISO && garAlvoISO <= em7 ? "alerta" : "bom"}
          IconeProprio={FaShieldAlt}
          onClick={() => onIrPara("garantia")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <CartaoSemana
          itens={itensSemana}
          semana={semana}
          hojeISO={hojeISO}
          sistemaISO={sistemaISO}
          nav={navSemana}
          onEditar={onEditar}
        />
        <CartaoHistorico semanas={historico} semanaVista={semana} semanaAtual={semanaAtual} onSemana={onSemana} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <CartaoVencidos
          cartaoRef={refVencidos}
          vencidos={pendencias.vencidos}
          filtro={filtroVenc}
          setFiltro={setFiltroVenc}
          agenda={agenda}
          onProgramar={onProgramar}
        />
        <CartaoProximos
          proximos={pendencias.proximos}
          horizonteDias={pendencias.horizonteDias}
          agenda={agenda}
          onProgramar={onProgramar}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <CartaoItens aderencia={gerencial.aderencia} porItem={pendencias.porItem} />
        {garantia && <CartaoGarantia garantia={garantia} onAbrir={() => onIrPara("garantia")} />}
      </div>
    </div>
  );
}
