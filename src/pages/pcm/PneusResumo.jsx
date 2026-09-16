// Resumo de Pneus — a primeira aba de Controle de Pneus. Responde, nesta ordem:
// a frota bate com o TransNet? o que está atrasado (auditoria, lançamento,
// conserto, riscado)? como andaram as trocas? e como está o estoque.
// `conferencia` vem da tela de Conferência (carregada por trás) e `lancamentos`
// de montarResumoLancamentos. `undefined` = o usuário não tem aquela permissão;
// `null` = ainda carregando.
import { useMemo, useState } from "react";
import {
  FaBus, FaExchangeAlt, FaClipboardCheck, FaTools, FaExclamationTriangle, FaCheckCircle, FaSearch,
} from "react-icons/fa";
import {
  Cartao, Kpi, Legenda, Medidor, fmtInt, pctDe, fmtPct, semQuebra, COR_BOA, COR_RUIM,
} from "./resumoUI";

const dm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const fmtData = (valor) => {
  if (!valor) return "—";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};
const plural = (n, um, varios) => `${fmtInt(n)} ${n === 1 ? um : varios}`;

const NOME_STATUS = {
  OK: "OK",
  "OUTRO VEICULO": "Outro veículo",
  "NAO EXISTE": "Não existe no TransNet",
  SUCATA: "Sucata",
  ESTOQUE: "No estoque",
  INCORRETO: "Incorreto",
  DUPLICIDADE: "Duplicidade",
};
const nomeStatus = (s) => NOME_STATUS[s] || s;
const NOME_POSICAO = {
  DD: "Dianteiro direito",
  DE: "Dianteiro esquerdo",
  TDE: "Traseiro direito externo",
  TDI: "Traseiro direito interno",
  TEE: "Traseiro esquerdo externo",
  TEI: "Traseiro esquerdo interno",
};

function Carregando({ texto = "Carregando…" }) {
  return <p className="py-8 text-center text-sm text-gray-400">{texto}</p>;
}

function Vazio({ texto }) {
  return (
    <p className="py-6 text-sm text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-2">
      <FaCheckCircle aria-hidden /> {texto}
    </p>
  );
}

function LinkAba({ texto, onClick }) {
  return (
    <button type="button" onClick={onClick} className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap">
      {texto}
    </button>
  );
}

