import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Lock, MapPin, RefreshCw, Search, X } from "lucide-react";
import AbaShell from "./AbaShell";
import { lerDP360, lerTudoDP360 } from "../../../services/dp360Api";

/* =============================================================================
   Revisão (Passo 2) — porte da tela do DP360 (Sistemas/PONTO: app/ui/app.js
   `viewP2`/`COLS_REV`/`p2RowClass`/`fmtCol`/`pontoDetalhe`).

   FASE ATUAL: SOMENTE LEITURA.
   A tela inteira e a UI de decisão estão montadas, mas nada grava: salvar Real
   manual, marcar ponto conferido e enviar aviso aparecem DESABILITADOS. Motivo:
   gravação errada aqui vira advertência indevida em cima de trabalhador. As
   chamadas ficam anotadas como TODO ao lado de cada botão.

   A REGRA DE NEGÓCIO NÃO MORA AQUI. `status_ponto`, `motivo`, `acao_sugerida`,
   `alvo_*`, `*_sug`, `almoco_*`, `pede_entrada/pede_saida`, `requer_alvo_manual`,
   `fonte_alvo` e `alvo_confiavel` já vêm calculados pela view do Athena
   (importador_supabase/sql_catalogo/3_vw_ponto_revisao_motorista.sql) e chegam
   prontos na `ponto_diario`. Esta tela só EXIBE. O único cálculo local é o de
   GPS ("bateu fora"), que o app antigo também fazia no cliente.
   ========================================================================== */

/* ---------- constantes (espelham main.py; mexeu aqui, mexe lá) ---------- */
const TOL_ENTRADA_MIN = 10; // minutos ANTES do início da operação
const TOL_SAIDA_MIN = 8; // minutos DEPOIS do fim da operação
const RAIO_VEIC = 500; // m — batida × posição operacional do veículo (gps_carro)
const RAIO_LOCAL = 100; // m — batida × local conhecido (garagem/terminal/estação)
const SUG_JORNADA_MAX_MIN = 13 * 60; // 780 min: acima disso não é jornada, é defeito
const DIVERGENCIA_BILHETAGEM_MIN = 20; // bilhetagem "fora da curva" na entrada

// Locais LEGÍTIMOS de batida (main.py:122 LOCAIS). Os 4 "PIV" saíram em 18/08 e
// não voltam sem o DP mandar — eles legitimavam justamente a batida distante.
const LOCAIS = [
  ["Garagem 046", -23.4801, -46.3032],
  ["Terminal Santa Tereza", -23.505333, -46.357778],
  ["Terminal GCM", -23.487727, -46.349599],
  ["Terminal Manoel Feio", -23.479842, -46.367979],
  ["Estação Lado de Baixo", -23.485251, -46.348544],
  ["Apoio Estação", -23.485393, -46.347392],
  ["MOOV", -23.47468, -46.349947],
  ["Estação Itaqua lado de cima", -23.489316, -46.349816],
];

const CATEGORIAS_PADRAO = ["MOTORISTA", "INTERNO", "APRENDIZ"];
const PAGINAS_POR_LOTE = 6; // 6 × 1000 linhas de ponto_diario ≈ 15 dias de datas
const TRAVA_GRAVACAO = "Gravação liberada na próxima fase (validação pendente)";

/* ---------- helpers de formato ---------- */
// Booleano do PostgREST/Athena chega como STRING. Mesma lista do app antigo.
const ehVerdadeiro = (v) => ["true", "t", "1", "sim"].includes(String(v ?? "").trim().toLowerCase());

const cra8 = (c) => {
  const s = String(c ?? "").trim();
  return /^\d{1,7}$/.test(s) ? s.padStart(8, "0") : s;
};

const chaveDia = (cracha, dia) => `${cra8(cracha)}|${String(dia ?? "").slice(0, 10)}`;

const fmtHora = (v) => {
  const s = String(v ?? "").trim();
  if (!s || s === "--" || s === "-") return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
};

const hm2m = (v) => {
  const s = fmtHora(v);
  if (!s) return null;
  const [h, m] = s.split(":").map(Number);
  return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
};

const fmtMin = (v) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n <= 0) return "—";
  return `${Math.floor(n / 60)}h${String(n % 60).padStart(2, "0")}`;
};

