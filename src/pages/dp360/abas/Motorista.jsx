import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, RefreshCw, UserRound, X } from "lucide-react";
import AbaShell from "./AbaShell";
import { lerDP360, lerTudoDP360 } from "../../../services/dp360Api";
import { GARAGEM, dentroDoLocal, distanciaM, localConhecido } from "../regrasGps";

// Porte da tela "por motorista" do DP360 (Sistemas/PONTO: app/ui/app.js `viewMotorista`
// + `renderMot`, e app/main.py `get_pessoas_lista` / `get_pontos_pessoa`).
//
// Só LEITURA. A regra de negócio (status_ponto, motivo, alvo_*, *_sug) já vem calculada
// pelas views do Athena e chega pronta em `ponto_diario` — a tela apenas apresenta.
// Nada aqui grava.

/* ────────────────────────────── constantes portadas ────────────────────────────── */

// LOCAIS oficiais, raios e Haversine vêm do módulo `../regrasGps` (porte de
// app/main.py). Não duplicar a lista aqui: os quatro "PIV" saíram dela em 18/08 e
// uma segunda cópia é justamente como eles voltariam sem ninguém notar.

const DIAS_SEM = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const JANELA_PADRAO_DIAS = 30; // período inicial: fim − 30 dias (a base guarda ~70 dias)

/* ─────────────────────────────────── helpers ──────────────────────────────────── */

// Os booleanos do lake chegam como STRING "true"/"false". Comparar com === true dava
// sempre falso e escondia feriado.
const ehVerdade = (v) => v === true || String(v ?? "").trim().toLowerCase() === "true";

const soData = (v) => String(v ?? "").slice(0, 10);

/** "0410" → "04:10"; "410" → "04:10"; "04:10" → "04:10"; vazio → "". */
function fmtHora(valor) {
  const s = String(valor ?? "").trim();
  if (!s) return "";
  if (s.includes(":")) return s.slice(0, 5);
  const d = s.replace(/\D/g, "");
  if (d.length === 3) return `0${d[0]}:${d.slice(1)}`;
  if (d.length === 4) return `${d.slice(0, 2)}:${d.slice(2)}`;
  return "";
}