function BuscaCarro({ valor, onChange }) {
  return (
    <div className="relative">
      <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]" aria-hidden />
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Carro"
        aria-label="Buscar carro"
        className="pl-7 pr-2 py-1 w-28 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-900 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}
const casaCarro = (prefixo, busca) => {
  const q = String(busca || "").replace(/\D/g, "");
  return !q || String(prefixo || "").replace(/\D/g, "").includes(q);
};

/* ---------------- Trocas por semana ---------------- */
function CartaoTrocas({ lancamentos, onIrPara }) {
  if (lancamentos === null) return <Cartao titulo="Trocas por semana" className="lg:col-span-2"><Carregando /></Cartao>;
  const semanas = lancamentos.trocasPorSemana;
  const max = Math.max(1, ...semanas.map((s) => s.lancadas + s.semLancar));
  const total = semanas.reduce((a, s) => a + s.lancadas + s.semLancar, 0);
  const semLancar = semanas.reduce((a, s) => a + s.semLancar, 0);
  return (
    <Cartao
      titulo="Trocas por semana"
      sub={`${plural(total, "troca", "trocas")} nas últimas ${semanas.length} semanas · ${
        semLancar ? `${plural(semLancar, "sem lançar", "sem lançar")} no TransNet` : "todas lançadas no TransNet"
      }`}
      acao={<LinkAba texto="abrir Troca" onClick={() => onIrPara("troca")} />}
      className="lg:col-span-2"
    >
      <div className="flex items-end gap-1 sm:gap-2 h-44 border-b border-gray-200 dark:border-gray-700">
        {semanas.map((s) => {
          const n = s.lancadas + s.semLancar;
          const atual = s.semana === lancamentos.semanaAtual;
          return (
            <div
              key={s.semana}
              className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1"
              title={`Semana de ${dm(s.semana)}: ${n} trocas (${s.lancadas} lançadas, ${s.semLancar} sem lançar)`}
            >
              <span className={`text-xs ${atual ? "font-bold text-gray-900 dark:text-gray-50" : "text-gray-500 dark:text-gray-400"}`}>{n || ""}</span>
              <div className="w-full max-w-[40px] flex flex-col gap-[2px]" style={{ height: `${(n / max) * 78}%` }}>
                {s.semLancar > 0 && <div className={`${COR_RUIM} rounded-t-[4px]`} style={{ flexGrow: s.semLancar, flexBasis: 0 }} />}
                {s.lancadas > 0 && (
                  <div className={`${COR_BOA} ${s.semLancar ? "" : "rounded-t-[4px]"}`} style={{ flexGrow: s.lancadas, flexBasis: 0 }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 sm:gap-2 pt-1.5">
        {semanas.map((s) => (
          <div key={s.semana} className="flex-1 min-w-0 text-center leading-tight">
            <div className={`text-[9px] sm:text-[11px] ${s.semana === lancamentos.semanaAtual ? "font-bold text-gray-800 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}>
              {dm(s.semana)}
            </div>
            {s.semana === lancamentos.semanaAtual && <div className="text-[10px] text-gray-400">atual</div>}
          </div>
        ))}
      </div>
      <div className="pt-3">
        <Legenda itens={[[COR_BOA, "lançada no TransNet"], [COR_RUIM, "sem lançar"]]} />
      </div>
    </Cartao>
  );
}

/* ---------------- Conferência por status ---------------- */
function CartaoStatus({ conferencia, onIrPara }) {
  if (conferencia === null) return <Cartao titulo="Posições × TransNet"><Carregando /></Cartao>;
  const total = conferencia.totalPosicoes;
  const ok = conferencia.okPosicoes;
  // As divergências são poucas perto do OK: cada barra é comparada com a maior
  // divergência (senão todas somem ao lado dos 98% de OK).
  const problemas = Object.entries(conferencia.statusPosicoes)
    .filter(([status]) => status !== "OK")
    .map(([status, n]) => ({ status, n }))
    .sort((a, b) => b.n - a.n);
  const nProblemas = problemas.reduce((a, p) => a + p.n, 0);
  const maxProblema = Math.max(1, ...problemas.map((p) => p.n));
  return (
    <Cartao
      titulo="Posições × TransNet"
      sub={`${plural(total, "posição auditada", "posições auditadas")} comparadas com o TransNet`}
      acao={<LinkAba texto="abrir Veículos" onClick={() => onIrPara("veiculos")} />}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
          <FaCheckCircle className="text-emerald-600" aria-hidden /> Batem com o TransNet
        </span>
        <span className="text-gray-600 dark:text-gray-300">
          <b className="text-gray-900 dark:text-gray-50">{fmtInt(ok)}</b> · {fmtPct(pctDe(ok, total), 1)}
        </span>
      </div>
      <Medidor valor={ok} total={total} className="mt-1.5" />

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 mb-2">
          <FaExclamationTriangle className="text-red-600 dark:text-red-400" aria-hidden />
          {nProblemas ? `${plural(nProblemas, "posição não bate", "posições não batem")}` : "Nenhuma posição divergente"}
        </div>
        <ul className="space-y-1.5">
          {problemas.map(({ status, n }) => (
            <li key={status} className="grid grid-cols-[minmax(0,1.3fr)_1fr_28px] items-center gap-2 text-xs">
              <span className="truncate text-gray-600 dark:text-gray-300" title={nomeStatus(status)}>{nomeStatus(status)}</span>
              <span className="h-2 flex items-center">
                <span className={`h-full rounded-r-[4px] ${COR_RUIM}`} style={{ width: `${(n / maxProblema) * 100}%` }} />
              </span>
              <b className="text-right text-gray-900 dark:text-gray-50">{fmtInt(n)}</b>
            </li>
          ))}
        </ul>
      </div>
      {conferencia.semAuditoria > 0 && (
        <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
          {plural(conferencia.semAuditoria, "carro ainda não tem", "carros ainda não têm")} auditoria para comparar.
        </p>
      )}
    </Cartao>
  );
}

/* ---------------- Carros com divergência ---------------- */
function CartaoDivergencias({ conferencia, onIrPara }) {
  const [busca, setBusca] = useState("");
  if (conferencia === null) return <Cartao titulo="Carros com divergência"><Carregando /></Cartao>;
  const lista = conferencia.comDivergencia.filter((c) => casaCarro(c.prefixo, busca));
  return (
    <Cartao
      titulo={`Carros com divergência · ${conferencia.comDivergencia.length}`}
      sub="A auditoria (ou a última troca) não bate com o TransNet nessas posições"
      acao={<BuscaCarro valor={busca} onChange={setBusca} />}
    >
      {conferencia.comDivergencia.length === 0 ? (
        <Vazio texto="Todos os carros batem com o TransNet." />
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[380px] overflow-auto -mx-1 px-1">
          {lista.length === 0 && <li className="py-6 text-center text-sm text-gray-400">Nada aqui.</li>}
          {lista.map((c) => (
            <li key={c.prefixo} className="py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold text-gray-900 dark:text-gray-50 whitespace-nowrap">{semQuebra(c.prefixo)}</span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  auditado {fmtData(c.auditoria_em)}{c.ficha ? ` · ${c.ficha}` : ""}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {c.divergencias.map((d) => (
                  <span
                    key={d.posicao}
                    title={[NOME_POSICAO[d.posicao] || d.posicao, d.detalhe].filter(Boolean).join(" — ")}
                    className="px-1.5 py-0.5 rounded text-[11px] bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300 whitespace-nowrap"
                  >
                    <b>{d.posicao}</b> · {nomeStatus(d.status)}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {conferencia.comDivergencia.length > 0 && (
        <div className="pt-3 text-right">
          <LinkAba texto="ver na aba Veículos" onClick={() => onIrPara("veiculos")} />
        </div>
      )}
    </Cartao>
  );
}

/* ---------------- Auditoria atrasada ---------------- */
function CartaoAuditoria({ lancamentos, onIrPara }) {
  const [busca, setBusca] = useState("");
  if (lancamentos === null) return <Cartao titulo="Auditoria atrasada"><Carregando /></Cartao>;
  const todos = lancamentos.auditoriaAtrasada;
  const lista = todos.filter((a) => casaCarro(a.prefixo, busca));
  const nunca = todos.filter((a) => a.semAuditoria).length;
  return (
    <Cartao
      titulo={`Auditoria atrasada · ${todos.length}`}
      sub={`Carros sem auditoria de pneus há mais de 30 dias${nunca ? ` (${nunca} nunca auditados)` : ""}`}
      acao={<BuscaCarro valor={busca} onChange={setBusca} />}
    >
      {todos.length === 0 ? (
        <Vazio texto="Toda a frota foi auditada nos últimos 30 dias." />
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[380px] overflow-auto -mx-1 px-1">
          {lista.length === 0 && <li className="py-6 text-center text-sm text-gray-400">Nada aqui.</li>}
          {lista.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="font-bold text-gray-900 dark:text-gray-50 whitespace-nowrap">{semQuebra(a.prefixo)}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {a.semAuditoria ? "nunca auditado" : `última auditoria em ${fmtData(a.ultimaAuditoria)}`}
                  {a.cluster ? ` · ${a.cluster}` : ""}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${
                  a.semAuditoria || a.diasSemAuditoria > 60
                    ? "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                    : "bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                }`}
              >
                {a.semAuditoria ? "sem auditoria" : `${a.diasSemAuditoria} dias`}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="pt-3 text-right">
        <LinkAba texto="lançar auditoria" onClick={() => onIrPara("auditoria")} />
      </div>
    </Cartao>
  );
}

/* ---------------- Estoque ---------------- */
function CartaoEstoque({ conferencia, onIrPara }) {
  if (conferencia === null) return <Cartao titulo="Estoque — última contagem"><Carregando /></Cartao>;
  const e = conferencia.estoque;
  const situacoes = Object.entries(e.porSituacao).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...situacoes.map(([, n]) => n));
  return (
    <Cartao
      titulo="Estoque — última contagem"
      sub={e.fisicoTotal ? `${plural(e.fisicoTotal, "pneu", "pneus")}${e.ficha ? ` · ${e.ficha}` : ""} · ${fmtData(e.data)}` : "Nenhuma contagem lançada"}
      acao={<LinkAba texto="abrir Estoque" onClick={() => onIrPara("estoque-transnet")} />}
    >
      {e.fisicoTotal > 0 && (
        <>
          <ul className="space-y-1.5">
            {situacoes.map(([situacao, n]) => (
              <li key={situacao} className="grid grid-cols-[minmax(0,1fr)_2fr_32px] items-center gap-2 text-xs">
                <span className="truncate text-gray-700 dark:text-gray-200" title={situacao}>{situacao}</span>
                <span className="h-2 flex items-center">
                  <span className="h-full rounded-r-[4px] bg-gray-500 dark:bg-gray-400" style={{ width: `${(n / max) * 100}%` }} />
                </span>
                <b className="text-right text-gray-900 dark:text-gray-50">{fmtInt(n)}</b>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-300">Bate com o TransNet</span>
              <span className="text-gray-600 dark:text-gray-300">
                <b className="text-gray-900 dark:text-gray-50">{fmtInt(e.fisicoBorracharia)}</b> de {fmtInt(e.fisicoTotal)}
              </span>
            </div>
            <Medidor valor={e.fisicoBorracharia} total={e.fisicoTotal} className="mt-1.5" />
            {e.fisicoDivergente > 0 && (
              <p className="mt-1.5 text-[11px] text-red-700 dark:text-red-300">
                {plural(e.fisicoDivergente, "pneu contado aparece", "pneus contados aparecem")} em outro lugar no TransNet.
              </p>
            )}
          </div>
        </>
      )}
    </Cartao>
  );
}

function LinhaNumero({ rotulo, valor, ruim }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-xs">
      <span className="text-gray-600 dark:text-gray-300">{rotulo}</span>
      <b className={valor && ruim ? "text-red-700 dark:text-red-300" : "text-gray-900 dark:text-gray-50"}>{fmtInt(valor)}</b>
    </div>
  );
}

function CartaoTransnet({ conferencia, onIrPara }) {
  if (conferencia === null) return <Cartao titulo="No TransNet"><Carregando /></Cartao>;
  const { estoque: e, recapadora: r, sucata: s } = conferencia;
  const bloco = "rounded-xl bg-gray-50 dark:bg-gray-900/40 px-3 py-2";
  const cab = "flex items-center justify-between text-xs font-bold text-gray-800 dark:text-gray-100 mb-1";
  return (
    <Cartao titulo="No TransNet" sub="Onde o TransNet diz que os pneus estão, e se o INOVE confirma">
      <div className="space-y-3">
        <div className={bloco}>
          <div className={cab}>
            <span>Borracharia</span>
            <LinkAba texto={fmtInt(e.transnetTotal)} onClick={() => onIrPara("estoque-transnet")} />
          </div>
          <LinhaNumero rotulo="Contados no estoque" valor={e.transnetNoEstoque} />
          <LinhaNumero rotulo="Achados montados em carro" valor={e.transnetEmCarro} ruim />
          <LinhaNumero rotulo="No estoque e no carro ao mesmo tempo" valor={e.transnetDivergente} ruim />
          <LinhaNumero rotulo="Não localizados" valor={e.transnetNaoLocalizado} ruim />
        </div>
        <div className={bloco}>
          <div className={cab}>
            <span>Recapadora</span>
            <LinkAba texto={fmtInt(r.total)} onClick={() => onIrPara("recapadora")} />
          </div>
          <LinhaNumero rotulo="Só no TransNet (esperado)" valor={r.soTransnet} />
          <LinhaNumero rotulo="Aparecem em outro lugar (estoque, carro, sucata)" valor={r.total - r.soTransnet} ruim />
        </div>
        <div className={bloco}>
          <div className={cab}>
            <span>Sucata</span>
            <LinkAba texto={fmtInt(s.total)} onClick={() => onIrPara("sucata")} />
          </div>
          <LinhaNumero rotulo="Só como sucata (esperado)" valor={s.somenteSucata} />
          <LinhaNumero rotulo="Ainda aparecem no estoque ou em carro" valor={s.total - s.somenteSucata} ruim />
        </div>
      </div>
    </Cartao>
  );
}

/* ---------------- Pendências de lançamento ---------------- */
function CartaoPendencias({ lancamentos, onIrPara }) {
  if (lancamentos === null) return <Cartao titulo="Pendências"><Carregando /></Cartao>;
  const { trocasSemLancar: trocas, consertosAbertos: consertos, riscadosAbertos: riscados } = lancamentos;
  const nada = !trocas.length && !consertos.length && !riscados.length;
  const secao = (titulo, n, aba, itens) => (
    <div>
      <div className="flex items-center justify-between text-xs font-bold text-gray-800 dark:text-gray-100 mb-1">
        <span>
          {titulo} <span className={n ? "text-red-700 dark:text-red-300" : "text-gray-400"}>· {n}</span>
        </span>
        <LinkAba texto="abrir" onClick={() => onIrPara(aba)} />
      </div>
      {n === 0 ? (
        <p className="text-[11px] text-gray-400 pb-1">Nenhum.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {itens.slice(0, 5).map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
              <span className="min-w-0 truncate text-gray-700 dark:text-gray-200">{it.texto}</span>
              <span className="shrink-0 text-gray-500 dark:text-gray-400">{it.lado}</span>
            </li>
          ))}
          {itens.length > 5 && <li className="py-1 text-[11px] text-gray-400">e mais {itens.length - 5}</li>}
        </ul>
      )}
    </div>
  );
  return (
    <Cartao titulo="Pendências" sub="Lançado no INOVE e ainda sem desfecho">
      {nada ? (
        <Vazio texto="Nada pendente." />
      ) : (
        <div className="space-y-4">
          {secao(
            "Trocas sem lançar no TransNet",
            trocas.length,
            "troca",
            trocas.map((t) => ({
              id: t.id,
              texto: `${t.ficha_troca || "—"} · ${semQuebra(t.prefixo_instalacao || t.prefixo_retirada || "")} · fogo ${t.numero_fogo_colocado || "—"}`,
              lado: `${t.dias} d`,
            }))
          )}
          {secao(
            "Consertos em aberto",
            consertos.length,
            "consertos",
            consertos.map((c) => ({
              id: c.id,
              texto: `fogo ${c.numero_fogo || "—"}${c.prefixo ? ` · ${semQuebra(c.prefixo)}` : ""} · ${c.status.toLowerCase()}`,
              lado: `${c.dias} d`,
            }))
          )}
          {secao(
            "Pneus riscados em aberto",
            riscados.length,
            "riscados",
            riscados.map((r) => ({
              id: r.id,
              texto: `fogo ${r.numero_fogo || "—"}${r.prefixo ? ` · ${semQuebra(r.prefixo)}` : ""} · ${r.status.toLowerCase()}`,
              lado: `${r.dias} d`,
            }))
          )}
        </div>
      )}
    </Cartao>
  );
}

/* ---------------- Tela ---------------- */
export default function PneusResumo({ conferencia, lancamentos, erroLancamentos, onIrPara }) {
  const temConf = conferencia !== undefined;
  const temLanc = lancamentos !== undefined;

  const kpisConf = useMemo(() => {
    if (!conferencia) return null;
    const pct = pctDe(conferencia.okPosicoes, conferencia.totalPosicoes);
    return { pct, divergentes: conferencia.comDivergencia.length, veiculos: conferencia.veiculos };
  }, [conferencia]);

  const carregando = "…";
  const consertosPorStatus = lancamentos
    ? lancamentos.consertosAbertos.reduce((m, c) => ({ ...m, [c.status]: (m[c.status] || 0) + 1 }), {})
    : {};

  return (
    <div className="space-y-5">
      {erroLancamentos && (
        <div className="rounded-xl bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-4 py-3 text-sm flex items-center gap-2">
          <FaExclamationTriangle aria-hidden /> Não foi possível carregar os lançamentos: {erroLancamentos}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {temConf && (
          <Kpi
            rotulo="Posições que batem com o TransNet"
            valor={kpisConf ? fmtPct(kpisConf.pct) : carregando}
            detalhe={kpisConf ? `${fmtInt(conferencia.okPosicoes)} de ${fmtInt(conferencia.totalPosicoes)} posições` : "carregando a conferência"}
            medidor={kpisConf ? { valor: conferencia.okPosicoes, total: conferencia.totalPosicoes } : null}
            tom={!kpisConf ? "neutro" : kpisConf.pct >= 95 ? "bom" : kpisConf.pct >= 85 ? "alerta" : "critico"}
            IconeProprio={kpisConf && kpisConf.pct >= 95 ? FaCheckCircle : undefined}
            onClick={() => onIrPara("veiculos")}
          />
        )}
        {temConf && (
          <Kpi
            rotulo="Carros com divergência"
            valor={kpisConf ? fmtInt(kpisConf.divergentes) : carregando}
            complemento={kpisConf ? `de ${fmtInt(kpisConf.veiculos)}` : null}
            detalhe={kpisConf ? (kpisConf.divergentes ? "posição diferente do TransNet" : "nenhuma divergência") : null}
            tom={!kpisConf ? "neutro" : kpisConf.divergentes ? "critico" : "bom"}
            IconeProprio={FaBus}
            onClick={() => onIrPara("veiculos")}
          />
        )}
        {temLanc && (
          <Kpi
            rotulo="Auditoria atrasada"
            valor={lancamentos ? fmtInt(lancamentos.auditoriaAtrasada.length) : carregando}
            complemento={lancamentos ? `de ${fmtInt(lancamentos.frota)}` : null}
            detalhe={lancamentos ? "carros sem auditoria há +30 dias" : null}
            tom={!lancamentos ? "neutro" : lancamentos.auditoriaAtrasada.length ? "alerta" : "bom"}
            IconeProprio={FaClipboardCheck}
            onClick={() => onIrPara("auditoria")}
          />
        )}
        {temLanc && (
          <Kpi
            rotulo="Trocas nesta semana"
            valor={lancamentos ? fmtInt(lancamentos.trocasSemana) : carregando}
            detalhe={
              lancamentos
                ? lancamentos.trocasSemLancar.length
                  ? `${plural(lancamentos.trocasSemLancar.length, "sem lançar", "sem lançar")} no TransNet`
                  : "todas lançadas no TransNet"
                : null
            }
            tom={!lancamentos ? "neutro" : lancamentos.trocasSemLancar.length ? "critico" : "bom"}
            IconeProprio={FaExchangeAlt}
            onClick={() => onIrPara("troca")}
          />
        )}
        {temLanc && (
          <Kpi
            rotulo="Consertos em aberto"
            valor={lancamentos ? fmtInt(lancamentos.consertosAbertos.length) : carregando}
            detalhe={
              lancamentos
                ? lancamentos.consertosAbertos.length
                  ? Object.entries(consertosPorStatus).map(([s, n]) => `${n} ${s.toLowerCase()}`).join(" · ")
                  : "nenhum no borracheiro"
                : null
            }
            tom={!lancamentos ? "neutro" : lancamentos.consertosAbertos.length ? "alerta" : "bom"}
            IconeProprio={FaTools}
            onClick={() => onIrPara("consertos")}
          />
        )}
        {temLanc && (
          <Kpi
            rotulo="Pneus riscados em aberto"
            valor={lancamentos ? fmtInt(lancamentos.riscadosAbertos.length) : carregando}
            detalhe={
              lancamentos
                ? lancamentos.riscadosVelhos
                  ? `${plural(lancamentos.riscadosVelhos, "há 10+ dias", "há 10+ dias")}`
                  : "nenhum há 10+ dias"
                : null
            }
            tom={!lancamentos ? "neutro" : lancamentos.riscadosVelhos ? "critico" : lancamentos.riscadosAbertos.length ? "alerta" : "bom"}
            IconeProprio={lancamentos?.riscadosAbertos.length ? FaExclamationTriangle : undefined}
            onClick={() => onIrPara("riscados")}
          />
        )}
      </div>

      {(temLanc || temConf) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {temLanc && <CartaoTrocas lancamentos={lancamentos} onIrPara={onIrPara} />}
          {temConf && <CartaoStatus conferencia={conferencia} onIrPara={onIrPara} />}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {temConf && <CartaoDivergencias conferencia={conferencia} onIrPara={onIrPara} />}
        {temLanc && <CartaoAuditoria lancamentos={lancamentos} onIrPara={onIrPara} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {temConf && <CartaoEstoque conferencia={conferencia} onIrPara={onIrPara} />}
        {temConf && <CartaoTransnet conferencia={conferencia} onIrPara={onIrPara} />}
        {temLanc && <CartaoPendencias lancamentos={lancamentos} onIrPara={onIrPara} />}
      </div>
    </div>
  );
}