const fmtData = (iso) => {
  const s = String(iso ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

const fmtDataHora = (v) => {
  const s = String(v ?? "").trim();
  if (!s || s === "registrada") return "";
  return `${fmtData(s.slice(0, 10))}${s.length > 10 ? ` ${s.slice(11, 16)}` : ""}`;
};

const fmtDist = (d) => (d == null ? "—" : d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`);

// Jornada entre duas pontas, com virada de meia-noite e desconto opcional do almoço.
function durHM(ini, fim, descontar = 0) {
  const a = hm2m(ini);
  const b = hm2m(fim);
  if (a == null || b == null) return "—";
  let bruta = b - a;
  if (bruta < 0) bruta += 1440;
  const liq = bruta - (descontar || 0);
  if (liq <= 0) return "—";
  return `${Math.floor(liq / 60)}h${String(liq % 60).padStart(2, "0")}`;
}

const difCircularMin = (a, b) => {
  const d = Math.abs(a - b);
  return Math.min(d, 1440 - d);
};

/* ---------- GPS: batida fora de lugar ---------- */
function haversine(la1, lo1, la2, lo2) {
  const rad = Math.PI / 180;
  const dla = (la2 - la1) * rad;
  const dlo = (lo2 - lo1) * rad;
  const a =
    Math.sin(dla / 2) ** 2 + Math.cos(la1 * rad) * Math.cos(la2 * rad) * Math.sin(dlo / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function localConhecido(lat, lng) {
  let melhor = null;
  for (const [nome, la, lo] of LOCAIS) {
    const d = haversine(lat, lng, la, lo);
    if (!melhor || d < melhor.dist) melhor = { nome, dist: d };
  }
  return melhor;
}

const numero = (v) => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
};

/**
 * Régua da batida (espelha main.py `_regua_local` de forma simplificada).
 * A batida é medida contra a POSIÇÃO OPERACIONAL DO VEÍCULO (gps_carro) mais
 * próxima no relógio: acima de 500 m está fora. Sem âncora com coordenada, cai
 * para o local conhecido mais próximo, que só aceita até 100 m.
 * TODO(port DP360): a régua completa também trata dia de reserva (batida em
 * local conhecido vale por si) e âncora sem coordenada — porte junto do mapa.
 */
function calcularGps(batidas, ancoras) {
  const comCoord = (ancoras || []).filter((a) => numero(a.latitude) != null && numero(a.longitude) != null);
  const resumo = { total: 0, fora: 0, dist: null, hora: "", detalhes: [] };
  for (const b of batidas || []) {
    const la = numero(b.latitude);
    const lo = numero(b.longitude);
    if (la == null || lo == null) continue;
    resumo.total += 1;
    const bm = hm2m(b.hora);
    let ancora = null;
    for (const a of comCoord) {
      const am = hm2m(a.hora);
      const gap = am == null || bm == null ? 9999 : difCircularMin(am, bm);
      if (!ancora || gap < ancora.gap) ancora = { ...a, gap };
    }
    let dist = null;
    let fora = false;
    let referencia = "";
    if (ancora) {
      dist = haversine(la, lo, numero(ancora.latitude), numero(ancora.longitude));
      fora = dist > RAIO_VEIC;
      referencia = `veículo ${ancora.veiculo || ""}`.trim();
    } else {
      const perto = localConhecido(la, lo);
      dist = perto ? perto.dist : null;
      fora = !perto || perto.dist > RAIO_LOCAL;
      referencia = perto ? perto.nome : "local conhecido";
    }
    if (fora) {
      resumo.fora += 1;
      if (dist != null && (resumo.dist == null || dist > resumo.dist)) {
        resumo.dist = dist;
        resumo.hora = fmtHora(b.hora);
      }
    }
    resumo.detalhes.push({ hora: fmtHora(b.hora), dist, fora, referencia, origem: b.origem || "" });
  }
  return resumo;
}

/* ---------- regra da sugestão (exibição do que a view já decidiu) ---------- */
// A linha veio da view nova? Aí a decisão de alvo/almoço é dela, não nossa.
const temContratoView = (r) =>
  r.acao_sugerida != null || r.fonte_alvo != null || r.alvo_confiavel != null || r.requer_alvo_manual != null;

/**
 * Porte de main.py `_sug_bloqueio`: devolve o MOTIVO pelo qual a sugestão do dia
 * NÃO pode ser usada, ou "" se pode. Nada é recalculado — só lido dos campos.
 */
function sugBloqueio(r) {
  if (temContratoView(r)) {
    const acao = String(r.acao_sugerida ?? "").trim().toUpperCase();
    if (acao === "AJUSTAR_MANUAL") return "ponto invertido exige decisão manual do DP";
    if (!r.alvo_manual_dp && !ehVerdadeiro(r.alvo_confiavel)) {
      // POSSIVEL_RESERVA tem motivo próprio: o dia não está bloqueado por dado
      // ruim — ele bateu no horário da escala e a operação apareceu horas depois.
      if (String(r.fonte_alvo ?? "").trim().toUpperCase() === "POSSIVEL_RESERVA")
        return "possível reserva — validar antes de lançar";
      return "alvo exige decisão manual do DP";
    }
    if (acao === "LANCAR_ALMOCO_AUTOMATICO" && !ehVerdadeiro(r.almoco_confiavel))
      return "almoço sem base confiável";
  }
  const e = hm2m(r.entrada_sug);
  const s = hm2m(r.saida_sug);
  if (e == null || s == null) return "";
  let bruta = s - e;
  if (bruta < 0) bruta += 1440;
  const a1 = hm2m(r.almoco_saida_sug);
  const a2 = hm2m(r.almoco_volta_sug);
  const alm = a1 != null && a2 != null ? Math.max(0, a2 - a1) : 0;
  const liq = bruta - alm;
  if (liq <= 0) return "sugestão com jornada zero ou negativa";
  if (liq > SUG_JORNADA_MAX_MIN)
    return `sugestão daria ${Math.floor(liq / 60)}h${String(liq % 60).padStart(2, "0")} de jornada — acima do limite de 13h`;
  return "";
}

const temSugestaoUtil = (r, bloqueio = sugBloqueio(r)) =>
  !bloqueio && !!fmtHora(r.entrada_sug) && !!fmtHora(r.saida_sug);

const ehPontoInvertido = (r) =>
  String(r.motivo ?? "").trim().toUpperCase().startsWith("PONTO_INVERTIDO") ||
  String(r.acao_sugerida ?? "").trim().toUpperCase() === "AJUSTAR_MANUAL";

/**
 * Porte de app.js `marcacaoMotoristaAusente`: o que a view diz que FALTA. Não
 * deduza pelo número ou pela posição das batidas — almoço travado e batida
 * colada mudam essa ordem.
 */
function marcacaoAusente(r) {
  if (temContratoView(r)) {
    const entrada = ehVerdadeiro(r.pede_entrada);
    const saida = ehVerdadeiro(r.pede_saida);
    if (entrada && saida) return "ENTRADA E SAÍDA";
    if (entrada) return "ENTRADA";
    if (saida) return "SAÍDA";
    // Jornada inválida/suspeita só entra no comunicado depois de o DP cravar a
    // jornada: aí os campos definidos dizem quais pontas serão pedidas.
    const manual = ehVerdadeiro(r.requer_alvo_manual);
    const rmEnt = String(r.rm_entrada ?? "").trim();
    const rmSai = String(r.rm_saida ?? "").trim();
    if (manual && rmEnt && rmSai) return "ENTRADA E SAÍDA";
    if (manual && rmEnt) return "ENTRADA";
    if (manual && rmSai) return "SAÍDA";
    return "";
  }
  const mot = String(r.motivo ?? "").split(/[\s(]/)[0].toUpperCase();
  if (mot === "FALTA_ENTRADA") return "ENTRADA";
  if (mot === "FALTA_SAIDA") return "SAÍDA";
  return "";
}

// Cor da linha (porte de app.js `p2RowClass`, na mesma ordem de precedência):
// verde OK · âmbar ponto invertido · azul falta marcação identificada ·
// âmbar sugestão utilizável · vermelho sem sugestão e sem ponta identificada.
function classeLinha(r, bloqueio) {
  if (String(r.status_ponto ?? "").toUpperCase() === "OK")
    return "bg-emerald-50/70 hover:bg-emerald-100/70";
  if (ehPontoInvertido(r)) return "bg-amber-50 hover:bg-amber-100";
  if (marcacaoAusente(r)) return "bg-sky-50 hover:bg-sky-100";
  if (temSugestaoUtil(r, bloqueio)) return "bg-amber-50 hover:bg-amber-100";
  return "bg-rose-50 hover:bg-rose-100";
}

/* ---------- Real manual do DP (overlay de exibição) ---------- */
// Porte de main.py `get_revisao._rm`: o Real cravado pelo DP substitui a
// sugestão na tela. AQUI É SÓ LEITURA — nada é gravado nesta fase.
function aplicarRealManual(linha, rm) {
  if (!rm) return linha;
  const travado = ehVerdadeiro(linha.almoco_travado);
  const out = {
    ...linha,
    rm_entrada: rm.entrada || "",
    rm_alm_saida: rm.alm_saida || "",
    rm_alm_volta: rm.alm_volta || "",
    rm_saida: rm.saida || "",
    rm_por: rm.definido_por || "",
    rm_em: rm.definido_em || "",
  };
  if (rm.entrada) {
    out.entrada_sug = rm.entrada;
    out.alvo_entrada = rm.entrada;
  }
  if (rm.saida) {
    out.saida_sug = rm.saida;
    out.alvo_saida = rm.saida;
  }
  if (rm.alm_saida && !travado) {
    out.almoco_saida_sug = rm.alm_saida;
    out.alvo_saida_almoco = rm.alm_saida;
  }
  if (rm.alm_volta && !travado) {
    out.almoco_volta_sug = rm.alm_volta;
    out.alvo_volta_almoco = rm.alm_volta;
  }
  if (rm.entrada || rm.saida) {
    out.alvo_manual_dp = true;
    out.alvo_confiavel = "true";
    out.fonte_alvo = "DP_MANUAL";
  }
  return out;
}

/* ---------- pedaços de UI ---------- */
function Pilula({ texto, tom = "slate", titulo }) {
  const tons = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    emerald: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    amber: "bg-amber-100 text-amber-900 ring-amber-200",
    rose: "bg-rose-100 text-rose-800 ring-rose-200",
    sky: "bg-sky-100 text-sky-800 ring-sky-200",
  };
  return (
    <span
      title={titulo}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${tons[tom] || tons.slate}`}
    >
      {texto}
    </span>
  );
}