/** Minutos (pode passar de 1440 em turno que cruza a meia-noite) → "HH:MM". */
function min2hm(valor) {
  if (valor === null || valor === undefined || valor === "") return "";
  const n = Number(valor);
  if (!Number.isFinite(n)) return "";
  const m = ((Math.round(n) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "2026-08-04" → "04/08/2026". */
function fmtData(iso) {
  const d = soData(iso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d || "—";
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

function diaSemana(iso) {
  const d = soData(iso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  const [y, m, dd] = d.split("-").map(Number);
  const dt = new Date(y, m - 1, dd);
  return Number.isNaN(dt.getTime()) ? "" : DIAS_SEM[dt.getDay()];
}

/** Soma dias SEM passar por toISOString (que devolve UTC e vira o dia seguinte à noite). */
function somarDias(iso, n) {
  const d = soData(iso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const [y, m, dd] = d.split("-").map(Number);
  const dt = new Date(y, m - 1, dd);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Carimbo do banco (data ou data+hora) em pt-BR. */
function fmtQuando(valor) {
  const s = String(valor ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return fmtData(s);
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return s;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(dt);
}

/* ────────────────────────────────── GPS ───────────────────────────────────────── */

// ATENÇÃO — RÉGUA DIFERENTE DA REVISÃO, DE PROPÓSITO.
// A grade "por motorista" do app original usa a régua SIMPLES: a batida vale se estiver
// a até 100 m de um LOCAL CONHECIDO (garagem/terminal/estação). Ela NÃO mede contra a
// posição operacional do veículo, e portanto não tem "não medido" nem regra de reserva —
// veja `get_pontos_pessoa` em app/main.py:7390-7403 ("mesma lógica do get_gps_flags" no
// comentário, mas o código de fato só usa `_local_conhecido` + `_local_dentro`).
// A régua completa (veículo 500 m, reserva, não medido) é a da Revisão, em `reguaLocal`.
// Aqui só trocamos o código duplicado pelas funções do módulo — a semântica da coluna
// GPS continua exatamente a mesma.

function fmtDistancia(metros) {
  const d = Number(metros) || 0;
  return d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d} m`;
}

/** Normaliza uma linha de `ponto_gps` já com o local conhecido resolvido. */
function analisarBatidaGps(linha) {
  const lat = Number(linha.latitude);
  const lon = Number(linha.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const perto = localConhecido(lat, lon);
  return {
    dia: soData(linha.date_ref),
    hora: String(linha.hora ?? "").slice(0, 5),
    local: perto?.nome || "",
    distLocal: perto?.distancia ?? null,
    dentro: !!perto && dentroDoLocal(perto.nome, perto.distancia),
    distGaragem: distanciaM(lat, lon, GARAGEM.lat, GARAGEM.lon),
  };
}

/** Agrega as batidas com GPS por dia: total, quantas fora, maior distância da garagem. */
function agregarGpsPorDia(linhas) {
  const mapa = {};
  for (const bruta of linhas) {
    const b = analisarBatidaGps(bruta);
    if (!b || !b.dia) continue;
    const acc = mapa[b.dia] || (mapa[b.dia] = { total: 0, fora: 0, dist: 0, hora: "" });
    acc.total += 1;
    if (!b.dentro) {
      acc.fora += 1;
      if (b.distGaragem > acc.dist) {
        acc.dist = b.distGaragem;
        acc.hora = b.hora;
      }
    }
  }
  return mapa;
}

/* ─────────────────────── cartão de ponto e situação do dia ────────────────────── */

const horaOuVazio = (v) => fmtHora(v);
const temHora = (v) => /^\d{1,2}:\d{2}$/.test(String(v || ""));
const temRegistro = (v) => /\b\d{1,2}:\d{2}\b/.test(String(v || ""));

/**
 * As 4 posições do cartão: entrada · saída almoço · volta almoço · saída.
 * Porte do `cartoesAviso().atual` do app antigo — reduzir só às pontas escondia batidas
 * existentes e produzia falso "Sem ponto".
 */
function cartaoAtual(x) {
  const bruto = String(x.batidas_limpas || x.depois || x.antes || "");
  const brutoQuatro = (bruto.match(/\b\d{1,2}:\d{2}\b/g) || []).slice(0, 4);
  const almocoLancado = [horaOuVazio(x.alvo_alm_saida), horaOuVazio(x.alvo_alm_volta)];

  // Se as duas únicas batidas são exatamente o almoço que o DP já lançou, elas NÃO são as
  // pontas do cartão: entrada e saída seguem vazias.
  const soAlmocoLancado =
    brutoQuatro.length === 2 &&
    almocoLancado.every(Boolean) &&
    brutoQuatro[0] === almocoLancado[0] &&
    brutoQuatro[1] === almocoLancado[1];
  if (soAlmocoLancado) return ["", brutoQuatro[0], brutoQuatro[1], ""];

  // `ponto_diario.saida` é a 4ª posição do cartão importado; em cartão com inserção ela
  // pode não ser a saída do dia. Lê pelas marcações tipadas (E/S) quando existirem.
  const marcacoes = [...String(x.todas_batidas || "").matchAll(/\b([ES])\s*(\d{1,2}:\d{2})/gi)].map(
    (m) => ({ tipo: m[1].toUpperCase(), hora: horaOuVazio(m[2]) }),
  );
  let tipado = [];
  const iEnt = marcacoes.findIndex((m) => m.tipo === "E");
  const iAlmSai = marcacoes.findIndex((m, i) => i > iEnt && m.tipo === "S");
  const iAlmVolta = marcacoes.findIndex((m, i) => i > iAlmSai && m.tipo === "E");
  const iSai = marcacoes.reduce((ult, m, i) => (i > iAlmVolta && m.tipo === "S" ? i : ult), -1);
  if (iEnt >= 0 && iSai >= 0) {
    const temAlmoco = iAlmSai >= 0 && iAlmVolta >= 0;
    tipado = [
      marcacoes[iEnt].hora,
      temAlmoco ? marcacoes[iAlmSai].hora : "",
      temAlmoco ? marcacoes[iAlmVolta].hora : "",
      marcacoes[iSai].hora,
    ];
  }

  const apurado = [x.entrada, x.saida_almoco, x.volta_almoco, x.saida].map(horaOuVazio);
  const atual = tipado[0] && tipado[3] ? tipado : apurado[0] && apurado[3] ? apurado : brutoQuatro;
  return [0, 1, 2, 3].map((i) => atual[i] || "");
}

/** A sugestão é o alvo canônico; `*_sug` só entra quando o alvo não foi publicado. */
function cartaoSugestao(x) {
  return [
    horaOuVazio(x.alvo_entrada || x.entrada_sug),
    horaOuVazio(x.alvo_alm_saida || x.almoco_saida_sug),
    horaOuVazio(x.alvo_alm_volta || x.almoco_volta_sug),
    horaOuVazio(x.alvo_saida || x.saida_sug),
  ];
}

function temPonto(x) {
  if (cartaoAtual(x).some(temHora)) return true;
  if ([x.todas_batidas, x.batidas_limpas, x.antes, x.depois].some(temRegistro)) return true;
  return [x.entrada, x.saida, x.saida_almoco, x.volta_almoco].some((h) => temHora(fmtHora(h)));
}

/**
 * Precedência da situação (não inverter):
 *  1. `tipo_dia`/`te_descricao_dia` preenchido → o texto do RH manda;
 *  2. `eh_feriado`;
 *  3. nenhuma batida → "Sem ponto";
 *  4. `status_ponto` — mas "SEM_PONTO" com batida no cartão vira "REVISAR": a tela não
 *     pode chamar de sem ponto só porque o status salvo ainda não foi reprocessado.
 */
function situacaoDoDia(x) {
  const td = String(x.tipo_dia ?? "").toUpperCase();
  const desc = String(x.te_descricao_dia ?? "").trim();
  if (td || desc) {
    const tom = /FALTA/.test(td)
      ? "falta"
      : /ATEST/.test(td)
        ? "atest"
        : /FERIAS|AFAST|LICEN|SUSPENS|INSS|MATERN|PATERN/.test(td)
          ? "afast"
          : /COMP/.test(td)
            ? "comp"
            : /FOLGA|DSR/.test(td)
              ? "folga"
              : /FERIADO/.test(td)
                ? "feriado"
                : "just";
    return { tom, texto: desc || td.replace(/_/g, " ") };
  }
  if (ehVerdade(x.eh_feriado)) return { tom: "feriado", texto: "Feriado" };
  if (!temPonto(x)) return { tom: "sem", texto: "Sem ponto" };
  const status = x.status_ponto === "SEM_PONTO" ? "REVISAR" : x.status_ponto || "REVISAR";
  return { tom: status === "OK" ? "ok" : "rev", texto: status };
}

const TONS = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rev: "border-amber-200 bg-amber-50 text-amber-800",
  falta: "border-rose-300 bg-rose-100 text-rose-800",
  atest: "border-sky-200 bg-sky-50 text-sky-700",
  afast: "border-violet-200 bg-violet-50 text-violet-700",
  comp: "border-amber-200 bg-amber-50 text-amber-800",
  folga: "border-blue-200 bg-blue-50 text-blue-700",
  feriado: "border-emerald-200 bg-emerald-50 text-emerald-700",
  just: "border-slate-200 bg-slate-100 text-slate-700",
  sem: "border-slate-300 bg-slate-200 text-slate-700",
};

/* ────────────────────────── crachá: 7 ou 8 dígitos no lake ────────────────────── */

function variantesCracha(cracha) {
  const cr = String(cracha || "").trim();
  if (!cr) return [];
  const vs = new Set([cr, cr.replace(/^0+/, ""), cr.padStart(8, "0")]);
  return [...vs].filter((v) => /^[A-Za-z0-9_-]+$/.test(v));
}

const filtroCracha = (cracha) => `in.(${variantesCracha(cracha).join(",")})`;

/* ──────────────────────────── pedacinhos de interface ─────────────────────────── */

function Chip({ tom = "slate", children }) {
  const cores = {
    slate: "border-slate-200 bg-slate-100 text-slate-700",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
    folga: "border-blue-200 bg-blue-50 text-blue-700",
    afast: "border-violet-200 bg-violet-50 text-violet-700",
    sem: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${cores[tom] || cores.slate}`}>
      {children}
    </span>
  );
}

function Vazio() {
  return <span className="text-slate-300">—</span>;
}

/** Cartão de 4 posições; `destaque[i]` marca a posição que a sugestão quer mudar. */
function LinhaCartao({ horas, destaque }) {
  if (!horas.some(Boolean)) return <Vazio />;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      {horas.map((h, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-slate-300">·</span>}
          <span
            className={
              destaque?.[i]
                ? "rounded bg-amber-100 px-1 font-bold text-amber-800"
                : h
                  ? "text-slate-700"
                  : "text-slate-300"
            }
          >
            {h || "—"}
          </span>
        </span>
      ))}
    </span>
  );
}

function BadgeSituacao({ situacao }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-1 text-xs font-bold ${TONS[situacao.tom] || TONS.just}`}
    >
      {situacao.texto}
    </span>
  );
}

function BadgeGps({ gps }) {
  if (!gps || !gps.total) return <Vazio />;
  if (!gps.fora) {
    return (
      <span
        className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"
        title={`Todas as ${gps.total} batidas em local conhecido (garagem/terminal).`}
      >
        ✓ local
      </span>
    );
  }
  const txt = fmtDistancia(gps.dist);
  return (
    <span
      className="inline-block rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700"
      title={`${gps.fora} de ${gps.total} batida(s) FORA de local conhecido. Mais longe: ${txt} da garagem${gps.hora ? ` às ${gps.hora}` : ""}.`}
    >
      📍 {gps.fora}/{gps.total} · {txt}
    </span>
  );
}

function Campo({ rotulo, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{rotulo}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800">{children}</div>
    </div>
  );
}

/* ─────────────────────── painel lateral: detalhe de um dia ────────────────────── */

const ETAPAS_CASO = [
  { chave: "aviso_enviado_em", rotulo: "Aviso enviado" },
  { chave: "aviso_conferido_em", rotulo: "Aviso visto pelo colaborador" },
  { chave: "conferido_em", rotulo: "Executado no Transnet" },
  { chave: "advertencia_enviada_em", rotulo: "Advertência enviada" },
  { chave: "correcao_final_em", rotulo: "Correção do ponto" },
];

function TrilhaCaso({ caso }) {
  const aceite = String(caso.aceite ?? "").trim();
  const ajuste = String(caso.ajuste ?? "").trim();
  const decisao =
    aceite === "aceito"
      ? "aceitou — o ponto fica como ele pediu"
      : aceite === "rejeitado"
        ? "recusou o pedido"
        : aceite && aceite !== "pendente"
          ? aceite
          : "";

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 p-4">
      <div className="text-xs font-black uppercase tracking-wide text-slate-500">
        Trilha do caso
      </div>
      <ol className="mt-3 space-y-3">
        <li className="flex gap-3">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
          <div>
            <div className="text-sm font-bold text-slate-800">Decisão do DP</div>
            <div className="text-xs font-semibold text-slate-500">
              {decisao || "sem decisão registrada"}
              {ajuste && ajuste !== "nao_ajustou" ? ` · ajuste ${ajuste}` : ""}
            </div>
          </div>
        </li>
        {ETAPAS_CASO.map((etapa) => {
          const quando = String(caso[etapa.chave] ?? "").trim();
          return (
            <li key={etapa.chave} className="flex gap-3">
              <span
                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${quando ? "bg-blue-600" : "bg-slate-200"}`}
              />
              <div>
                <div
                  className={`text-sm font-bold ${quando ? "text-slate-800" : "text-slate-400"}`}
                >
                  {etapa.rotulo}
                </div>
                <div className="text-xs font-semibold text-slate-500">
                  {quando ? fmtQuando(quando) : "—"}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PainelDia({ dia, pessoa, batidasGps, caso, aoFechar }) {
  useEffect(() => {
    const tecla = (e) => {
      if (e.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aoFechar]);

  if (!dia) return null;
  const situacao = situacaoDoDia(dia);
  const atual = cartaoAtual(dia);
  const sugestao = cartaoSugestao(dia);
  const escalaIni = fmtHora(dia.programado_entrada || dia.esc_entrada);
  const escalaFim = fmtHora(dia.programado_saida || dia.esc_saida);
  const opIni = min2hm(dia.operacao_ini_min);
  const opFim = min2hm(dia.operacao_fim_min);
  const data = soData(dia.date_ref);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
      role="presentation"
      onClick={aoFechar}
    >
      <aside
        className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhe do dia ${fmtData(data)}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {pessoa?.nome || "Colaborador"} · {pessoa?.cracha || dia.cracha || ""}
            </div>
            <h3 className="text-xl font-black text-slate-900">
              {fmtData(data)} <span className="text-slate-400">· {diaSemana(data)}</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            aria-label="Fechar detalhe"
          >
            <X size={17} />
          </button>
        </div>

        <div className="mt-4">
          <BadgeSituacao situacao={situacao} />
          {dia.status_ponto === "REVISAR" && dia.motivo && (
            <p className="mt-2 text-sm font-semibold text-slate-600">{String(dia.motivo)}</p>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Ponto batido">
            <LinhaCartao horas={atual} />
          </Campo>
          <Campo rotulo="Sugestão">
            <LinhaCartao
              horas={sugestao}
              destaque={sugestao.map((v, i) => !!v && v !== atual[i])}
            />
          </Campo>
          <Campo rotulo="Escala">
            {escalaIni || escalaFim ? `${escalaIni || "—"} – ${escalaFim || "—"}` : <Vazio />}
          </Campo>
          <Campo rotulo="Operação">
            {opIni || opFim ? `${opIni || "—"} – ${opFim || "—"}` : <Vazio />}
          </Campo>
          <Campo rotulo="Jornada">{dia.jornada_horas || <Vazio />}</Campo>
          <Campo rotulo="Categoria">{dia.categoria || <Vazio />}</Campo>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            <MapPin size={14} /> Batidas com GPS
          </div>
          {/* TODO(mapa): o app antigo desenha as cercas de 100 m num Leaflet. Aqui só a
              lista com a distância — o mapa entra num passo posterior do porte. */}
          {batidasGps.length === 0 ? (
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Nenhuma batida com GPS neste dia.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {batidasGps.map((b, i) => (
                <li
                  key={`${b.hora}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
                >
                  <span className="text-sm font-bold tabular-nums text-slate-800">
                    {b.hora || "--:--"}
                  </span>
                  <span className="text-xs font-semibold text-slate-600">
                    {b.local} · {fmtDistancia(b.distLocal)}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                      b.dentro
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-rose-200 bg-rose-50 text-rose-700"
                    }`}
                    title={`${fmtDistancia(b.distGaragem)} da garagem`}
                  >
                    {b.dentro ? "local conhecido" : `fora · ${fmtDistancia(b.distGaragem)} da garagem`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {caso ? (
          <TrilhaCaso caso={caso} />
        ) : (
          <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
            Nenhum caso aberto para este dia.
          </p>
        )}
      </aside>
    </div>
  );
}

/* ─────────────────────────────────── a aba ────────────────────────────────────── */

export default function Motorista() {
  const [pessoas, setPessoas] = useState([]);
  const [faixa, setFaixa] = useState({ min: "", max: "" });
  const [carregandoBase, setCarregandoBase] = useState(true);
  const [erro, setErro] = useState("");

  const [busca, setBusca] = useState("");
  const [cracha, setCracha] = useState("");
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");

  const [dias, setDias] = useState([]);
  const [gpsBrutos, setGpsBrutos] = useState([]);
  const [casos, setCasos] = useState([]);
  const [carregandoDias, setCarregandoDias] = useState(false);
  const [diaAberto, setDiaAberto] = useState("");
  const [recarga, setRecarga] = useState(0);

  /* 1) lista de pessoas (distinct por crachá em `ponto_diario`) + faixa de datas. */
  useEffect(() => {
    let ativo = true;
    setCarregandoBase(true);
    setErro("");

    (async () => {
      // A faixa vem de duas consultas de 1 linha — barato e exato, sem varrer a tabela.
      const [maisNova, maisAntiga] = await Promise.all([
        lerDP360("ponto_diario", { colunas: "date_ref", ordem: "date_ref.desc", limite: 1 }),
        lerDP360("ponto_diario", { colunas: "date_ref", ordem: "date_ref.asc", limite: 1 }),
      ]);
      const dmax = soData(maisNova?.[0]?.date_ref);
      const dmin = soData(maisAntiga?.[0]?.date_ref);

      // Só as colunas leves do seletor: `ponto_diario` tem uma linha por pessoa por dia e
      // a janela é de ~70 dias — trazer o cartão inteiro aqui seria dezenas de MB.
      const linhas = await lerTudoDP360(
        "ponto_diario",
        { colunas: "cracha,nm_funcionario,categoria", ordem: "date_ref.desc,cracha" },
        60,
      );

      if (!ativo) return;
      const vistos = new Map();
      for (const l of linhas) {
        const cr = String(l.cracha ?? "").trim();
        if (!cr || vistos.has(cr)) continue;
        vistos.set(cr, {
          cracha: cr,
          nome: String(l.nm_funcionario ?? "").trim(),
          categoria: String(l.categoria ?? "").toUpperCase(),
        });
      }
      const lista = [...vistos.values()].sort((a, b) =>
        (a.nome || "").localeCompare(b.nome || "", "pt-BR"),
      );
      setPessoas(lista);
      setFaixa({ min: dmin, max: dmax });
      const base = dmax || dmin;
      if (base) {
        setFim((v) => v || base);
        setIni((v) => {
          if (v) return v;
          const trinta = somarDias(base, -JANELA_PADRAO_DIAS);
          return dmin && trinta < dmin ? dmin : trinta;
        });
      }
    })()
      .catch((falha) => {
        if (ativo) setErro(falha?.message || "Falha ao consultar a base DP360.");
      })
      .finally(() => {
        if (ativo) setCarregandoBase(false);
      });

    return () => {
      ativo = false;
    };
  }, [recarga]);

  const pessoa = useMemo(
    () => pessoas.find((p) => p.cracha === cracha) || null,
    [pessoas, cracha],
  );

  /** Resolve o texto digitado (nome, crachá ou "nome · crachá") num crachá da lista. */
  const resolverCracha = useCallback(
    (texto) => {
      const t = String(texto || "").trim();
      if (!t) return "";
      const numero = t.match(/([0-9]{3,})\s*$/);
      if (numero && pessoas.some((p) => p.cracha === numero[1])) return numero[1];
      const achado =
        pessoas.find((p) => `${p.nome} · ${p.cracha}` === t) ||
        pessoas.find((p) => p.cracha === t) ||
        pessoas.find((p) => (p.nome || "").toLowerCase() === t.toLowerCase());
      return achado ? achado.cracha : "";
    },
    [pessoas],
  );

  // Só troca quando o texto RESOLVE numa pessoa da lista (ou quando o campo é limpo).
  // Reagir a cada tecla derrubaria a tabela no meio da digitação de um nome.
  useEffect(() => {
    if (!busca.trim()) {
      if (cracha) setCracha("");
      return;
    }
    const resolvido = resolverCracha(busca);
    if (resolvido && resolvido !== cracha) setCracha(resolvido);
  }, [busca, resolverCracha, cracha]);

  /* 2) dias do período + GPS + casos do colaborador escolhido. */
  useEffect(() => {
    if (!cracha || !ini || !fim) {
      setDias([]);
      setGpsBrutos([]);
      setCasos([]);
      return undefined;
    }
    let ativo = true;
    setCarregandoDias(true);
    setErro("");
    const alvo = filtroCracha(cracha);
    // O gateway indexa os filtros por coluna, então `date_ref` só aceita UM operador.
    // Corta o fim no cliente — a janela inteira da base tem ~70 dias.
    const dentroDoPeriodo = (linha) => {
      const d = soData(linha.date_ref);
      return d && d >= ini && d <= fim;
    };

    Promise.all([
      lerTudoDP360("ponto_diario", {
        filtros: { cracha: alvo, date_ref: `gte.${ini}` },
        ordem: "date_ref.asc",
      }),
      lerTudoDP360("ponto_gps", {
        colunas: "date_ref,hora,latitude,longitude",
        filtros: { cracha: alvo, date_ref: `gte.${ini}`, latitude: "not.is.null" },
        ordem: "date_ref.asc,hora.asc",
      }),
      lerTudoDP360("ponto_caso", {
        filtros: { cracha: alvo, date_ref: `gte.${ini}` },
        ordem: "date_ref.asc",
      }),
    ])
      .then(([linhasDia, linhasGps, linhasCaso]) => {
        if (!ativo) return;
        setDias(
          linhasDia
            .filter(dentroDoPeriodo)
            .sort((a, b) => soData(a.date_ref).localeCompare(soData(b.date_ref))),
        );
        setGpsBrutos(linhasGps.filter(dentroDoPeriodo));
        setCasos(linhasCaso.filter(dentroDoPeriodo));
      })
      .catch((falha) => {
        if (!ativo) return;
        setErro(falha?.message || "Falha ao consultar a base DP360.");
        setDias([]);
        setGpsBrutos([]);
        setCasos([]);
      })
      .finally(() => {
        if (ativo) setCarregandoDias(false);
      });

    return () => {
      ativo = false;
    };
  }, [cracha, ini, fim, recarga]);

  const gpsPorDia = useMemo(() => agregarGpsPorDia(gpsBrutos), [gpsBrutos]);

  const batidasPorDia = useMemo(() => {
    const mapa = {};
    for (const bruta of gpsBrutos) {
      const b = analisarBatidaGps(bruta);
      if (!b || !b.dia) continue;
      (mapa[b.dia] || (mapa[b.dia] = [])).push(b);
    }
    for (const lista of Object.values(mapa)) lista.sort((a, b) => a.hora.localeCompare(b.hora));
    return mapa;
  }, [gpsBrutos]);

  const casoPorDia = useMemo(() => {
    const mapa = {};
    for (const c of casos) {
      const d = soData(c.date_ref);
      if (d) mapa[d] = c;
    }
    return mapa;
  }, [casos]);

  const contadores = useMemo(() => {
    const c = { total: dias.length, ponto: 0, folga: 0, afast: 0, sem: 0 };
    for (const dia of dias) {
      const { tom } = situacaoDoDia(dia);
      if (tom === "ok" || tom === "rev") c.ponto += 1;
      else if (tom === "folga" || tom === "comp" || tom === "feriado") c.folga += 1;
      else if (tom === "afast" || tom === "atest") c.afast += 1;
      else if (tom === "sem" || tom === "falta") c.sem += 1;
    }
    return c;
  }, [dias]);

  const diaSelecionado = useMemo(
    () => dias.find((d) => soData(d.date_ref) === diaAberto) || null,
    [dias, diaAberto],
  );

  const acoes = (
    <button
      type="button"
      onClick={() => setRecarga((n) => n + 1)}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
    >
      <RefreshCw size={15} /> Recarregar
    </button>
  );

  return (
    <AbaShell
      icone={UserRound}
      titulo="Motorista"
      resumo="Histórico individual dia a dia: ponto batido, escala, operação, sugestão, GPS e a trilha do caso."
      carregando={carregandoBase}
      erro={erro}
      acoes={acoes}
    >
      {/* filtros */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-end">
        <div className="flex-1">
          <label
            htmlFor="dp360-mot-pessoa"
            className="text-[11px] font-bold uppercase tracking-wide text-slate-500"
          >
            Colaborador
          </label>
          <input
            id="dp360-mot-pessoa"
            list="dp360-mot-lista"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoComplete="off"
            placeholder="Nome ou crachá…"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500"
          />
          <datalist id="dp360-mot-lista">
            {pessoas.map((p) => (
              <option key={p.cracha} value={`${p.nome} · ${p.cracha}`} />
            ))}
          </datalist>
        </div>

        <div>
          <label
            htmlFor="dp360-mot-ini"
            className="text-[11px] font-bold uppercase tracking-wide text-slate-500"
          >
            De
          </label>
          <input
            id="dp360-mot-ini"
            type="date"
            value={ini}
            min={faixa.min || undefined}
            max={faixa.max || undefined}
            onChange={(e) => setIni(e.target.value)}
            className="mt-1 block rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label
            htmlFor="dp360-mot-fim"
            className="text-[11px] font-bold uppercase tracking-wide text-slate-500"
          >
            Até
          </label>
          <input
            id="dp360-mot-fim"
            type="date"
            value={fim}
            min={faixa.min || undefined}
            max={faixa.max || undefined}
            onChange={(e) => setFim(e.target.value)}
            className="mt-1 block rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {pessoa && (
        <p className="mt-3 text-sm font-semibold text-slate-600">
          {pessoa.nome} · crachá {pessoa.cracha}
          {pessoa.categoria ? ` · ${pessoa.categoria}` : ""}
        </p>
      )}

      {/* faixa-resumo */}
      {!!dias.length && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip>{contadores.total} dias</Chip>
          <Chip tom="ok">{contadores.ponto} c/ ponto</Chip>
          <Chip tom="folga">{contadores.folga} folga/feriado</Chip>
          <Chip tom="afast">{contadores.afast} afast/atest</Chip>
          <Chip tom="sem">{contadores.sem} sem ponto/falta</Chip>
        </div>
      )}

      {/* tabela */}
      <div className="mt-5">
        {!cracha ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
            Selecione um colaborador para ver os pontos do período.
          </p>
        ) : carregandoDias ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
            Carregando os dias do período…
          </p>
        ) : !dias.length ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
            Nenhum registro nesse período para esse colaborador.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Data</th>
                  <th className="px-3 py-3">Dia</th>
                  <th className="px-3 py-3">Ponto batido</th>
                  <th className="px-3 py-3">Jornada</th>
                  <th className="px-3 py-3">Operação</th>
                  <th className="px-3 py-3">Escala</th>
                  <th className="px-3 py-3">Sugestão</th>
                  <th className="px-3 py-3">GPS</th>
                  <th className="px-3 py-3">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dias.map((dia) => {
                  const data = soData(dia.date_ref);
                  const situacao = situacaoDoDia(dia);
                  const atual = cartaoAtual(dia);
                  const sugestao = cartaoSugestao(dia);
                  const escalaIni = fmtHora(dia.programado_entrada || dia.esc_entrada);
                  const escalaFim = fmtHora(dia.programado_saida || dia.esc_saida);
                  const opIni = min2hm(dia.operacao_ini_min);
                  const opFim = min2hm(dia.operacao_fim_min);
                  const temSugestao = sugestao.some(Boolean);
                  return (
                    <tr
                      key={data}
                      onClick={() => setDiaAberto(data)}
                      className="cursor-pointer hover:bg-blue-50/60"
                    >
                      <td className="px-3 py-2 font-bold tabular-nums text-slate-900">
                        {fmtData(data)}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{diaSemana(data)}</td>
                      <td className="px-3 py-2">
                        <LinhaCartao horas={atual} />
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-700">
                        {dia.jornada_horas || <Vazio />}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-700">
                        {opIni || opFim ? `${opIni || "—"} – ${opFim || "—"}` : <Vazio />}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-700">
                        {escalaIni || escalaFim ? (
                          `${escalaIni || "—"} – ${escalaFim || "—"}`
                        ) : (
                          <Vazio />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {temSugestao ? (
                          <LinhaCartao
                            horas={sugestao}
                            destaque={sugestao.map((v, i) => !!v && v !== atual[i])}
                          />
                        ) : (
                          <Vazio />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <BadgeGps gps={gpsPorDia[data]} />
                      </td>
                      <td className="px-3 py-2">
                        <BadgeSituacao situacao={situacao} />
                        {dia.status_ponto === "REVISAR" && dia.motivo && (
                          <div
                            className="mt-1 max-w-[16rem] truncate text-[11px] font-semibold text-slate-500"
                            title={String(dia.motivo)}
                          >
                            {String(dia.motivo).split(" (")[0]}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {diaSelecionado && (
        <PainelDia
          dia={diaSelecionado}
          pessoa={pessoa}
          batidasGps={batidasPorDia[diaAberto] || []}
          caso={casoPorDia[diaAberto] || null}
          aoFechar={() => setDiaAberto("")}
        />
      )}
    </AbaShell>
  );
}