function BotaoTravado({ children, titulo, className = "" }) {
  return (
    <button
      type="button"
      disabled
      title={titulo || TRAVA_GRAVACAO}
      className={`inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-bold text-slate-400 ${className}`}
    >
      {children}
    </button>
  );
}

// Coluna "Avisado?" — porte de app.js `fmtCol("rv_enviado")`. O aviso da Revisão
// já era gravado em ponto_caso, mas a tela antiga nunca mostrou: não dava pra
// saber se o colaborador já tinha recebido a mensagem.
function Avisado({ caso }) {
  const enviado = String(caso?.aviso_enviado_em ?? "").trim();
  if (!enviado) return <Pilula texto="não" tom="slate" titulo="Nenhum aviso registrado para este dia" />;
  const quando = fmtData(enviado.slice(0, 10));
  if (String(caso.correcao_final_em ?? "").trim())
    return <Pilula texto="🔧 corrigido" tom="emerald" titulo={`Aviso em ${quando} — ponto já corrigido`} />;
  if (String(caso.advertencia_enviada_em ?? "").trim())
    return <Pilula texto="⚠ advertido" tom="rose" titulo={`Aviso em ${quando} — depois virou advertência`} />;
  if (String(caso.aceite ?? "").trim() === "aceito")
    return <Pilula texto="✓ resolvido" tom="emerald" titulo={`Aviso em ${quando} — ele ajustou e você aceitou`} />;
  const visto = String(caso.aviso_conferido_em ?? "").trim();
  if (visto)
    return (
      <Pilula
        texto={`👁 leu · ${quando}`}
        tom="slate"
        titulo={`Enviado em ${quando} · aberto no app em ${fmtData(visto.slice(0, 10))}`}
      />
    );
  return <Pilula texto={`📤 ${quando}`} tom="amber" titulo={`Enviado em ${quando} — ainda não abriu no app`} />;
}

function LocalGps({ gps }) {
  if (!gps || !gps.total) return <span className="text-slate-400">—</span>;
  if (!gps.fora)
    return (
      <span
        className="whitespace-nowrap font-bold text-emerald-700"
        title={`Todas as ${gps.total} batida(s) junto da referência operacional (≤ ${RAIO_VEIC} m do veículo).`}
      >
        ✓ junto ({gps.total})
      </span>
    );
  return (
    <span
      className="whitespace-nowrap font-bold text-rose-700"
      title={`${gps.fora} de ${gps.total} batida(s) FORA. A mais longe: ${fmtDist(gps.dist)}${gps.hora ? ` às ${gps.hora}` : ""}.`}
    >
      📍 {gps.fora}/{gps.total} fora · {fmtDist(gps.dist)}
    </span>
  );
}

// Coluna Motivo com os dois tratamentos especiais do app antigo.
function Motivo({ linha }) {
  const motivo = String(linha.motivo ?? "").trim();
  const status = String(linha.status_ponto ?? "").toUpperCase();
  const batidas = parseInt(linha.qtd_batidas, 10) || 0;
  if (status !== "OK" && batidas === 0 && /JORNADA_INCOMPLETA/i.test(motivo))
    return (
      <span
        className="whitespace-nowrap font-black text-rose-700"
        title="Há operação apurada no dia, mas nenhuma batida no cartão. O ponto tem de ser criado pela operação."
      >
        OPEROU SEM PONTO · criar pela operação
      </span>
    );
  if (ehPontoInvertido(linha))
    return (
      <span
        className="whitespace-nowrap font-black text-amber-700"
        title="Cartão rotacionado: defeito de posição das batidas. Exige decisão manual do DP — não gera comunicado ao colaborador."
      >
        {motivo || "PONTO_INVERTIDO"}
      </span>
    );
  if (!motivo) return <span className="text-slate-400">—</span>;
  return (
    <span className="whitespace-nowrap text-slate-700" title={motivo}>
      {motivo.split(" (")[0]}
    </span>
  );
}

function AvisoTrava({ motivo }) {
  if (!motivo) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
      ⚠ Sugestão bloqueada — {motivo}. Não dá para avisar nem lançar; o DP precisa cravar o Real na mão.
    </div>
  );
}

/* ---------- pop-up do cartão ---------- */
function LinhaFonte({ rotulo, ini, fim, cor, marca, titulo }) {
  if (hm2m(ini) == null && hm2m(fim) == null) return null;
  return (
    <tr className="border-t border-slate-100" title={titulo}>
      <td className="py-1.5 pr-2 text-slate-600">
        <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: cor }} />
        {rotulo}
        {marca && (
          <span className="ml-1.5 rounded bg-rose-100 px-1 text-[10px] font-black text-rose-700">{marca}</span>
        )}
      </td>
      <td className="py-1.5 text-right tabular-nums text-slate-900">{fmtHora(ini) || "—"}</td>
      <td className="py-1.5 text-right tabular-nums text-slate-900">{fmtHora(fim) || "—"}</td>
      <td className="py-1.5 text-right tabular-nums font-bold text-slate-700">{durHM(ini, fim)}</td>
    </tr>
  );
}

function Cartao4({ valores, tom = "slate" }) {
  const rotulos = ["E", "S", "E", "S"];
  const cores = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-900",
  };
  const cheios = valores.map(fmtHora);
  if (!cheios.some(Boolean)) return <span className="text-slate-400">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {cheios.map((v, i) =>
        v ? (
          <span
            key={`${rotulos[i]}-${i}`}
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${cores[tom] || cores.slate}`}
          >
            <span className="text-[9px] opacity-60">{rotulos[i]}</span>
            {v}
          </span>
        ) : null,
      )}
    </span>
  );
}

function BlocoAlmoco({ titulo, ini, fim, travado, tom }) {
  const a = hm2m(ini);
  const b = hm2m(fim);
  const dur = a != null && b != null ? Math.max(0, b - a) : null;
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${tom === "sug" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}
    >
      <div className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-slate-500">
        {titulo}
        {travado && <Lock size={11} className="text-slate-500" />}
      </div>
      <div className="mt-1 text-sm font-bold tabular-nums text-slate-800">
        {fmtHora(ini) || "—"} → {fmtHora(fim) || "—"}
        {dur != null && dur > 0 && <span className="ml-2 text-xs font-semibold text-slate-500">{dur} min</span>}
      </div>
    </div>
  );
}

function CartaoModal({ linha, caso, gps, aoFechar }) {
  const [extra, setExtra] = useState({ gordura: null, intervalo: null, ajustes: [] });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const dia = String(linha.date_ref ?? "").slice(0, 10);
  const cracha = linha.cracha;

  useEffect(() => {
    let ativo = true;
    const cr = String(cracha ?? "").trim();
    const variantes = [...new Set([cr, cr.replace(/^0+/, ""), cra8(cr)].filter(Boolean))].join(",");
    setCarregando(true);
    setErro("");
    Promise.all([
      lerDP360("ponto_gordura", { filtros: { cracha: `in.(${variantes})`, data_ref: `eq.${dia}` }, limite: 5 }),
      lerDP360("ponto_intervalo", { filtros: { cracha: `in.(${variantes})`, data_ref: `eq.${dia}` }, limite: 5 }),
      lerDP360("ponto_ajustes", { filtros: { cracha: `in.(${variantes})`, date_ref: `eq.${dia}` }, limite: 50 }),
    ])
      .then(([gordura, intervalo, ajustes]) => {
        if (!ativo) return;
        setExtra({ gordura: gordura?.[0] || null, intervalo: intervalo?.[0] || null, ajustes: ajustes || [] });
      })
      .catch((falha) => {
        if (ativo) setErro(falha.message || "Não foi possível carregar as fontes deste dia.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [cracha, dia]);

  useEffect(() => {
    const escapa = (e) => {
      if (e.key === "Escape") aoFechar();
    };
    document.addEventListener("keydown", escapa);
    return () => document.removeEventListener("keydown", escapa);
  }, [aoFechar]);

  const g = extra.gordura || {};
  const iv = extra.intervalo || {};
  const bloqueio = sugBloqueio(linha);
  const travado = ehVerdadeiro(linha.almoco_travado);

  // Bilhetagem "fora da curva": longe da operação real na entrada. É o outlier
  // que não pode reger a correção sozinho.
  const opIni = hm2m(g.op_inicio) != null ? hm2m(g.op_inicio) : hm2m(g.sst_vinculo);
  const valIni = hm2m(g.val_inicio);
  const divergencia = opIni != null && valIni != null ? difCircularMin(opIni, valIni) : null;
  const bilhetagemFora = divergencia != null && divergencia > DIVERGENCIA_BILHETAGEM_MIN;

  const alvo4 = [linha.alvo_entrada, linha.alvo_saida_almoco, linha.alvo_volta_almoco, linha.alvo_saida];
  const sug4 = [linha.entrada_sug, linha.almoco_saida_sug, linha.almoco_volta_sug, linha.saida_sug];
  const real4 = [linha.entrada, linha.saida_almoco, linha.volta_almoco, linha.saida];

  // Almoço sugerido: Citatti manda; abaixo de 27 min ele pegou uma parada, não a
  // refeição — aí vale o SST (regra do Passo 1, `almocoRef`).
  const citattiMin = numero(iv.sugestao_duracao_min);
  const sstMin = numero(iv.sugestao_sst_duracao_min);
  const usaSst = (citattiMin == null || citattiMin < 27) && sstMin != null && sstMin >= 27;
  const almSugIni = usaSst ? iv.sugestao_sst_inicio : iv.sugestao_inicio || linha.almoco_saida_sug;
  const almSugFim = usaSst ? iv.sugestao_sst_fim : iv.sugestao_fim || linha.almoco_volta_sug;

  const passos = [
    {
      icone: "📤",
      titulo: "Aviso enviado",
      quando: fmtDataHora(caso?.aviso_enviado_em),
      feito: !!String(caso?.aviso_enviado_em ?? "").trim(),
      nota: caso?.aviso_conferido_em ? `visto no app · ${fmtDataHora(caso.aviso_conferido_em)}` : "",
    },
    {
      icone: "✏️",
      titulo: "Pedido do colaborador",
      quando: "",
      feito: !!(caso?.ajuste_ids || (caso?.ajuste && caso.ajuste !== "nao_ajustou")),
      nota: caso?.pedido_txt || (caso?.ajuste === "nao_ajustou" ? "não ajustou" : "sem pedido registrado neste dia"),
    },
    {
      icone: "⚖️",
      titulo: "Decisão do DP",
      quando: fmtDataHora(caso?.aceito_em),
      feito: !!(caso?.aceite && caso.aceite !== "pendente"),
      nota:
        caso?.aceite === "aceito"
          ? "aceitou — o ponto fica como ele pediu"
          : caso?.aceite === "rejeitado"
            ? "recusou — advertência e correção"
            : "",
    },
    {
      icone: caso?.advertencia_enviada_em ? "⚠" : "✓",
      titulo: caso?.advertencia_enviada_em ? "Advertência" : "Ponto OK",
      quando: fmtDataHora(caso?.advertencia_enviada_em || caso?.conferido_em),
      feito: !!(caso?.advertencia_enviada_em || caso?.conferido_em),
      alerta: !!caso?.advertencia_enviada_em,
      nota: "",
    },
    {
      icone: "🔧",
      titulo: "Correção do ponto",
      quando: fmtDataHora(caso?.correcao_final_em),
      feito: !!String(caso?.correcao_final_em ?? "").trim(),
      nota: [caso?.alvo_entrada, caso?.alvo_alm_saida, caso?.alvo_alm_volta, caso?.alvo_saida]
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
        .join(" · "),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 sm:p-6">
      <div className="w-full max-w-6xl rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start gap-3 border-b border-slate-200 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-sm font-black text-blue-700">
            {String(linha.nm_funcionario ?? "")
              .trim()
              .split(/\s+/)
              .map((p) => p[0] || "")
              .filter((_, i, a) => i === 0 || i === a.length - 1)
              .join("")
              .toUpperCase() || "—"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-black text-slate-900">{linha.nm_funcionario || "—"}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
              <span>Crachá {linha.cracha}</span>
              <span>· {fmtData(dia)}</span>
              {linha.nm_funcao && <span>· {linha.nm_funcao}</span>}
              {linha.categoria && <span>· {linha.categoria}</span>}
            </div>
          </div>
          <Pilula
            texto={linha.status_ponto || "—"}
            tom={String(linha.status_ponto ?? "").toUpperCase() === "OK" ? "emerald" : "amber"}
          />
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </header>

        <div className="space-y-3 px-5 pt-4">
          <AvisoTrava motivo={bloqueio} />
          {erro && (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{erro}</p>
          )}
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-2">
          {/* ---------- coluna 1: fontes, sugestão, real ---------- */}
          <div className="space-y-5">
            <section>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">
                1 · Fontes
                <span className="ml-2 font-semibold normal-case tracking-normal text-slate-400">
                  de onde vêm os números — nenhuma delas é decisão
                </span>
              </h3>
              <table className="mt-2 w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase text-slate-400">
                    <th className="pb-1">Fonte</th>
                    <th className="pb-1 text-right">Entrada</th>
                    <th className="pb-1 text-right">Saída</th>
                    <th className="pb-1 text-right">Jornada</th>
                  </tr>
                </thead>
                <tbody>
                  <LinhaFonte
                    rotulo="Escala"
                    ini={g.esc_inicio || linha.esc_entrada}
                    fim={g.esc_fim || linha.esc_saida}
                    cor="#94a3b8"
                    titulo="Escala publicada — apresentação e saída."
                  />
                  <LinhaFonte
                    rotulo="Citatti"
                    ini={g.op_inicio}
                    fim={g.op_fim}
                    cor="#059669"
                    titulo="Operação apurada pelo Citatti (viagens)."
                  />
                  <LinhaFonte
                    rotulo="SST"
                    ini={g.sst_vinculo}
                    fim={g.sst_desvinculo}
                    cor="#0284c7"
                    titulo="Vínculo e desvínculo do SST."
                  />
                  <LinhaFonte
                    rotulo="Bilhetagem"
                    ini={g.val_inicio}
                    fim={g.val_fim}
                    cor="#7c3aed"
                    marca={bilhetagemFora ? "fora" : ""}
                    titulo={
                      bilhetagemFora
                        ? `Longe da operação real na entrada (${divergencia} min de diferença) — não rege a correção sozinha.`
                        : "Validador de bilhetagem."
                    }
                  />
                </tbody>
              </table>
              {carregando && <p className="mt-2 text-xs font-semibold text-slate-400">Carregando fontes…</p>}
              {!carregando && !g.op_inicio && !g.sst_vinculo && !g.val_inicio && (
                <p className="mt-2 text-xs font-semibold text-slate-400">
                  Sem operação apurada neste dia (interno/aprendiz não tem Citatti, SST nem bilhetagem).
                </p>
              )}
              {/* TODO(port DP360): mapa das batidas (Leaflet) e detalhamento de
                  viagens_qh (linha/tabela/veículo) entram junto com a fase do mapa. */}
            </section>

            <section>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">
                2 · Sugestão
                <span className="ml-2 font-semibold normal-case tracking-normal text-slate-400">
                  o que a ferramenta propõe — ainda não é lançamento
                </span>
              </h3>
              <div className="mt-2 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-32 shrink-0 font-bold text-slate-500">Operação real</span>
                  <span className="tabular-nums font-bold text-slate-800">
                    {fmtHora(g.real_inicio) || "—"} → {fmtHora(g.real_fim) || "—"}
                  </span>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <span
                    className="w-32 shrink-0 font-bold text-slate-500"
                    title={`Alvo = operação real com tolerância: entrada −${TOL_ENTRADA_MIN} min, saída +${TOL_SAIDA_MIN} min.`}
                  >
                    Alvo (tol. {TOL_ENTRADA_MIN}/{TOL_SAIDA_MIN})
                  </span>
                  <Cartao4 valores={alvo4} tom="amber" />
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <span className="w-32 shrink-0 font-bold text-slate-500">Ponto sugerido</span>
                  {bloqueio ? (
                    <span className="font-bold text-amber-700">⚠ sugestão inválida</span>
                  ) : (
                    <Cartao4 valores={sug4} tom="emerald" />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 pt-2 text-[11px] font-semibold text-slate-500">
                  <span>Fonte do alvo: {linha.fonte_alvo || "—"}</span>
                  <span>Fonte SUG: {linha.sugestao_fonte || "—"}</span>
                  <span>Ação: {linha.acao_sugerida || "—"}</span>
                  <span>Alvo confiável: {ehVerdadeiro(linha.alvo_confiavel) ? "sim" : "não"}</span>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">
                3 · Real
                <span className="ml-2 font-semibold normal-case tracking-normal text-slate-400">
                  o que ele bateu
                </span>
              </h3>
              <div className="mt-2 space-y-2 rounded-2xl border border-slate-200 bg-white p-3 text-xs">
                <div className="flex flex-wrap items-start gap-2">
                  <span className="w-32 shrink-0 font-bold text-slate-500">Ponto (bateu)</span>
                  <Cartao4 valores={real4} />
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <span className="w-32 shrink-0 font-bold text-slate-500">Todas as batidas</span>
                  <span className="tabular-nums text-slate-700">{linha.todas_batidas || "—"}</span>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <span className="w-32 shrink-0 font-bold text-slate-500">Batidas limpas</span>
                  <span className="tabular-nums text-slate-700">{linha.batidas_limpas || "—"}</span>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">
                4 · Real manual do DP
                <span className="ml-2 font-semibold normal-case tracking-normal text-slate-400">
                  crava e vira a régua do veredito e o alvo da correção
                </span>
              </h3>
              <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold text-slate-500">
                  {linha.rm_entrada || linha.rm_saida ? (
                    <>
                      ✓ <b>Cravado</b>
                      {linha.rm_por ? ` por ${linha.rm_por}` : ""}
                      {linha.rm_em ? ` · ${fmtDataHora(linha.rm_em)}` : ""}
                    </>
                  ) : (
                    <>
                      Ninguém cravou este dia. Os horários abaixo são a <b>sugestão da ferramenta</b>.
                    </>
                  )}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["Entrada", linha.rm_entrada || linha.entrada_sug, false],
                    ["Saída almoço", linha.rm_alm_saida || linha.almoco_saida_sug, travado],
                    ["Volta almoço", linha.rm_alm_volta || linha.almoco_volta_sug, travado],
                    ["Saída", linha.rm_saida || linha.saida_sug, false],
                  ].map(([rot, valor, cadeado]) => (
                    <label key={rot} className="block">
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                        {rot}
                        {cadeado && <Lock size={10} />}
                      </span>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={fmtHora(valor)}
                        placeholder="HH:MM"
                        title={cadeado ? "Almoço travado pela regra da Revisão." : TRAVA_GRAVACAO}
                        className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm font-bold tabular-nums text-slate-500"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {/* TODO(fase de gravação): upsertDP360("ponto_real_manual", {
                        cracha: cra8(linha.cracha), date_ref: dia, entrada, alm_saida,
                        alm_volta, saida, definido_por: user.nome, definido_em: agora })
                      — respeitando almoco_travado (miolo não editável). */}
                  <BotaoTravado titulo={TRAVA_GRAVACAO}>✓ Salvar Real</BotaoTravado>
                  {/* TODO(fase de gravação): apagarDP360("ponto_real_manual",
                        { cracha: `eq.${cra8(linha.cracha)}`, date_ref: `eq.${dia}` }) */}
                  <BotaoTravado titulo={TRAVA_GRAVACAO}>Limpar</BotaoTravado>
                </div>
              </div>
            </section>
          </div>

          {/* ---------- coluna 2: almoço, GPS, linha do tempo ---------- */}
          <div className="space-y-5">
            <section>
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Almoço
                {travado && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-slate-600"
                    title="Miolo travado pela regra da Revisão — não é editável."
                  >
                    <Lock size={10} /> travado
                  </span>
                )}
              </h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <BlocoAlmoco titulo="Batido (ponto)" ini={linha.saida_almoco} fim={linha.volta_almoco} />
                <BlocoAlmoco
                  titulo="Programado (escala)"
                  ini={iv.programado_inicio}
                  fim={iv.programado_fim}
                />
                <BlocoAlmoco
                  titulo={`Sugestão${usaSst ? " · SST" : " · Citatti"}`}
                  ini={almSugIni}
                  fim={almSugFim}
                  travado={travado}
                  tom="sug"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500">
                <span>Fonte do almoço: {linha.fonte_almoco || "—"}</span>
                <span>Faixa: {linha.almoco_faixa || "—"}</span>
                <span>Confiável: {ehVerdadeiro(linha.almoco_confiavel) ? "sim" : "não"}</span>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">
                📍 Local da batida (GPS do app)
              </h3>
              {!gps || !gps.total ? (
                <p className="mt-2 text-xs font-semibold text-slate-400">Sem GPS registrado neste dia.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-xs">
                  {gps.detalhes.map((d, i) => (
                    <li
                      key={`${d.hora}-${i}`}
                      className={`flex items-center justify-between rounded-lg px-2 py-1.5 ${d.fora ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}
                    >
                      <span className="font-bold tabular-nums">{d.hora || "—"}</span>
                      <span className="truncate px-2 text-[11px] font-semibold opacity-80">{d.referencia}</span>
                      <span className="font-bold">
                        {d.fora ? "fora" : "junto"} · {fmtDist(d.dist)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {/* TODO(port DP360): mapa Leaflet com as cercas (garagem 100 m,
                  terminal 100 m, veículo 500 m) — fica para a fase do mapa. */}
            </section>

            <section>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Linha do tempo do caso</h3>
              <ol className="mt-2 space-y-2">
                {passos.map((p) => (
                  <li
                    key={p.titulo}
                    className={`flex gap-3 rounded-xl border px-3 py-2 ${
                      p.alerta && p.feito
                        ? "border-rose-200 bg-rose-50"
                        : p.feito
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-white"
                    }`}
                  >
                    <span className="text-sm">{p.feito ? p.icone : "○"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2 text-xs font-bold text-slate-800">
                        {p.titulo}
                        {p.quando && <span className="font-semibold text-slate-500">{p.quando}</span>}
                      </div>
                      {p.nota && <div className="mt-0.5 text-[11px] font-semibold text-slate-500">{p.nota}</div>}
                    </div>
                  </li>
                ))}
              </ol>
              {!!extra.ajustes.length && (
                <p className="mt-2 text-[11px] font-semibold text-slate-500">
                  {extra.ajustes.length} edição(ões) registrada(s) em ponto_ajustes para este dia.
                </p>
              )}
            </section>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-[11px] font-semibold text-slate-500">
            Fase de leitura: nenhuma ação desta tela grava na base DP360.
          </p>
          <div className="flex flex-wrap gap-2">
            {/* TODO(fase de gravação): upsertDP360("ponto_conferido", {
                  cracha: cra8(linha.cracha), date_ref: dia, nome, marcado_por, marcado_em })
                — o dia conferido sai da Revisão e conta como certo nas Folgas. */}
            <BotaoTravado titulo={TRAVA_GRAVACAO}>✓ Ponto conferido</BotaoTravado>
            {/* TODO(fase de gravação): upsertDP360("ponto_caso", { cracha, date_ref,
                  origem: "revisao", tipo, aviso_enviado_em, alvo_* congelado }) e disparo
                  do workflow do robô. Recusar ≠ advertir: advertência só depois de aviso. */}
            <BotaoTravado titulo={TRAVA_GRAVACAO}>📣 Enviar ocorrência</BotaoTravado>
            <button
              type="button"
              onClick={aoFechar}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              Fechar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ---------- colunas da grade (ordem do COLS_REV do app antigo) ---------- */
const COLUNAS = [
  { id: "cracha", rotulo: "Crachá", classe: "tabular-nums font-semibold" },
  { id: "nm_funcionario", rotulo: "Nome", classe: "font-bold text-slate-900 whitespace-nowrap" },
  { id: "nm_funcao", rotulo: "Função", classe: "whitespace-nowrap text-slate-600" },
  { id: "date_ref", rotulo: "Data", classe: "tabular-nums whitespace-nowrap" },
  { id: "status_ponto", rotulo: "Status" },
  { id: "_avisado", rotulo: "Avisado?" },
  { id: "_gps", rotulo: "📍 Local" },
  { id: "motivo", rotulo: "Motivo" },
  { id: "sugestao_fonte", rotulo: "Fonte SUG", classe: "whitespace-nowrap text-slate-600" },
  { id: "qtd_batidas", rotulo: "Qtd batidas", classe: "tabular-nums text-center" },
  { id: "todas_batidas", rotulo: "Todas as batidas", classe: "tabular-nums whitespace-nowrap" },
  { id: "batidas_limpas", rotulo: "Batidas limpas", classe: "tabular-nums whitespace-nowrap" },
  { id: "entrada", rotulo: "Entrada", classe: "tabular-nums", hora: true },
  { id: "saida_almoco", rotulo: "Saída almoço", classe: "tabular-nums", hora: true },
  { id: "volta_almoco", rotulo: "Volta almoço", classe: "tabular-nums", hora: true },
  { id: "saida", rotulo: "Saída", classe: "tabular-nums", hora: true },
  { id: "_jornada", rotulo: "Jornada", classe: "tabular-nums" },
  { id: "esc_entrada", rotulo: "Esc. apresentação", classe: "tabular-nums", hora: true },
  { id: "programado_entrada", rotulo: "Esc. início", classe: "tabular-nums", hora: true },
  { id: "programado_saida", rotulo: "Esc. fim", classe: "tabular-nums", hora: true },
  { id: "esc_saida", rotulo: "Esc. saída", classe: "tabular-nums", hora: true },
  { id: "_sep", rotulo: "│" },
  { id: "entrada_sug", rotulo: "Entrada SUG", classe: "tabular-nums", hora: true, sug: true },
  { id: "almoco_saida_sug", rotulo: "S. almoço SUG", classe: "tabular-nums", hora: true, sug: true },
  { id: "almoco_volta_sug", rotulo: "V. almoço SUG", classe: "tabular-nums", hora: true, sug: true },
  { id: "saida_sug", rotulo: "Saída SUG", classe: "tabular-nums", hora: true, sug: true },
  { id: "duracao_total_sug", rotulo: "Dur. total SUG", classe: "tabular-nums", sug: true },
  { id: "atraso_min", rotulo: "Atraso (min)", classe: "tabular-nums text-right" },
  { id: "he_min", rotulo: "HE (min)", classe: "tabular-nums text-right" },
];

// Colunas pedidas da ponto_diario. Lista explícita (em vez de `*`) porque a
// tabela é larga e a grade é carregada por dia inteiro.
const COLUNAS_PONTO_DIARIO = [
  "cracha",
  "date_ref",
  "categoria",
  "nm_funcionario",
  "nm_funcao",
  "tem_ponto",
  "status_ponto",
  "motivo",
  "motivo_tecnico",
  "acao_sugerida",
  "sugestao_fonte",
  "qtd_batidas",
  "todas_batidas",
  "batidas_limpas",
  "entrada",
  "saida_almoco",
  "volta_almoco",
  "saida",
  "jornada_liquida_min",
  "jornada_total_min",
  "esc_entrada",
  "esc_saida",
  "programado_entrada",
  "programado_saida",
  "entrada_sug",
  "almoco_saida_sug",
  "almoco_volta_sug",
  "saida_sug",
  "duracao_total_sug",
  "atraso_min",
  "he_min",
  "pede_entrada",
  "pede_saida",
  "requer_alvo_manual",
  "fonte_alvo",
  "alvo_confiavel",
  "alvo_entrada",
  "alvo_saida_almoco",
  "alvo_volta_almoco",
  "alvo_saida",
  "fonte_almoco",
  "almoco_travado",
  "almoco_faixa",
  "almoco_confiavel",
  "almoco_diverge_cartao",
].join(",");

/* =============================================================================
   Componente
   ========================================================================== */
export default function Revisao() {
  const [categoria, setCategoria] = useState("MOTORISTA");
  const [categorias, setCategorias] = useState(CATEGORIAS_PADRAO);
  const [datas, setDatas] = useState([]);
  const [data, setData] = useState("");
  const [lotesDatas, setLotesDatas] = useState(PAGINAS_POR_LOTE);
  const [carregandoDatas, setCarregandoDatas] = useState(true);

  const [linhas, setLinhas] = useState([]);
  const [casos, setCasos] = useState({});
  const [gpsPorCracha, setGpsPorCracha] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const [filtro, setFiltro] = useState("REVISAR");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState(null);

  /* ---- datas e categorias disponíveis ---- */
  useEffect(() => {
    let ativo = true;
    setCarregandoDatas(true);
    // TODO(port DP360): trocar por um endpoint `distinct` no gateway. Hoje o
    // PostgREST não expõe DISTINCT por aqui, então paginamos date_ref desc.
    lerTudoDP360("ponto_diario", { colunas: "date_ref,categoria", ordem: "date_ref.desc" }, lotesDatas)
      .then((rows) => {
        if (!ativo) return;
        const dts = [...new Set(rows.map((r) => String(r.date_ref ?? "").slice(0, 10)).filter(Boolean))].sort(
          (a, b) => b.localeCompare(a),
        );
        const cats = [...new Set(rows.map((r) => String(r.categoria ?? "").trim().toUpperCase()).filter(Boolean))].sort();
        setDatas(dts);
        if (cats.length) setCategorias(cats);
        setData((atual) => (atual && dts.includes(atual) ? atual : dts[0] || ""));
        setErro("");
      })
      .catch((falha) => {
        if (ativo) setErro(falha.message || "Falha ao listar as datas da base DP360.");
      })
      .finally(() => {
        if (ativo) setCarregandoDatas(false);
      });
    return () => {
      ativo = false;
    };
  }, [lotesDatas]);

  /* ---- grade do dia ---- */
  const carregarDia = useCallback(() => {
    if (!data || !categoria) return undefined;
    let ativo = true;
    setCarregando(true);
    setErro("");
    setGpsPorCracha({});
    const filtrosDia = { date_ref: `eq.${data}`, categoria: `eq.${categoria}` };

    Promise.all([
      lerTudoDP360("ponto_diario", {
        colunas: COLUNAS_PONTO_DIARIO,
        filtros: filtrosDia,
        ordem: "cracha.asc",
      }),
      lerTudoDP360("ponto_real_manual", { filtros: { date_ref: `eq.${data}` }, ordem: "cracha.asc" }),
      lerTudoDP360("ponto_caso", { filtros: { date_ref: `eq.${data}` }, ordem: "cracha.asc" }),
    ])
      .then(([diario, reaisManuais, listaCasos]) => {
        if (!ativo) return;
        const mapaRm = {};
        for (const rm of reaisManuais) mapaRm[chaveDia(rm.cracha, rm.date_ref)] = rm;
        const mapaCasos = {};
        for (const c of listaCasos) mapaCasos[chaveDia(c.cracha, c.date_ref)] = c;
        setCasos(mapaCasos);
        setLinhas(diario.map((l) => aplicarRealManual(l, mapaRm[chaveDia(l.cracha, l.date_ref)])));
      })
      .catch((falha) => {
        if (ativo) setErro(falha.message || "Falha ao carregar a revisão deste dia.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    // GPS carrega em separado: a grade não espera por ele.
    Promise.all([
      lerTudoDP360("ponto_gps", {
        colunas: "cracha,hora,latitude,longitude,origem",
        filtros: { date_ref: `eq.${data}` },
        ordem: "cracha.asc",
      }),
      lerTudoDP360("gps_carro", {
        colunas: "cracha,hora,latitude,longitude,veiculo,poi,cerca,tipo,fonte",
        filtros: { date_ref: `eq.${data}` },
        ordem: "cracha.asc",
      }),
    ])
      .then(([batidas, carros]) => {
        if (!ativo) return;
        const porCracha = {};
        const balde = (cracha) => {
          const cr = cra8(cracha);
          if (!porCracha[cr]) porCracha[cr] = { batidas: [], ancoras: [] };
          return porCracha[cr];
        };
        for (const b of batidas) balde(b.cracha).batidas.push(b);
        for (const c of carros) balde(c.cracha).ancoras.push(c);
        const resumo = {};
        for (const [cr, dados] of Object.entries(porCracha)) {
          if (!dados.batidas.length) continue;
          resumo[cr] = calcularGps(dados.batidas, dados.ancoras);
        }
        setGpsPorCracha(resumo);
      })
      .catch(() => {
        // GPS é acessório: sem ele a coluna 📍 fica "—" e a grade segue útil.
        if (ativo) setGpsPorCracha({});
      });

    return () => {
      ativo = false;
    };
  }, [data, categoria]);

  useEffect(() => carregarDia(), [carregarDia]);

  /* ---- contagens e filtro ---- */
  const contagens = useMemo(() => {
    const c = { TODOS: linhas.length, REVISAR: 0, OK: 0, FORA: 0 };
    for (const l of linhas) {
      if (String(l.status_ponto ?? "").toUpperCase() === "OK") c.OK += 1;
      else c.REVISAR += 1;
      const g = gpsPorCracha[cra8(l.cracha)];
      if (g && g.fora > 0) c.FORA += 1;
    }
    return c;
  }, [linhas, gpsPorCracha]);

  // `sugBloqueio` roda uma vez por linha (e não uma vez por célula): a grade tem
  // ~30 colunas e o dia inteiro de motoristas, então repetir custava 12k chamadas.
  const bloqueios = useMemo(() => {
    const m = {};
    for (const l of linhas) m[chaveDia(l.cracha, l.date_ref)] = sugBloqueio(l);
    return m;
  }, [linhas]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (q) {
        const nome = String(l.nm_funcionario ?? "").toLowerCase();
        const cra = String(l.cracha ?? "");
        if (!nome.includes(q) && !cra.includes(q)) return false;
      }
      const ok = String(l.status_ponto ?? "").toUpperCase() === "OK";
      if (filtro === "REVISAR") return !ok;
      if (filtro === "OK") return ok;
      if (filtro === "FORA") {
        const g = gpsPorCracha[cra8(l.cracha)];
        return !!(g && g.fora > 0);
      }
      return true;
    });
  }, [linhas, busca, filtro, gpsPorCracha]);

  const comSugestao = useMemo(
    () => linhas.filter((l) => temSugestaoUtil(l, bloqueios[chaveDia(l.cracha, l.date_ref)])).length,
    [linhas, bloqueios],
  );

  const celula = (col, linha, bloqueio) => {
    if (col.id === "_sep") return <span className="text-slate-300">│</span>;
    if (col.id === "status_ponto")
      return (
        <Pilula
          texto={linha.status_ponto || "—"}
          tom={String(linha.status_ponto ?? "").toUpperCase() === "OK" ? "emerald" : "amber"}
        />
      );
    if (col.id === "_avisado") return <Avisado caso={casos[chaveDia(linha.cracha, linha.date_ref)]} />;
    if (col.id === "_gps") return <LocalGps gps={gpsPorCracha[cra8(linha.cracha)]} />;
    if (col.id === "motivo") return <Motivo linha={linha} />;
    if (col.id === "date_ref") return fmtData(linha.date_ref);
    if (col.id === "_jornada") return fmtMin(linha.jornada_liquida_min ?? linha.jornada_total_min);
    const bruto = linha[col.id];
    const texto = col.hora ? fmtHora(bruto) : String(bruto ?? "").trim();
    if (!texto) return <span className="text-slate-300">—</span>;
    // Sugestão bloqueada não é sugestão: o valor continua visível (o DP precisa
    // ver o que a view propôs), mas marcado — não dá pra avisar nem lançar.
    if (col.sug && bloqueio)
      return (
        <span className="font-bold text-amber-700" title={`⚠ ${bloqueio}`}>
          {texto} ⚠
        </span>
      );
    return texto;
  };

  const chips = [
    ["TODOS", "Todos"],
    ["REVISAR", "Revisar"],
    ["OK", "OK"],
    ["FORA", "📍 Fora"],
  ];

  return (
    <AbaShell
      icone={ClipboardCheck}
      titulo="Revisão"
      resumo="Cartão, fontes e decisão de ajuste. A régua é da view do Athena — esta tela só exibe o que já foi calculado."
      carregando={carregandoDatas && !datas.length}
      erro={erro}
      acoes={
        <>
          {/* TODO(fase de gravação): avisarMotoristas / avisarInternos / avisarFora —
              gravam ponto_caso e sobem o comunicado. Recusar ≠ advertir, e o alvo do
              aviso é congelado (nunca reescrito por um segundo aviso). */}
          <BotaoTravado titulo={TRAVA_GRAVACAO}>📣 Enviar ocorrência</BotaoTravado>
          <BotaoTravado titulo={TRAVA_GRAVACAO}>📍 Avisar quem bateu fora</BotaoTravado>
          <button
            type="button"
            onClick={() => carregarDia()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            <RefreshCw size={15} /> Atualizar
          </button>
        </>
      }
    >
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">
        Fase de leitura. Salvar Real manual, marcar ponto conferido e enviar aviso estão desabilitados até a
        validação — gravação errada aqui vira advertência indevida em cima de trabalhador.
      </div>

      {/* ---- filtros ---- */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800"
        >
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800"
        >
          {datas.length ? (
            datas.map((d) => (
              <option key={d} value={d}>
                {fmtData(d)}
              </option>
            ))
          ) : (
            <option value="">sem datas</option>
          )}
        </select>

        <button
          type="button"
          onClick={() => setLotesDatas((n) => n + PAGINAS_POR_LOTE)}
          disabled={carregandoDatas}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          title="Busca mais páginas de ponto_diario para trazer datas anteriores."
        >
          {carregandoDatas ? "carregando…" : "+ datas anteriores"}
        </button>

        <div className="relative ml-auto">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou crachá…"
            className="w-64 rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {chips.map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFiltro(id)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition ${
              filtro === id ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {rotulo}
            <span
              className={`rounded-full px-1.5 text-[11px] ${filtro === id ? "bg-white/20" : "bg-white text-slate-500"}`}
            >
              {contagens[id] || 0}
            </span>
          </button>
        ))}
        <span className="ml-auto text-xs font-bold text-slate-500">
          {comSugestao ? `${comSugestao} com sugestão utilizável` : ""}
        </span>
      </div>

      {/* ---- legenda das cores ---- */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500">
        <span className="flex items-center gap-1.5">
          <i className="h-3 w-3 rounded bg-emerald-100 ring-1 ring-emerald-300" /> ponto OK
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-3 w-3 rounded bg-amber-100 ring-1 ring-amber-300" /> invertido ou com sugestão utilizável
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-3 w-3 rounded bg-sky-100 ring-1 ring-sky-300" /> falta marcação identificada
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-3 w-3 rounded bg-rose-100 ring-1 ring-rose-300" /> sem sugestão e sem ponta identificada
        </span>
      </div>

      {/* ---- grade ---- */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        <div className="max-h-[68vh] overflow-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100">
                {COLUNAS.map((col) => (
                  <th
                    key={col.id}
                    className="whitespace-nowrap border-b border-slate-200 px-2.5 py-2 text-left text-[11px] font-black uppercase tracking-wide text-slate-500"
                  >
                    {col.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {carregando && (
                <tr>
                  <td colSpan={COLUNAS.length} className="px-3 py-10 text-center text-sm font-semibold text-slate-500">
                    Carregando a revisão de {fmtData(data)}…
                  </td>
                </tr>
              )}
              {!carregando && !visiveis.length && (
                <tr>
                  <td colSpan={COLUNAS.length} className="px-3 py-10 text-center text-sm font-semibold text-slate-500">
                    {linhas.length ? "Nada neste filtro." : "Nenhum cartão para esta categoria e data."}
                  </td>
                </tr>
              )}
              {!carregando &&
                visiveis.map((linha) => {
                  const chave = chaveDia(linha.cracha, linha.date_ref);
                  const bloqueio = bloqueios[chave];
                  return (
                    <tr
                      key={chave}
                      onClick={() => setAberta(linha)}
                      className={`cursor-pointer border-b border-slate-100 transition ${classeLinha(linha, bloqueio)}`}
                      title="Abrir o cartão deste dia"
                    >
                      {COLUNAS.map((col) => (
                        <td key={col.id} className={`px-2.5 py-1.5 align-middle ${col.classe || "text-slate-700"}`}>
                          {celula(col, linha, bloqueio)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        <MapPin size={12} />
        Régua do GPS: mais de {RAIO_VEIC} m da posição do veículo (gps_carro) é "fora"; sem veículo, vale o local
        conhecido até {RAIO_LOCAL} m. Tolerância do alvo: entrada −{TOL_ENTRADA_MIN} min, saída +{TOL_SAIDA_MIN} min.
      </p>

      {aberta && (
        <CartaoModal
          linha={aberta}
          caso={casos[chaveDia(aberta.cracha, aberta.date_ref)]}
          gps={gpsPorCracha[cra8(aberta.cracha)]}
          aoFechar={() => setAberta(null)}
        />
      )}
    </AbaShell>
  );
}
