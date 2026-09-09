import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, X } from "lucide-react";
import MapaBatidas from "./MapaBatidas";
import { apagarDP360, dispararRoboDP360, lerDP360, upsertDP360 } from "../../services/dp360Api";
import { supabase } from "../../supabase";
import { getStoredUser } from "../../utils/auth";
import { RAIO_LOCAL, RAIO_VEIC, reguaLocal, resumoGps } from "./regrasGps";
import {
  MOTIVO_AVISO,
  TIPO,
  assinaturaExclusao,
  chaveTemplate,
  escolherTemplate,
  marcarReavisos,
  mensagemPedirExclusao,
  prepararComunicado,
  variaveisPendentes,
} from "./comunicadoTransnet";
import {
  CONSTANTES,
  almocoDaRefeicao,
  almocoMatrizPorCategoria,
  batidasDoCartao,
  bloqueioSimulacao,
  difRelogio,
  hm2min,
  jornadaEntreMin,
  julgaAcoes,
  min2hm,
  removeFantasmas,
  simulaCartao,
} from "./regrasPonto";

/* =============================================================================
   CartaoDoDia — O POP-UP DE ANÁLISE DE UM CRACHÁ × DIA. UM SÓ, PARA AS DUAS TELAS.

   POR QUE ESTE ARQUIVO EXISTE (pedido do dono, 06/09): "na verdade é o mesmo
   pop-up de análise do da Revisão… quero deixar organizado os pontos, ficar no
   mesmo padrão todos". A Revisão tinha o cartão completo (fontes · sugestão ·
   real · Real manual · almoço · GPS · mapa · linha do tempo · viagens do Citatti)
   e a Gordura tinha um painel próprio, com outra cara e SEM o Real — o que obrigava
   a sair da Gordura e reachar pessoa+dia na Revisão só para cravar o horário que
   destrava a linha barrada por "revisar alvo e refeição".

   O MIOLO É UM SÓ; o que é de cada tela entra por PROP:
     · `selos`        — pílulas extras no cabeçalho (Gordura: linha 99, reserva…);
     · `blocoLateral` — bloco extra no topo da coluna 2 (Gordura: níveis P, a
                        gordura por ponta, o alvo dela e o efeito da reserva);
     · `acoesRodape`  — botões de decisão da tela (Revisão: ✓ Ponto conferido);
     · `rodapeInfo`   — a frase do rodapé.
   Bloco que não faz sentido numa das telas é OPCIONAL, não duplicado: o GPS só é
   lido quando a tela pede (`gpsAuto`), e o `gordura` recebido substitui a leitura
   crua (a Gordura precisa da linha COM as quatro camadas aplicadas, senão a
   "Operação real" do pop-up não bateria com a da grade).

   O QUE ELE GRAVA (o mesmo de sempre, sem mudança de regra):
     · Real manual do DP -> `ponto_real_manual` (upsert; tudo vazio APAGA a linha,
       igual a main.py `salvar_real_manual` ~392), com a trava do almoço travado;
     · Ponto conferido   -> `ponto_caso` tipo='ponto_ok' (`BotaoPontoConferido`,
       exportado daqui e usado pela Revisão no rodapé — main.py `marcar_ponto_ok`).
   Nada aqui fala com o trabalhador: o comunicado é da aba, pelo botão 📣, e as
   regras dele moram em `./comunicadoTransnet`.

   DEPOIS DE GRAVAR A LINHA É RELIDA DO BANCO (`aoRecarregar`), nunca pintada com
   estado otimista: se o gateway recusou uma coluna ou um trigger mexeu no valor, a
   pessoa tem de ver o que ficou LÁ.

   A REGRA DE NEGÓCIO NÃO MORA AQUI: `status_ponto`, `motivo`, `acao_sugerida`,
   `alvo_*`, `*_sug`, `almoco_*` vêm calculados da view do Athena; as contas de
   relógio são do MOTOR (`./regrasPonto`), a régua de GPS é de `./regrasGps` e as
   camadas da gordura são de `./regrasGordura`. Esta tela só EXIBE e grava.
   ========================================================================== */

/* ---------- constantes: vêm do MOTOR, não são redigitadas aqui ---------- */
const {
  TOL_ENTRADA_MIN, // 10 — minutos ANTES do início da operação (main.py:117)
  TOL_SAIDA_MIN, // 8  — minutos DEPOIS do fim da operação (main.py:118)
  SUG_JORNADA_MAX_MIN, // 780 — acima disso não é jornada, é defeito (main.py:2745)
  DELTA_FONTE, // 20 — margem de concordância entre fontes (CANON 6.5)
} = CONSTANTES;

// Bilhetagem "fora da curva" na entrada é o mesmo conceito do CANON: as duas fontes
// deixaram de concordar. Mesma margem, uma constante só.
const DIVERGENCIA_BILHETAGEM_MIN = DELTA_FONTE;

/** Quem está cravando. Porte de main.py `_quem_esta_usando` (lá é a conta do Windows;
 *  aqui o INOVE tem login de verdade, então vale o usuário da sessão). */
export function quemEstaUsando() {
  const u = getStoredUser();
  return String(u?.nome_completo || u?.nome || u?.login || u?.email || "").trim();
}

/** Carimbo UTC dos campos `*_em`. São TIMESTAMP, não data local — é exatamente o
 *  `datetime.now(timezone.utc).isoformat()` do Python. (O `date_ref`, esse sim data
 *  local, NUNCA sai de `new Date()`: vem pronto da linha do banco.) */
export const agoraUtc = () => new Date().toISOString();

/* ---------- helpers de formato ---------- */
// Booleano do PostgREST/Athena chega como STRING. Mesma lista do app antigo.
export const ehVerdadeiro = (v) => ["true", "t", "1", "sim"].includes(String(v ?? "").trim().toLowerCase());

export const cra8 = (c) => {
  const s = String(c ?? "").trim();
  return /^\d{1,7}$/.test(s) ? s.padStart(8, "0") : s;
};

export const chaveDia = (cracha, dia) => `${cra8(cracha)}|${String(dia ?? "").slice(0, 10)}`;

/** As três formas do crachá que as tabelas do lake usam (com e sem zero à esquerda). */
const variantesCracha = (cracha) => {
  const cr = String(cracha ?? "").trim();
  return [...new Set([cr, cr.replace(/^0+/, ""), cra8(cr)].filter(Boolean))];
};

export const fmtHora = (v) => {
  const s = String(v ?? "").trim();
  if (!s || s === "--" || s === "-") return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
};

export const fmtMin = (v) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n <= 0) return "—";
  return `${Math.floor(n / 60)}h${String(n % 60).padStart(2, "0")}`;
};

export const fmtData = (iso) => {
  const s = String(iso ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

/** Os nomes curtos da faixa da semana, na ordem do original (segunda → domingo). */
const NOMES_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/**
 * Os 7 dias (segunda→domingo) da semana que contém `iso` — o `seg = d - weekday` de
 * main.py:805 (`get_semana`).
 *
 * ARITMÉTICA DE CALENDÁRIO EM UTC, de propósito, e formatação à mão: `new Date(iso)` lê
 * a string como meia-noite UTC e no BRT (UTC−3) o `getDay()` cairia no dia ANTERIOR — a
 * semana inteira sairia deslocada, e "quinta" apareceria no lugar de "sexta". `toISOString()`
 * também está fora: aqui a data é LOCAL do calendário, não instante.
 */
export function semanaDe(iso) {
  const s = String(iso ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return [];
  const [ano, mes, dia] = s.split("-").map(Number);
  const base = Date.UTC(ano, mes - 1, dia);
  const dow = new Date(base).getUTCDay(); // 0 = domingo
  const segunda = base - (dow === 0 ? 6 : dow - 1) * 86400000;
  const p2 = (n) => String(n).padStart(2, "0");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(segunda + i * 86400000);
    return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
  });
}

export const fmtDataHora = (v) => {
  const s = String(v ?? "").trim();
  if (!s || s === "registrada") return "";
  return `${fmtData(s.slice(0, 10))}${s.length > 10 ? ` ${s.slice(11, 16)}` : ""}`;
};

/** INSTANTE gravado como timestamp (o `criado_em`/`atualizado_em` da reserva, que o
 *  INOVE grava em UTC). Fatiar o texto mostraria a hora de Londres — três horas à
 *  frente —, então aqui o certo é converter para o fuso de São Paulo. */
export const fmtInstanteBR = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return fmtDataHora(s);
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const fmtDist = (d) => (d == null ? "—" : d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`);

// Jornada entre duas pontas, com desconto opcional do almoço. A virada de meia-noite
// é do motor (`jornadaEntreMin`); aqui só sobrou a FORMATAÇÃO "10h09".
export function durHM(ini, fim, descontar = 0) {
  const bruta = jornadaEntreMin(ini, fim);
  if (bruta == null) return "—";
  const liq = bruta - (descontar || 0);
  if (liq <= 0) return "—";
  return `${Math.floor(liq / 60)}h${String(liq % 60).padStart(2, "0")}`;
}

/* ---------- GPS: batida fora de lugar ---------- */
// A conta em si é do módulo `./regrasGps` (porte de main.py `_regua_local`).
// Aqui ficou só o que é de TELA.

/**
 * Roda a régua completa de um crachá/dia e devolve o pacote que a grade e o
 * pop-up consomem: o resumo (total/fora/naoMedido/maiorDistancia) + a lista
 * batida a batida.
 *
 * `batidas` e `ancoras` viajam junto SEM SEREM ALTERADAS: o mapa do pop-up
 * (`MapaBatidas`) precisa da COORDENADA do veículo, que a régua usa por dentro
 * mas não devolve em `detalhes`. Nenhum cálculo muda por causa disso.
 */
export function calcularGps({ batidas, ancoras, ehReserva, opIni, opFim }) {
  const detalhes = reguaLocal({
    batidas,
    ancorasVeiculo: ancoras,
    ehReserva,
    opIni,
    opFim,
  });
  return { ...resumoGps(detalhes), detalhes, batidas, ancoras };
}

/** Texto da referência que decidiu a batida (usado no pop-up). */
function referenciaGps(d) {
  if (d.fonte === "RESERVA") return `reserva · ${d.nomeLocal || "local conhecido"}`;
  if (d.via === "veiculo") {
    const carro = String(d.veiculo || "").trim();
    return [carro ? `veículo ${carro}` : "veículo", d.poi].filter(Boolean).join(" · ");
  }
  if (d.via === "local") return d.nomeLocal || d.localMaisProximo || "local conhecido";
  // via === null → âncora do veículo sem coordenada.
  return d.poi ? `${d.poi} — sem coordenada` : "âncora do veículo sem coordenada";
}

/* ---------- regra da sugestão (exibição do que a view já decidiu) ---------- */
// A linha veio da view nova? Aí a decisão de alvo/almoço é dela, não nossa.
const temContratoView = (r) =>
  r.acao_sugerida != null || r.fonte_alvo != null || r.alvo_confiavel != null || r.requer_alvo_manual != null;

/**
 * Porte de main.py `_sug_bloqueio`: devolve o MOTIVO pelo qual a sugestão do dia
 * NÃO pode ser usada, ou "" se pode. Nada é recalculado — só lido dos campos.
 */
export function sugBloqueio(r) {
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
  const e = hm2min(r.entrada_sug);
  const s = hm2min(r.saida_sug);
  if (e == null || s == null) return "";
  const bruta = jornadaEntreMin(e, s); // virada de meia-noite é do motor
  const a1 = hm2min(r.almoco_saida_sug);
  const a2 = hm2min(r.almoco_volta_sug);
  const alm = a1 != null && a2 != null ? Math.max(0, a2 - a1) : 0;
  const liq = bruta - alm;
  if (liq <= 0) return "sugestão com jornada zero ou negativa";
  if (liq > SUG_JORNADA_MAX_MIN)
    return `sugestão daria ${Math.floor(liq / 60)}h${String(liq % 60).padStart(2, "0")} de jornada — acima do limite de 13h`;
  return "";
}

export const temSugestaoUtil = (r, bloqueio = sugBloqueio(r)) =>
  !bloqueio && !!fmtHora(r.entrada_sug) && !!fmtHora(r.saida_sug);

export const ehPontoInvertido = (r) =>
  String(r.motivo ?? "").trim().toUpperCase().startsWith("PONTO_INVERTIDO") ||
  String(r.acao_sugerida ?? "").trim().toUpperCase() === "AJUSTAR_MANUAL";

/**
 * Porte de app.js `marcacaoMotoristaAusente`: o que a view diz que FALTA. Não
 * deduza pelo número ou pela posição das batidas — almoço travado e batida
 * colada mudam essa ordem.
 */
export function marcacaoAusente(r) {
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

/** Este dia já foi marcado como conferido pelo DP? (main.py `get_pontos_ok`) */
export const pontoConferido = (caso) => String(caso?.tipo ?? "").trim() === "ponto_ok";

/* ---------- Real manual do DP (overlay de exibição) ---------- */
// Porte de main.py `get_revisao._rm`: o Real cravado pelo DP substitui a
// sugestão na tela. AQUI É SÓ LEITURA — nada é gravado nesta fase.
export function aplicarRealManual(linha, rm) {
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

/* ═════════════ A RESERVA LANÇADA NO INOVE (a anotação do gestor) ═════════════
   A `reservas_motoristas` vive no projeto do PRÓPRIO INOVE, não na base de
   importação do DP360 — quem grava é `src/pages/pessoas/ControleReservas.jsx`.
   Por isso ela NÃO está (nem deve estar) na allowlist do gateway `dp360-api`:
   pedir estas colunas lá devolve HTTP 400 e derruba a aba. Aqui se lê com o
   cliente Supabase normal do INOVE, como o app antigo faz em
   `ferramenta/supabase_client.py:695-715`.

   O QUE CADA CAMPO SIGNIFICA (rótulos do formulário do ControleReservas):
     hora_entrada/hora_saida — "Hora de entrada"/"Hora de saída" da reserva: o
       período em que ele ficou À DISPOSIÇÃO;
     cobertura   — "Onde/o que cobriu" (veículo, linha ou setor atendido);
     observacao  — a anotação livre do gestor sobre o dia. É ELA que não chegava
       à Gordura nem à Revisão: a leitura antiga pedia só o crachá e a data;
     criado_por_nome/criado_em         — quem LANÇOU a reserva e quando;
     atualizado_por_nome/atualizado_em — quem ALTEROU por último.

   DEGRADA SEM QUEBRAR: sem a tabela, sem permissão ou sem rede, devolve vazio e a
   tela segue sem a camada — igual ao try/except do original (main.py:4851).      */

export const COLUNAS_RESERVA =
  "funcionario_cracha,funcionario_nome,funcionario_funcao,data_referencia," +
  "hora_entrada,hora_saida,cobertura,observacao," +
  "criado_por_nome,criado_em,atualizado_por_nome,atualizado_em";

/**
 * Reservas lançadas num DIA, indexadas por `chaveDia(cracha, dia)` -> registro
 * INTEIRO (não mais um Set de "é reserva": a anotação vem junto).
 *
 * Ordem crescente de `atualizado_em` + "o último vence" deixa no mapa a reserva
 * MAIS RECENTE do dia — mesmo critério do pop-up do app antigo
 * (`order=atualizado_em.desc&limit=1`, supabase_client.py:732).
 */
export async function lerReservasInove(dia) {
  try {
    const { data, error } = await supabase
      .from("reservas_motoristas")
      .select(COLUNAS_RESERVA)
      .eq("data_referencia", dia)
      .order("atualizado_em", { ascending: true, nullsFirst: true });
    if (error) throw error;
    const mapa = new Map();
    for (const r of data || []) {
      const cr = cra8(r.funcionario_cracha);
      if (!cr) continue; // sem crachá não há como casar com o ponto
      mapa.set(chaveDia(cr, r.data_referencia), r);
    }
    return mapa;
  } catch {
    return new Map();
  }
}

/** A reserva de UMA pessoa num dia — o que o cartão mostra. `in.(…)` com as
 *  variantes do crachá porque as bases divergem no zero à esquerda. */
export async function lerReservaDoDia(cracha, dia) {
  try {
    const { data, error } = await supabase
      .from("reservas_motoristas")
      .select(COLUNAS_RESERVA)
      .in("funcionario_cracha", variantesCracha(cracha))
      .eq("data_referencia", String(dia ?? "").slice(0, 10))
      .order("atualizado_em", { ascending: false, nullsFirst: false })
      .limit(1);
    if (error) throw error;
    return (data || [])[0] || null;
  } catch {
    return null;
  }
}

/* ---------- pedaços de UI ---------- */
// Pílula da ferramenta original: `dp-pill` + tom (ok/warn/danger/accent/mute).
export function Pilula({ texto, tom = "mute", titulo }) {
  return (
    <span title={titulo} className={`dp-pill ${tom}`}>
      {texto}
    </span>
  );
}

/** Botão que existe mas não tem o que fazer agora: fica visível (some da tela =
 *  "sumiu a função") e o title diz POR QUE está apagado. */
export function BotaoSemAlvo({ children, titulo, className = "" }) {
  return (
    <button type="button" disabled title={titulo} className={`dp-btn ${className}`}>
      {children}
    </button>
  );
}

// Retorno das gravações: sucesso some sozinho da leitura ("gravou"), erro fica com o
// MOTIVO REAL que o `dp360Api` extraiu do gateway (o supabase-js engole o corpo e
// devolve sempre "non-2xx status code" — sem isso o DP fica adivinhando).
function Recado({ recado }) {
  if (!recado?.texto) return null;
  return (
    <span className={`dp-pill ${recado.tipo === "erro" ? "danger" : "ok"}`} title={recado.texto}>
      {recado.tipo === "erro" ? "✕ " : "✓ "}
      {recado.texto}
    </span>
  );
}

// Título de bloco do pop-up (o CSS do DP360 não tem classe de heading própria).
export const ESTILO_TITULO = {
  margin: "0 0 6px",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

export function TituloBloco({ children, nota }) {
  return (
    <h3 className="dp-muted" style={ESTILO_TITULO}>
      {children}
      {nota && (
        <span
          className="dp-faint"
          style={{ marginLeft: 6, fontWeight: 600, textTransform: "none", letterSpacing: 0 }}
        >
          {nota}
        </span>
      )}
    </h3>
  );
}

// Rótulo da coluna esquerda dos blocos do pop-up.
const ESTILO_ROTULO = { width: 118, flex: "none", fontWeight: 600, fontSize: 12 };

// Campo do Real manual — mesma paleta da ferramenta.
export const ESTILO_INPUT = {
  width: "100%",
  marginTop: 3,
  font: "inherit",
  fontSize: 13,
  fontVariantNumeric: "tabular-nums",
  padding: "5px 8px",
  border: "1px solid var(--dp-border-strong)",
  borderRadius: 8,
  background: "var(--dp-surface)",
  color: "var(--dp-ink)",
};

// Miolo travado pela regra da Revisão: continua VISÍVEL (o DP precisa ver o que está
// lá), mas não digitável — e não vai no payload (main.py:400-402 recusa).
const ESTILO_INPUT_TRAVADO = {
  ...ESTILO_INPUT,
  background: "var(--dp-surface-2)",
  color: "var(--dp-muted)",
  cursor: "not-allowed",
};

function AvisoTrava({ motivo }) {
  if (!motivo) return null;
  return (
    <div className="dp-card">
      <span className="dp-pill warn">⚠ sugestão bloqueada</span>{" "}
      <span className="dp-muted">
        {motivo}. Não dá para avisar nem lançar; o DP precisa cravar o Real na mão.
      </span>
    </div>
  );
}

/* ---------- pop-up do cartão ---------- */
function LinhaFonte({ rotulo, ini, fim, cor, marca, titulo }) {
  if (hm2min(ini) == null && hm2min(fim) == null) return null;
  return (
    <tr title={titulo} style={{ borderTop: "1px solid var(--dp-border)" }}>
      <td className="dp-muted" style={{ padding: "6px 8px 6px 0" }}>
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            marginRight: 6,
            verticalAlign: "middle",
            background: cor,
          }}
        />
        {rotulo}
        {marca && (
          <>
            {" "}
            <span className="dp-pill danger">{marca}</span>
          </>
        )}
      </td>
      <td className="dp-num dp-mono" style={{ textAlign: "right", padding: "6px 0" }}>
        {fmtHora(ini) || "—"}
      </td>
      <td className="dp-num dp-mono" style={{ textAlign: "right", padding: "6px 0" }}>
        {fmtHora(fim) || "—"}
      </td>
      <td className="dp-num dp-mono" style={{ textAlign: "right", padding: "6px 0" }}>
        {durHM(ini, fim)}
      </td>
    </tr>
  );
}

// Cartão de 4 batidas no formato da ferramenta: chip mono com o rótulo E/S ao lado.
function Cartao4({ valores, tom = "" }) {
  const rotulos = ["E", "S", "E", "S"];
  const cheios = valores.map(fmtHora);
  if (!cheios.some(Boolean)) return <span className="dp-faint">—</span>;
  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {cheios.map((v, i) =>
        v ? (
          <span key={`${rotulos[i]}-${i}`} className={`dp-chip dp-num ${tom}`}>
            {v}
            <span className="es">{rotulos[i]}</span>
          </span>
        ) : null,
      )}
    </span>
  );
}

function BlocoAlmoco({ titulo, ini, fim, travado, tom }) {
  const a = hm2min(ini);
  const b = hm2min(fim);
  const dur = a != null && b != null ? Math.max(0, b - a) : null;
  return (
    <div
      className="dp-card"
      style={{
        padding: "9px 11px",
        boxShadow: "none",
        background: tom === "sug" ? "var(--dp-ok-bg)" : "var(--dp-surface-2)",
      }}
    >
      <div className="dp-muted" style={{ ...ESTILO_TITULO, margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
        {titulo}
        {travado && <Lock size={11} />}
      </div>
      <div className="dp-num dp-mono" style={{ marginTop: 4, fontWeight: 600 }}>
        {fmtHora(ini) || "—"} → {fmtHora(fim) || "—"}
        {dur != null && dur > 0 && <span className="dp-muted" style={{ marginLeft: 6 }}>{dur} min</span>}
      </div>
    </div>
  );
}

/* ---------- a ANOTAÇÃO da reserva, na tela ---------- */
/**
 * O que o gestor lançou no Controle de Reservas, dito com todas as letras. Antes
 * disto a reserva só existia como um SINAL ("é reserva") e a anotação — a
 * observação, a cobertura, o horário e quem lançou — ficava para trás.
 */
function BlocoReserva({ reserva }) {
  if (!reserva) return null;
  const ent = fmtHora(reserva.hora_entrada);
  const sai = fmtHora(reserva.hora_saida);
  const dur = ent && sai ? durHM(ent, sai) : "";
  const cobertura = String(reserva.cobertura ?? "").trim();
  const observacao = String(reserva.observacao ?? "").trim();
  const lancouPor = String(reserva.criado_por_nome ?? "").trim();
  const lancouEm = fmtInstanteBR(reserva.criado_em);
  const mudouPor = String(reserva.atualizado_por_nome ?? "").trim();
  const mudouEm = fmtInstanteBR(reserva.atualizado_em);
  // Só vira linha própria quando a última alteração é OUTRO evento (outra pessoa ou
  // outro instante): repetir "lançada por X" duas vezes é ruído.
  const alterada = !!mudouEm && (mudouEm !== lancouEm || (!!mudouPor && mudouPor !== lancouPor));

  return (
    <section className="rv-res">
      <div className="rv-res-cab">
        🗓 Reserva lançada pelo gestor
        {(ent || sai) && (
          <span className="dp-num dp-mono rv-res-hora">
            {ent || "--"} → {sai || "--"}
            {dur && dur !== "—" ? ` · ${dur}` : ""}
          </span>
        )}
      </div>
      <div className="rv-res-grade">
        <div>
          <span className="rv-res-rot">Cobertura</span>
          <span className="rv-res-val">{cobertura || "não informada"}</span>
        </div>
        <div>
          <span className="rv-res-rot">Observação do gestor</span>
          <span className="rv-res-val">{observacao || "sem observação"}</span>
        </div>
        <div>
          <span className="rv-res-rot">Lançamento</span>
          <span className="rv-res-val">
            {lancouPor || "—"}
            {lancouEm ? ` · ${lancouEm}` : ""}
            {alterada ? ` · alterada por ${mudouPor || "—"} em ${mudouEm}` : ""}
          </span>
        </div>
      </div>
      <p className="rv-res-nota">
        Ele estava <b>à disposição</b> desde a hora lançada: a espera até assumir a tabela não é
        gordura (a operação real vira a união <b>reserva ∪ operação</b>) e, sem carro atribuído,
        a batida em local conhecido vale por si na régua do GPS.
      </p>
    </section>
  );
}

/* ---------- gravação do Real manual (porte de main.py `salvar_real_manual`) ------- */

const CAMPOS_RM = ["entrada", "alm_saida", "alm_volta", "saida"];
const ROTULO_RM = {
  entrada: "Entrada",
  alm_saida: "Saída almoço",
  alm_volta: "Volta almoço",
  saida: "Saída",
};

/**
 * Normaliza os campos digitados usando o MOTOR: `hm2min` aceita "1420" (o que a tela do
 * Cartão de Ponto devolve) e a notação >24h; `min2hm` devolve sempre "HH:MM" (inclusive
 * "25:40", que é o turno que vira o dia). Campo com lixo dentro vira ERRO em vez de
 * virar `null` calado — gravar vazio no lugar de um horário que a pessoa digitou é pior
 * do que recusar. Só os campos de `campos` são olhados: com o almoço travado o miolo não
 * é gravável, e não faz sentido reprovar a gravação por um valor que nem vai no payload.
 * Devolve { limpos, erro }.
 */
function normalizarRealManual(form, campos = CAMPOS_RM) {
  const limpos = {};
  for (const k of campos) {
    const bruto = String(form?.[k] ?? "").trim();
    if (!bruto) {
      limpos[k] = "";
      continue;
    }
    const m = hm2min(bruto);
    if (m === null || m < 0) {
      return { limpos: null, erro: `Horário inválido em "${ROTULO_RM[k] || k}": ${bruto}` };
    }
    limpos[k] = min2hm(m);
  }
  return { limpos, erro: "" };
}

/* ═══════════════════ AS VIAGENS DO DIA (Citatti) ═══════════════════
   Porte de main.py `get_viagens` (~445), de `supabase_client.ler_viagens_dia`
   (1086) e do pop-up `modalViagens` (app.js:4839, aberto pelo botão 🚌 que a
   linha do Citatti ganha em app.js:4602-4605).

   POR QUE ISTO EXISTE: a `viagens_qh` é a ÚNICA fonte com LINHA, TABELA e
   VEÍCULO, e é ela que desfaz a leitura errada da DUPLA PEGADA. O bloco
   "1 · Fontes" mostra "Citatti 04:12 → 21:38" e a jornada sai 17h26 — número
   que engana: são TRÊS tabelas (manhã/tarde/noite) no mesmo crachá, com horas
   de intervalo entre elas. Sem os blocos por tabela e o buraco entre eles, a
   operação apurada junta tudo numa jornada só, e não é.

   CONTRATO DA TABELA (conferido na base, HTTP 200): a chave é `matricula`
   (o CRACHÁ) — `motorista` é o NOME e não serve de filtro. As colunas abaixo
   são as que existem: pedir uma que não existe devolve HTTP 400 no gateway e
   mata a aba inteira, então esta lista não se chuta.                          */

const COLUNAS_VIAGENS = [
  "iniciorealizado",
  "fimrealizado",
  "inicioprogramado",
  "fimprogramado",
  "linha",
  "tabela",
  "veiculo",
  "sentido",
  "passageiros",
  "numeroviagem",
  "atividade",
].join(",");

// O pedido do colaborador, como a Ocorrências já o lê (`COLS_AJUSTES`). Só o que a
// linha do tempo precisa: o tipo, o horário pedido e se ele ainda está aberto.
const COLUNAS_PEDIDO_APP = "id_ocorrencia,tipo_ajuste,horario_ajuste,situacao_ajuste,capturado_em";

// As colunas de GPS conferidas na base — as mesmas que a grade da Revisão pede.
const COLUNAS_PONTO_GPS = "cracha,hora,latitude,longitude,origem";
const COLUNAS_GPS_CARRO = "cracha,hora,latitude,longitude,veiculo,poi,cerca,tipo,fonte,linha";

// A hora sai do timestamp POR FATIA, igual ao Python (`t[11:16]`) — nada de
// `new Date(...)`, que reinterpretaria o texto do lake em fuso do navegador.
const horaDoTs = (v) => {
  const t = String(v ?? "");
  return t.length >= 16 ? t.slice(11, 16) : "";
};

// `passageiros` chega como TEXTO no lake e pode vir com vírgula decimal
// (main.py `_pax`). Lixo vira 0 em vez de NaN somando na tela.
const paxDaViagem = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

/** Viagens do dia + os BLOCOS POR TABELA com o buraco entre um e outro. */
async function lerViagensDia(cracha, dia) {
  // Mesmo truque do resto da tela: as tabelas do lake divergem no zero à esquerda.
  const variantes = variantesCracha(cracha).join(",");
  const brutas = await lerDP360("viagens_qh", {
    colunas: COLUNAS_VIAGENS,
    filtros: { matricula: `in.(${variantes})`, data: `eq.${dia}` },
    ordem: "iniciorealizado.asc",
    limite: 500,
  });

  const viagens = (brutas || []).map((x) => ({
    ini: horaDoTs(x.iniciorealizado),
    fim: horaDoTs(x.fimrealizado),
    iniProg: horaDoTs(x.inicioprogramado),
    fimProg: horaDoTs(x.fimprogramado),
    linha: String(x.linha ?? "").trim(),
    tabela: String(x.tabela ?? "").trim(),
    veiculo: String(x.veiculo ?? "").trim(),
    sentido: String(x.sentido ?? "").trim(),
    pax: paxDaViagem(x.passageiros),
    n: x.numeroviagem,
    atividade: String(x.atividade ?? "").trim(),
  }));

  // Blocos por TABELA, na ordem do dia (main.py:467-485). A troca de tabela é o
  // que separa uma pegada da outra; o `gap` entre elas é a prova da dupla pegada.
  const blocos = [];
  let atual = null;
  for (const v of viagens) {
    if (!atual || v.tabela !== atual.tabela) {
      atual = {
        tabela: v.tabela,
        ini: v.ini,
        fim: v.fim,
        linhas: new Set(),
        veiculos: new Set(),
        atividades: new Set(),
        n: 0,
        pax: 0,
        gap: null,
      };
      blocos.push(atual);
    }
    atual.fim = v.fim || atual.fim;
    atual.n += 1;
    atual.pax += v.pax;
    if (v.linha) atual.linhas.add(v.linha);
    if (v.veiculo) atual.veiculos.add(v.veiculo);
    if (v.atividade) atual.atividades.add(v.atividade);
  }
  for (const b of blocos) {
    b.linhas = [...b.linhas].sort();
    b.veiculos = [...b.veiculos].sort();
    b.atividades = [...b.atividades].sort();
  }
  for (let i = 1; i < blocos.length; i += 1) {
    const fimAnterior = hm2min(blocos[i - 1].fim);
    const iniAtual = hm2min(blocos[i].ini);
    // Só conta buraco quando o bloco seguinte começa DEPOIS (main.py:483) — a
    // virada de meia-noite daria um "gap" negativo sem sentido.
    blocos[i].gap = fimAnterior != null && iniAtual != null && iniAtual > fimAnterior ? iniAtual - fimAnterior : null;
  }

  return { viagens, blocos };
}

/** O pop-up SOBRE o pop-up (app.js `modalViagens`): resumo por tabela + a lista. */
function ModalViagens({ cracha, nome, dia, aoFechar }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro("");
    lerViagensDia(cracha, dia)
      .then((r) => {
        if (ativo) setDados(r);
      })
      .catch((falha) => {
        if (ativo) setErro(falha.message || "Não foi possível ler as viagens deste dia.");
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
      if (e.key === "Escape") {
        e.stopPropagation(); // fecha SÓ este; o cartão de trás continua aberto
        aoFechar();
      }
    };
    document.addEventListener("keydown", escapa, true);
    return () => document.removeEventListener("keydown", escapa, true);
  }, [aoFechar]);

  const viagens = dados?.viagens || [];
  const blocos = dados?.blocos || [];

  return (
    <div className="rv-overlay rv-overlay-alto" onClick={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="rv-box dp-card" style={{ maxWidth: 860, padding: 0 }}>
        <header className="rv-head">
          <div className="min-w-0">
            <b style={{ fontSize: 14 }}>🚌 Viagens do dia</b>
            <div className="dp-muted" style={{ fontSize: 12, marginTop: 2 }}>
              <b style={{ color: "var(--dp-ink)" }}>{nome || "—"}</b>
              <span className="dp-num"> · crachá {cracha} · {fmtData(dia)}</span>
            </div>
          </div>
          <button type="button" onClick={aoFechar} className="dp-btn" aria-label="Fechar">
            <X size={14} />
          </button>
        </header>

        <div className="rv-corpo rv-corpo-pad" style={{ display: "grid", gap: 12 }}>
          {carregando && <p className="dp-faint" style={{ margin: 0 }}>Carregando as viagens…</p>}
          {!!erro && <span className="dp-pill danger">{erro}</span>}

          {!carregando && !erro && !viagens.length && (
            <p className="dp-muted" style={{ margin: 0, fontSize: 12.5 }}>
              Nenhuma viagem registrada nesse dia (o motorista não operou, ou a viagem não veio do Citatti).
            </p>
          )}

          {!!viagens.length && (
            <>
              {/* A DUPLA PEGADA, dita com todas as letras. É o motivo do pop-up existir. */}
              {blocos.length > 1 && (
                <div className="rv-alerta">
                  ⚠ <b>{blocos.length} pegadas</b> no mesmo dia — a operação apurada junta tudo numa jornada só,
                  e não é.
                </div>
              )}

              <div style={{ display: "grid", gap: 6 }}>
                {blocos.map((b, i) => (
                  <div key={`${b.tabela}-${i}`}>
                    {b.gap != null && (
                      <div className="rv-gap">
                        ⏸ <b>{fmtMin(b.gap)}</b> parado entre uma pegada e outra
                      </div>
                    )}
                    <div className="rv-bloco">
                      <span className="rv-bloco-tab">{b.tabela || "—"}</span>
                      <span className="rv-bloco-hora dp-num dp-mono">
                        {b.ini || "--"} – {b.fim || "--"}
                      </span>
                      <span className="rv-bloco-det dp-muted">
                        {b.n} viagem(ns) · linha <b style={{ color: "var(--dp-ink)" }}>{b.linhas.join(" / ") || "—"}</b>
                        {" · "}carro {b.veiculos.join(" / ") || "—"} · {b.pax} passageiros
                        {b.atividades.length ? ` · ${b.atividades.join(" / ")}` : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rv-tabela-wrap">
                <table className="rv-tabela">
                  <thead>
                    <tr>
                      <th>Horário</th>
                      <th>Linha</th>
                      <th>Tabela</th>
                      <th>Atividade</th>
                      <th>Sentido</th>
                      <th>Carro</th>
                      <th style={{ textAlign: "right" }}>Pax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viagens.map((v, i) => (
                      <tr key={`${v.tabela}-${v.n ?? i}-${i}`}>
                        <td
                          className="dp-num dp-mono"
                          title={
                            v.iniProg || v.fimProg
                              ? `programado ${v.iniProg || "--"} – ${v.fimProg || "--"}`
                              : "sem horário programado"
                          }
                        >
                          {v.ini || "--"} <span className="dp-faint">→</span> {v.fim || "--"}
                        </td>
                        <td>
                          <b>{v.linha || "—"}</b>
                        </td>
                        <td>{v.tabela || "—"}</td>
                        <td className="dp-muted">{v.atividade || "—"}</td>
                        <td className="dp-muted">{v.sentido || "—"}</td>
                        <td className="dp-num dp-mono">{v.veiculo || "—"}</td>
                        <td className="dp-num dp-muted" style={{ textAlign: "right" }}>
                          {v.pax || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═════════ O BOTÃO DE DECISÃO DA REVISÃO (bloco extra do rodapé) ═════════
   main.py `marcar_ponto_ok` (~415). Um registro em `ponto_caso` (tipo='ponto_ok')
   tira o dia da Revisão E o conta como certo nas Folgas; desfazer LIMPA a marca.
   Vive aqui — junto do resto da gravação de crachá×dia — mas é a Revisão que o
   pendura no rodapé, via `acoesRodape`: é botão de decisão DELA.

   O crachá vai como `str(cracha).strip()`, igual ao Python — a chave do upsert é
   (cracha, date_ref) e mudar a forma criaria uma segunda linha para o mesmo dia. */
export function BotaoPontoConferido({ linha, caso, aoRecarregar }) {
  const [salvando, setSalvando] = useState(false);
  const [recado, setRecado] = useState(null);
  const jaConferido = pontoConferido(caso);
  const dia = String(linha?.date_ref ?? "").slice(0, 10);
  const cracha = linha?.cracha;

  const marcar = async (ligar) => {
    setRecado(null);
    setSalvando(true);
    const agora = agoraUtc();
    const payload = {
      cracha: String(cracha ?? "").trim(),
      date_ref: dia,
      nm_funcionario: linha?.nm_funcionario || "",
      atualizado_em: agora,
      ...(ligar
        ? { origem: "revisao", tipo: "ponto_ok", aceite: "aceito", ajuste: "certo", conferido_em: agora }
        : { tipo: "", aceite: "pendente", ajuste: null, conferido_em: null }),
    };
    try {
      await upsertDP360("ponto_caso", payload);
      setRecado({
        tipo: "ok",
        texto: ligar ? "Dia marcado como conferido." : "Marca desfeita — o dia volta para a Revisão.",
      });
      if (aoRecarregar) {
        try {
          await aoRecarregar(cracha, dia);
        } catch {
          /* a gravação já foi; falhar a releitura não desfaz nada */
        }
      }
    } catch (falha) {
      setRecado({ tipo: "erro", texto: falha.message || "Não foi possível gravar o ponto conferido." });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Recado recado={recado} />
      <button
        type="button"
        className={`dp-btn ${jaConferido ? "" : "primary"}`}
        disabled={salvando}
        onClick={() => marcar(!jaConferido)}
        title={
          jaConferido
            ? "Desfaz a marca: o dia volta para a lista da Revisão."
            : "O dia está certo do jeito que está, mesmo que a régua automática ainda peça revisão."
        }
      >
        {salvando ? "gravando…" : jaConferido ? "↩ Desfazer conferido" : "✓ Ponto conferido"}
      </button>
    </>
  );
}

/* ═══════════════════════ A SEMANA DELE ═══════════════════════
   Porte de main.py:797 (`get_semana`) + app.js:948-963 e :5044-5063.

   POR QUE ELA É A PEÇA MAIS SÉRIA DESTE POP-UP: inserir ponto no dia de FOLGA de
   alguém é o erro que não se desfaz. O pedido chega isolado, o cartão do dia está
   vazio, e nada na tela dizia se aquele dia era de trabalho. Com os sete dias à
   vista, EDISON 23/07 se lê num piscar — seg·ter·qua·sex·dom completos e 23/07
   vazio: é dia de trabalho mesmo, a inserção procede. E o inverso também: dia
   vazio com os outros SEIS batidos é 6x1, a folga é este — e aí o certo é parar.

   BATIDA COLADA CONTA COMO UMA SÓ. Contar marcação crua mente: MARCO tem qua/qui/sex
   com 4 a 6 marcações e todas terminam num par de 1 minuto — o dia aparecia
   "completo ✓" tendo 3 batidas reais. Quem colapsa é o MOTOR (`removeFantasmas`),
   a mesma régua do resto do cartão — aqui não há segunda detecção.                */

function FaixaSemana({ semana, resumo, carregando, erro }) {
  if (carregando) {
    return (
      <div className="dp-card cd-sem">
        <span className="cd-sem-t">Semana dele</span>
        <span className="dp-faint" style={{ fontSize: 11.5 }}>
          lendo os 7 dias…
        </span>
      </div>
    );
  }
  // A FALHA APARECE. Sumir em silêncio seria o pior desfecho possível para esta faixa:
  // ela é a trava contra inserir ponto em dia de folga, e quem não a vê não sabe que
  // está decidindo sem ela — conclui que o dia "não tem nada de estranho".
  if (erro) {
    return (
      <div className="dp-card cd-sem">
        <span className="cd-sem-t">Semana dele</span>
        <span className="dp-pill warn">⚠ não foi possível ler a semana</span>{" "}
        <span className="dp-muted" style={{ fontSize: 11.5 }}>
          {erro}. Decida sem ela por sua conta e risco: nada aqui diz se este dia era de folga.
        </span>
      </div>
    );
  }
  if (!semana?.length || !resumo) return null;
  return (
    <div className="dp-card cd-sem">
      <span
        className="cd-sem-t"
        title="Os 7 dias (segunda a domingo) da semana deste dia, com as batidas LIMPAS de cada um."
      >
        Semana dele
      </span>
      <div className="cd-sem-l">
        {semana.map((d) => (
          <span
            key={d.data}
            className={`cd-sd ${d.n >= 4 ? "ok" : d.n ? "mag" : "vazio"}${d.colados ? " colado" : ""}${
              d.hoje ? " hoje" : ""
            }`}
            title={
              `${d.dia} ${fmtData(d.data)} — ` +
              (d.nBruto ? `${d.nBruto} marcação(ões): ${d.batidas}` : "sem ponto") +
              (d.colados ? ` · ${d.colados} colada(s) → ${d.n} batida(s) real(is)` : "") +
              (d.status ? ` · ${d.status}` : "")
            }
          >
            <b>{d.dia}</b>
            <i>{d.n >= 4 ? "✓" : d.n || "—"}</i>
            {!!d.colados && <u title="tem batida colada">•</u>}
          </span>
        ))}
      </div>
      <span className="cd-sem-n">
        <b>{resumo.completos}</b> dia(s) completo(s) de {resumo.comPonto} com ponto ·{" "}
        {resumo.hoje?.n ? (
          <>
            este dia tem <b>{resumo.hoje.n}</b> batida(s)
          </>
        ) : (
          <>
            este dia está <b>sem ponto</b>
          </>
        )}
        {!!resumo.comColada && (
          <>
            {" · "}
            <b className="cd-rj">{resumo.comColada} dia(s) com batida colada</b>
          </>
        )}
      </span>
      {/* FOLGA PROVÁVEL (app.js:958-963): o dia está vazio e os outros SEIS já têm ponto —
          6x1, a folga é este. Inserir ponto aqui é o que precisa de um segundo olhar, e a
          faixa diz isso com todas as letras em vez de deixar o DP deduzir do desenho. */}
      {resumo.folgaProvavel && (
        <span className="cd-sem-alerta">
          ⚠ <b>Os outros 6 dias já têm ponto</b> — este parece ser a <b>FOLGA</b>. Confira a escala antes
          de inserir ponto neste dia.
        </span>
      )}
    </div>
  );
}

/* ═══════════════ PEDIR EXCLUSÃO DE BATIDA INDEVIDA ═══════════════
   Porte de app.js:4927-4939 (`acaoDia`, ramo `pedir_exclusao`) + main.py:8036.

   O BURACO QUE ISTO FECHA: o modelo `template_pedir_exclusao` é editável no Config
   e NADA o enviava — o admin editava uma carta que a tela não conseguia mandar, e o
   dia de batida colada caía em "pedir registro do ponto", que é o pedido errado: não
   há o que ele registre, há o que ele apague. As regras (formato do CSV, a barreira
   da assinatura, o caso que abre, o reaviso) são de `../comunicadoTransnet`, as
   MESMAS dos outros cinco tipos; este componente é só a TELA.

   DOIS BOTÕES, NUNCA UM CHECKBOX. Ensaio: o robô anexa o arquivo e NÃO confirma —
   e ensaio NÃO ABRE CASO. A ordem é disparar e só então gravar o caso: gravá-lo antes
   de saber se o robô saiu deixaria alguém "avisado" por um disparo que o GitHub
   recusou.                                                                        */

function ModalPedirExclusao({ linha, caso, aoFechar, aoConcluir }) {
  const [template, setTemplate] = useState(null);
  const [erro, setErro] = useState("");
  const [disparando, setDisparando] = useState(false);
  const [recado, setRecado] = useState(null);

  // main.py `sc.tem_coluna("ponto_caso", "ponto_antes")`: a coluna existe em algumas
  // instalações e não em outras, e coluna inexistente no upsert derruba a gravação
  // inteira. Só entra quando ela FOI VISTA numa linha já lida deste dia.
  const comPontoAntes = !!caso && Object.prototype.hasOwnProperty.call(caso, "ponto_antes");

  useEffect(() => {
    let ativo = true;
    lerDP360("app_config", { filtros: { chave: `eq.${chaveTemplate("pedir_exclusao")}` }, limite: 1 })
      .then((cfg) => {
        if (ativo) setTemplate(escolherTemplate(cfg?.[0]?.valor, "pedir_exclusao"));
      })
      .catch((falha) => {
        // Sem o app_config o envio não trava: cai no texto oficial e a tela avisa.
        if (!ativo) return;
        setTemplate(escolherTemplate("", "pedir_exclusao"));
        setErro(`Não foi possível ler o modelo salvo (${falha.message || falha}). Usando o texto padrão.`);
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const escapa = (e) => {
      if (e.key === "Escape" && !disparando) aoFechar();
    };
    document.addEventListener("keydown", escapa);
    return () => document.removeEventListener("keydown", escapa);
  }, [aoFechar, disparando]);

  // O carimbo do caso é o INSTANTE do envio, então o preparo é refeito no clique.
  // Este é só o da tela (prévia, barrados, CSV que a pessoa vê).
  const montar = useCallback(
    (agora) =>
      prepararComunicado({
        tipo: TIPO.PEDIR_EXCLUSAO,
        linhas: [linha],
        mensagemDe: (l) => mensagemPedirExclusao(template, l),
        comPontoAntes,
        agora,
      }),
    [linha, template, comPontoAntes],
  );
  const preparo = useMemo(() => (template ? montar(undefined) : null), [template, montar]);
  const pendentes = useMemo(
    () => [...new Set((preparo?.itens || []).flatMap((i) => variaveisPendentes(i.mensagem)))],
    [preparo],
  );
  const jaAvisado = String(caso?.aviso_enviado_em ?? "").trim();

  const disparar = async (confirmar) => {
    const p = montar(agoraUtc());
    if (!p.itens.length) {
      setRecado({
        tipo: "erro",
        texto: p.barrados[0]?.motivo
          ? `Não sai: ${p.barrados[0].motivo}.`
          : "Nenhum comunicado a enviar.",
      });
      return;
    }
    if (pendentes.length) {
      setRecado({ tipo: "erro", texto: `Envio bloqueado: variável sem preencher (${pendentes.join(", ")}).` });
      return;
    }
    const item = p.itens[0];
    const cabeca = confirmar
      ? `ENVIAR DE VERDADE o pedido de EXCLUSÃO de batida no Transnet:`
      : `ENSAIO (o robô anexa o arquivo e NÃO confirma o envio):`;
    // O que ACONTECE, dito sem eufemismo — inclusive o que este pedido NÃO faz.
    const efeito = confirmar
      ? `${item.nome || item.cracha} recebe no Transnet o pedido de APAGAR o registro do dia, e o caso ` +
        `deste dia é aberto/atualizado em ponto_caso com o carimbo do aviso.\n` +
        `NENHUM horário é lançado por este pedido: ele não abre correção de ponto — quem exclui a ` +
        `batida é o próprio colaborador, pelo aplicativo.`
      : `Nada é enviado e NENHUM caso é aberto.`;
    if (
      !window.confirm(
        `${cabeca}\n\n· ${item.nome || item.cracha} (${item.cracha}) — ${item.data}\n\n${efeito}\n\n` +
          `Quem executa é o robô, no GitHub Actions. O disparo fica registrado com o seu nome.`,
      )
    )
      return;

    setDisparando(true);
    setRecado(null);
    try {
      // ORDEM DELIBERADA: dispara PRIMEIRO, grava o caso DEPOIS.
      const r = await dispararRoboDP360("comunicado", {
        csv: p.csv,
        data: p.datas[0],
        motivo: MOTIVO_AVISO, // aviso (102). Advertência não sai desta rota — nem poderia:
        confirmar: confirmar ? "true" : "false", // não há alvo, então não há o que corrigir depois.
      });

      let alerta = "";
      let reavisados = [];
      if (confirmar && p.casos.length) {
        const { casos, reavisos } = marcarReavisos(p.casos, () => caso || null);
        reavisados = reavisos;
        try {
          await upsertDP360("ponto_caso", casos);
        } catch (falha) {
          alerta =
            ` ATENÇÃO: o comunicado SAIU, mas o registro em ponto_caso falhou (${falha.message || falha}).` +
            ` O dia não consta como avisado — avise quem cuida do ciclo.`;
        }
      }
      setRecado({
        tipo: alerta ? "erro" : "ok",
        texto:
          `${confirmar ? "Pedido de exclusão" : "Ensaio"} disparado — ${item.nome || item.cracha}, ${item.data}.` +
          (reavisados.length ? " Este dia já tinha sido avisado antes (o registro original ficou)." : "") +
          alerta,
        painel: r?.painel || "",
      });
      if (confirmar && aoConcluir) await aoConcluir();
    } catch (falha) {
      setRecado({ tipo: "erro", texto: falha?.message || "Não foi possível disparar o robô." });
    } finally {
      setDisparando(false);
    }
  };

  const primeira = preparo?.itens?.[0];
  return (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-y-auto"
      style={{ background: "rgba(15,20,32,.5)", padding: 16, zIndex: 60 }}
    >
      <div className="dp-card w-full max-w-3xl" style={{ padding: 0 }}>
        <header
          className="flex items-start justify-between gap-3"
          style={{ padding: "14px 18px", borderBottom: "1px solid var(--dp-border)" }}
        >
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 14 }}>🗑 Pedir exclusão de batida — {linha.nm_funcionario || linha.cracha}</b>
            <div className="dp-muted" style={{ fontSize: 11.5, marginTop: 2 }}>
              O pedido é para o colaborador <b>APAGAR</b> o registro pelo aplicativo de ponto — não há
              horário a corrigir. O modelo é o <b>template_pedir_exclusao</b> da aba Config. O CSV sai
              idêntico ao Transnet (Empresa · Crachá · Comunicado, campos entre aspas).
            </div>
          </div>
          <button type="button" className="dp-det-x" onClick={aoFechar} aria-label="Fechar">
            <X size={16} />
          </button>
        </header>

        <div style={{ padding: "14px 18px", display: "grid", gap: 12 }}>
          {erro && <div className="dp-pill warn">{erro}</div>}
          {!template && <div className="dp-muted">Carregando o modelo…</div>}

          {template && (
            <div>
              <label className="dp-muted" style={{ fontSize: 11.5, display: "block", marginBottom: 4 }}>
                Texto que vai para o colaborador — a edição aqui vale <b>só para este envio</b>. Para mudar
                o modelo salvo, use a aba <b>Config</b>.
              </label>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={7}
                style={{ ...ESTILO_INPUT, width: "100%", minHeight: 120, resize: "vertical" }}
              />
            </div>
          )}

          {primeira && (
            <div className="dp-card" style={{ fontSize: 12 }}>
              <b>Prévia — como vai no CSV:</b>
              <div style={{ marginTop: 4 }}>&quot;{primeira.mensagem}&quot;</div>
            </div>
          )}

          {!!pendentes.length && (
            <div className="dp-pill danger">Não enviar: variável sem preencher ({pendentes.join(", ")}).</div>
          )}

          {/* O BARRADO APARECE, com nome e motivo — não some da tela em silêncio. */}
          {!!preparo?.barrados?.length && (
            <div className="dp-card" style={{ borderColor: "var(--dp-danger-ink)" }}>
              <span className="dp-pill danger">⚠ não recebe</span>{" "}
              <span className="dp-muted" style={{ fontSize: 11.5 }}>
                {preparo.barrados[0].nome || "—"} ({preparo.barrados[0].cracha}) — {preparo.barrados[0].motivo}.
                Nada é enviado e nenhum caso é aberto.
              </span>
            </div>
          )}

          {!!jaAvisado && (
            <p className="dp-muted" style={{ margin: 0, fontSize: 11.5 }}>
              Este dia <b>já foi avisado</b> em {fmtDataHora(jaAvisado)}. Enviar de novo recarimba a data
              (o prazo reinicia, que é o efeito de reavisar) e <b>não reescreve</b> o que ficou congelado
              no primeiro aviso.
            </p>
          )}
        </div>

        <footer
          className="flex flex-wrap items-center justify-between gap-3"
          style={{
            padding: "12px 18px",
            borderTop: "1px solid var(--dp-border)",
            background: "var(--dp-surface-2)",
            borderRadius: "0 0 var(--dp-radius) var(--dp-radius)",
          }}
        >
          <div className="dp-det-bot-linha" style={{ minWidth: 0 }}>
            {disparando && <span className="dp-pill accent">disparando…</span>}
            {recado && (
              <>
                <span className={`dp-pill ${recado.tipo === "ok" ? "ok" : "danger"}`}>{recado.texto}</span>
                {recado.painel && (
                  <>
                    {" "}
                    <a className="dp-btn" href={recado.painel} target="_blank" rel="noreferrer">
                      ver o robô
                    </a>
                  </>
                )}
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="dp-btn"
              disabled={!template || disparando || !preparo?.itens?.length}
              onClick={() => disparar(false)}
              title="O robô anexa o arquivo no Transnet e NÃO confirma o envio. Nenhum caso é aberto."
            >
              Ensaio
            </button>
            <button
              type="button"
              className="dp-btn primary"
              disabled={!template || disparando || !preparo?.itens?.length || !!pendentes.length}
              onClick={() => disparar(true)}
              title="Envia de verdade no Transnet e abre/atualiza o caso deste dia em ponto_caso."
            >
              Enviar de verdade
            </button>
            <button type="button" className="dp-btn" onClick={aoFechar} disabled={disparando}>
              Fechar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* =============================================================================
   O CARTÃO
   ========================================================================== */
export default function CartaoDoDia({
  linha,
  caso,
  gps, // resumo do GPS já calculado pela tela (a Revisão calcula o dia inteiro)
  gpsAuto = false, // sem `gps` pronto, o cartão lê ponto_gps/gps_carro deste crachá×dia
  gorduraDaTela, // linha de `ponto_gordura` JÁ TRATADA pela tela (a Gordura passa a dela)
  aoFechar,
  aoRecarregar,
  aoAvisar,
  impedimentoAviso,
  previaAviso,
  selos, // pílulas extras no cabeçalho
  blocoLateral, // bloco extra no topo da coluna 2
  acoesRodape, // botões de decisão da tela
  rodapeInfo, // frase do rodapé
}) {
  const [extra, setExtra] = useState({
    gordura: null,
    intervalo: null,
    ajustes: [],
    pedidos: [],
    reserva: null,
    gps: null,
  });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  // Gravação: um recado por bloco, para o sucesso/erro aparecer ONDE a pessoa clicou.
  const [salvando, setSalvando] = useState("");
  const [recadoRm, setRecadoRm] = useState(null);
  // O detalhamento das viagens abre SOBRE o cartão (não no lugar dele): o DP está
  // olhando o caso e as viagens são a explicação da operação que ele está lendo.
  const [verViagens, setVerViagens] = useState(false);
  // A SEMANA (main.py `get_semana`) e o pedido de exclusão da batida indevida.
  const [semana, setSemana] = useState(null);
  const [erroSemana, setErroSemana] = useState("");
  const [pedirExclusao, setPedirExclusao] = useState(false);

  const dia = String(linha.date_ref ?? "").slice(0, 10);
  const cracha = linha.cracha;
  // A tela mandou a gordura já tratada? Então é ela que vale — a Gordura aplica as
  // QUATRO CAMADAS (`regrasGordura`) antes de exibir, e o pop-up não pode mostrar a
  // linha crua: a "Operação real" sairia diferente da que está na grade atrás dele.
  const g = gorduraDaTela || extra.gordura || {};
  const semGpsProprio = !gpsAuto || !!gps;

  useEffect(() => {
    let ativo = true;
    const variantes = variantesCracha(cracha).join(",");
    setCarregando(true);
    setErro("");
    Promise.all([
      lerDP360("ponto_gordura", { filtros: { cracha: `in.(${variantes})`, data_ref: `eq.${dia}` }, limite: 5 }),
      lerDP360("ponto_intervalo", { filtros: { cracha: `in.(${variantes})`, data_ref: `eq.${dia}` }, limite: 5 }),
      lerDP360("ponto_ajustes", { filtros: { cracha: `in.(${variantes})`, date_ref: `eq.${dia}` }, limite: 50 }),
      // O QUE ELE PEDIU NO APP. Sem isto a linha do tempo dizia só "Ajuste no app"
      // e não dizia o quê (app.js:4585-4589 usa o mesmo dado, vindo do
      // pré-carregamento da Conferência). Aqui o cartão lê direto o crachá×dia.
      // `ponto_ajustes_app` guarda aviso/advertência/atestado na MESMA tabela, sem
      // `tipo_ajuste`; essas linhas NÃO são pedido do colaborador e são descartadas
      // abaixo (a mesma regra da Ocorrências).
      lerDP360("ponto_ajustes_app", {
        colunas: COLUNAS_PEDIDO_APP,
        filtros: { cracha: `in.(${variantes})`, date_ref: `eq.${dia}` },
        limite: 50,
      }).catch(() => []),
      // A ANOTAÇÃO DA RESERVA. Outra base (o Supabase do próprio INOVE) e outro
      // cliente — nunca o gateway `dp360-api`, que não cobre esta tabela. Já degrada
      // sozinha: sem reserva (ou sem permissão) devolve null e o bloco não aparece.
      lerReservaDoDia(cracha, dia),
      // O GPS só é lido quando a tela não trouxe o dela (a Revisão calcula o dia
      // inteiro de uma vez; a Gordura não lê GPS e pede este caminho).
      semGpsProprio
        ? Promise.resolve(null)
        : lerDP360("ponto_gps", {
            colunas: COLUNAS_PONTO_GPS,
            filtros: { cracha: `in.(${variantes})`, date_ref: `eq.${dia}` },
            limite: 200,
          }).catch(() => []),
      semGpsProprio
        ? Promise.resolve(null)
        : lerDP360("gps_carro", {
            colunas: COLUNAS_GPS_CARRO,
            filtros: { cracha: `in.(${variantes})`, date_ref: `eq.${dia}` },
            limite: 500,
          }).catch(() => []),
    ])
      .then(([gordura, intervalo, ajustes, pedidos, reserva, batidas, ancoras]) => {
        if (!ativo) return;
        // A janela da operação ancora cada ponta na régua (main.py `get_gps_flags`):
        // real > citatti > bilhetagem > SST. E o DIA DE RESERVA vem da tabela do
        // INOVE — sem carro atribuído, batida em local conhecido vale por si
        // (main.py:281-288), que é o que apaga o falso "bateu fora".
        const base = gorduraDaTela || gordura?.[0] || {};
        const gpsProprio = batidas
          ? calcularGps({
              batidas: batidas || [],
              ancoras: ancoras || [],
              ehReserva: !!reserva,
              opIni: base.real_inicio || base.op_inicio || base.val_inicio || base.sst_vinculo || "",
              opFim: base.real_fim || base.op_fim || base.val_fim || base.sst_desvinculo || "",
            })
          : null;
        setExtra({
          gordura: gordura?.[0] || null,
          intervalo: intervalo?.[0] || null,
          ajustes: ajustes || [],
          pedidos: (pedidos || []).filter((p) => String(p.tipo_ajuste ?? "").trim()),
          reserva,
          gps: gpsProprio,
        });
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
  }, [cracha, dia, semGpsProprio, gorduraDaTela]);

  /* ---- A SEMANA DELE (main.py:797 `get_semana`) ----
     Leitura própria e independente do resto: se ela falhar, a faixa some e o cartão
     continua inteiro. Sete dias de UM crachá — `in.(...)` nas duas colunas, uma
     chamada só. As colunas são as quatro que a faixa usa; `todas_batidas` é a fonte
     do cartão de cada dia (a `batidas_limpas` sozinha descarta a entrada em ~400
     dias, main.py:7734 — por isso o motor também prefere a primeira).              */
  useEffect(() => {
    let ativo = true;
    setSemana(null);
    setErroSemana("");
    const dias = semanaDe(dia);
    if (!dias.length) {
      setSemana([]);
      return undefined;
    }
    lerDP360("ponto_diario", {
      colunas: "cracha,date_ref,todas_batidas,status_ponto",
      filtros: {
        cracha: `in.(${variantesCracha(cracha).join(",")})`,
        date_ref: `in.(${dias.join(",")})`,
      },
      limite: 60,
    })
      .then((linhas) => {
        if (!ativo) return;
        const porDia = new Map();
        for (const l of linhas || []) porDia.set(String(l.date_ref ?? "").slice(0, 10), l);
        setSemana(
          dias.map((d, i) => {
            const l = porDia.get(d) || {};
            const bruto = String(l.todas_batidas ?? "").trim();
            const marcacoes = batidasDoCartao(bruto);
            const { limpas, fora } = removeFantasmas(marcacoes);
            return {
              data: d,
              dia: NOMES_SEMANA[i],
              n: limpas.length, // batidas REAIS (a colada conta como uma só)
              nBruto: marcacoes.length, // marcações cruas, como o cartão mostra
              colados: fora.length,
              // O separador do lake é `|`, mas há linha com vírgula — o motor aceita os
              // dois (`batidasDoCartao`), e a legenda tem de aceitar também, senão o dia
              // vira um blocão ilegível no title.
              batidas: bruto.split(/[|,]/).map((x) => x.trim()).filter(Boolean).join(" · "),
              status: String(l.status_ponto ?? "").trim(),
              hoje: d === dia,
            };
          }),
        );
      })
      .catch((falha) => {
        if (!ativo) return;
        setSemana([]);
        setErroSemana(falha?.message || "falha ao ler a ponto_diario");
      });
    return () => {
      ativo = false;
    };
  }, [cracha, dia]);

  /* ---- A MENSAGEM do balão da linha do tempo ----
     O modelo é o MESMO que o envio usa: sai do `app_config` e cai no texto oficial
     quando não há nada salvo. Quem monta o texto é o `previaAviso` da aba, que já
     sabe a rota do dia (motorista, interno, bateu-fora ou gordura) e usa as mesmas
     funções do disparo — assim a prévia e o que sai de verdade não podem divergir.
     A CHAVE do modelo é da rota: a Revisão usa a família `template_*`
     (`chaveTemplate`) e a Gordura usa `comunicado_modelo`, que não é dessa família
     — por isso `configChave`/`resolver` podem vir prontos de quem chama.
     Sem modelo, o balão só não aparece: nada trava. */
  const [mensagemAviso, setMensagemAviso] = useState("");
  const chavePrevia = previaAviso?.chave || "";
  useEffect(() => {
    let ativo = true;
    setMensagemAviso("");
    if (!chavePrevia || !previaAviso?.montar) return undefined;
    const chaveConfig = previaAviso.configChave || chaveTemplate(chavePrevia);
    const resolver = previaAviso.resolver || ((valor) => escolherTemplate(valor, chavePrevia));
    lerDP360("app_config", { filtros: { chave: `eq.${chaveConfig}` }, limite: 1 })
      .then((cfg) => {
        if (!ativo) return;
        setMensagemAviso(previaAviso.montar(resolver(cfg?.[0]?.valor)) || "");
      })
      .catch(() => {
        // Sem o app_config o balão ainda vale: o texto oficial é o mesmo do envio.
        if (ativo) setMensagemAviso(previaAviso.montar(resolver("")) || "");
      });
    return () => {
      ativo = false;
    };
    // `montar` fecha sobre a linha; a identidade dele já muda quando a linha muda.
  }, [chavePrevia, previaAviso]);

  useEffect(() => {
    const escapa = (e) => {
      // Com um pop-up aberto por cima (viagens ou pedido de exclusão), o Esc fecha SÓ
      // ele — quem trata é o próprio — senão os dois sumiriam de uma vez.
      if (e.key === "Escape" && !verViagens && !pedirExclusao) aoFechar();
    };
    document.addEventListener("keydown", escapa);
    return () => document.removeEventListener("keydown", escapa);
  }, [aoFechar, verViagens, pedirExclusao]);

  const iv = extra.intervalo || {};
  const gpsEfetivo = gps || extra.gps;
  const bloqueio = sugBloqueio(linha);
  const travado = ehVerdadeiro(linha.almoco_travado);

  /* ---- formulário do Real manual ---- */
  // Prefill: o que o DP já cravou; sem isso, a SUGESTÃO da ferramenta — é o que a tela
  // sempre mostrou nesses campos, e salvar é justamente "aceito, crava isto".
  // Reinicia quando muda o crachá/dia OU quando o Real do banco muda (pós-gravação).
  const rmDoBanco = useMemo(
    () => ({
      entrada: fmtHora(linha.rm_entrada),
      alm_saida: fmtHora(linha.rm_alm_saida),
      alm_volta: fmtHora(linha.rm_alm_volta),
      saida: fmtHora(linha.rm_saida),
    }),
    [linha.rm_entrada, linha.rm_alm_saida, linha.rm_alm_volta, linha.rm_saida],
  );
  const [form, setForm] = useState(null);
  const semente = useMemo(
    () => ({
      entrada: rmDoBanco.entrada || fmtHora(linha.entrada_sug),
      alm_saida: rmDoBanco.alm_saida || fmtHora(linha.almoco_saida_sug),
      alm_volta: rmDoBanco.alm_volta || fmtHora(linha.almoco_volta_sug),
      saida: rmDoBanco.saida || fmtHora(linha.saida_sug),
    }),
    [rmDoBanco, linha.entrada_sug, linha.almoco_saida_sug, linha.almoco_volta_sug, linha.saida_sug],
  );
  useEffect(() => setForm(null), [cracha, dia, rmDoBanco]);
  const valores = form || semente;
  const mudarCampo = (k, v) => setForm({ ...valores, [k]: v });

  // Bilhetagem "fora da curva": longe da operação real na entrada. É o outlier
  // que não pode reger a correção sozinho. Distância de relógio é do motor
  // (`difRelogio`), que aguenta a notação 25:14 do cartão.
  const opIni = hm2min(g.op_inicio) != null ? hm2min(g.op_inicio) : hm2min(g.sst_vinculo);
  const valIni = hm2min(g.val_inicio);
  const divergencia = opIni != null && valIni != null ? difRelogio(opIni, valIni) : null;
  const bilhetagemFora = divergencia != null && divergencia > DIVERGENCIA_BILHETAGEM_MIN;

  const alvo4 = [linha.alvo_entrada, linha.alvo_saida_almoco, linha.alvo_volta_almoco, linha.alvo_saida];
  const sug4 = [linha.entrada_sug, linha.almoco_saida_sug, linha.almoco_volta_sug, linha.saida_sug];
  const real4 = [linha.entrada, linha.saida_almoco, linha.volta_almoco, linha.saida];

  // Almoço sugerido: a REGRA DOS 27 MIN é do motor (`almocoDaRefeicao`, porte de
  // simulador.py:335) — Citatti manda; abaixo de 27 min ele pegou uma parada, não a
  // refeição, e aí vale o SST. A escada estava redigitada aqui e agora sai de lá,
  // inclusive o rótulo da fonte.
  const almRef = almocoDaRefeicao(iv);
  const almSugIni = almRef.inicio || linha.almoco_saida_sug;
  const almSugFim = almRef.fim || linha.almoco_volta_sug;

  // Cartão do dia pelo motor: `removeFantasmas` colapsa a batida duplicada do coletor
  // (<= 6 min) e `bloqueioSimulacao` diz, na língua do DP, POR QUE este dia não dá pra
  // julgar (não bateu ponto, cartão com 1 batida, ponto ainda aberto).
  const diagnostico = useMemo(() => {
    const fonte = linha.todas_batidas || linha.batidas_limpas || "";
    const mins = batidasDoCartao(fonte);
    const { fora } = removeFantasmas(mins);
    return {
      fantasmas: fora.map(min2hm),
      motivo: bloqueioSimulacao(simulaCartao({ batidas: fonte }).notas),
    };
  }, [linha.todas_batidas, linha.batidas_limpas]);

  // O que a faixa da semana CONCLUI (app.js:957-963). `comPonto` conta os dias com
  // qualquer batida; `completos` os que têm 4 ou mais DEPOIS de tirar o fantasma.
  const resumoSemana = useMemo(() => {
    if (!semana?.length) return null;
    const hoje = semana.find((d) => d.hoje) || {};
    const comPonto = semana.filter((d) => d.n > 0).length;
    return {
      hoje,
      comPonto,
      completos: semana.filter((d) => d.n >= 4).length,
      comColada: semana.filter((d) => d.colados).length,
      // 6x1: o dia aberto está vazio e os outros seis têm ponto — a folga é este.
      folgaProvavel: !hoje.n && comPonto >= 6,
      // Os OUTROS dias, que é o que reforça o texto do pedido de exclusão
      // (app.js:4933-4934): contar este aqui faria o dia se auto-justificar.
      outrosCompletos: semana.filter((d) => d.n >= 4 && !d.hoje).length,
      outrosColados: semana.filter((d) => d.colados && !d.hoje).length,
    };
  }, [semana]);

  /* ---- A ROTA DA EXCLUSÃO (app.js:4927 `acaoDia`) ----
     AS BATIDAS PODEM NÃO ESTAR NA LINHA (app.js:4877): a linha da Gordura não traz
     `todas_batidas` — só as pontas —, e a conta dava ZERO marcações; o dia do MANOEL
     caía no ramo errado ("pedir registro") justamente onde era para excluir. Quando a
     linha vem sem cartão, vale o que a SEMANA leu da `ponto_diario` para este mesmo
     dia. A detecção em si é do módulo do comunicado, que por sua vez usa o
     `removeFantasmas` do motor — nenhuma régua nova nasce aqui.                     */
  const exclusao = useMemo(() => {
    const doDia = semana?.find((d) => d.hoje);
    const fonte =
      String(linha.todas_batidas ?? "").trim() ||
      String(linha.batidas_limpas ?? "").trim() ||
      String(doDia?.batidas ?? "").replace(/ · /g, " | ");
    return { ...assinaturaExclusao({ todas_batidas: fonte }), fonte };
  }, [linha.todas_batidas, linha.batidas_limpas, semana]);

  // PONTO INVERTIDO tem tratamento próprio e a rota não se oferece nele (app.js:4882:
  // `if (pontoInvertidoAtivo) return`). E dia já conferido pelo DP também não: pedir
  // exclusão de um dia que ele mesmo deu por certo seria mandar apagar a decisão.
  const cabeExclusao =
    exclusao.colada && !ehPontoInvertido(linha) && !pontoConferido(caso);

  // A linha que vai no comunicado: a mesma do cartão, com o `todas_batidas` que a
  // rota apurou (é ele que vira o {BATIDAS} da carta — o registro a ser apagado).
  const linhaExclusao = useMemo(
    () => ({ ...linha, date_ref: dia, todas_batidas: exclusao.fonte }),
    [linha, dia, exclusao.fonte],
  );

  // Quanto de almoço a jornada CRAVADA exige (main.py `_almoco_matriz`): < 4h nada,
  // 4h–6h 15 min, 6h+ 30 min. Vale a versão POR CATEGORIA, que é o porte literal: só
  // motorista entra na matriz — interno/aprendiz seguem o alvo de 60 min da view 4, e
  // dizer "30 min" pra eles seria régua errada. É informativo; quem decide é o DP.
  const almocoExigido = useMemo(() => {
    if (travado) return null;
    const jor = jornadaEntreMin(valores.entrada, valores.saida);
    if (jor == null) return null;
    return { exige: almocoMatrizPorCategoria(valores.entrada, valores.saida, linha.categoria), jornada: jor };
  }, [travado, valores.entrada, valores.saida, linha.categoria]);

  /* ═══════════════════════ GRAVAÇÃO ═══════════════════════
     Grava SÓ no clique. Depois de gravar, a linha é RELIDA do banco (`aoRecarregar`)
     em vez de a tela pintar o estado otimista — se o gateway recusou uma coluna, ou
     se um trigger mexeu no que foi gravado, a pessoa tem de ver o que ficou LÁ.
     `date_ref` nunca sai de `new Date()`: vem pronto da linha (`dia`). Os `*_em` são
     TIMESTAMP UTC, e aí `toISOString()` é o certo — é o mesmo do Python.            */

  const recarregar = useCallback(async () => {
    if (!aoRecarregar) return;
    try {
      await aoRecarregar(cracha, dia);
    } catch {
      /* a gravação já foi; falhar a releitura não desfaz nada — o botão Atualizar resolve */
    }
  }, [aoRecarregar, cracha, dia]);

  // main.py `salvar_real_manual` (~392). Tudo vazio APAGA a linha, igual ao Python.
  const salvarRealManual = async () => {
    setRecadoRm(null);
    // ALMOÇO TRAVADO (main.py:400-402): o servidor RECUSA o dia inteiro se o payload
    // trouxer almoço. A trava do cliente é esta — as duas pontas do miolo saem do jogo
    // ANTES de qualquer coisa: os campos continuam visíveis (o DP precisa ver o que
    // está lá, e vêm preenchidos com a sugestão), mas não são editáveis, não contam
    // para o "tudo vazio limpa" e não vão no payload. Coluna ausente no upsert não é
    // tocada, então o que já estiver gravado também não é apagado.
    const gravaveis = travado ? ["entrada", "saida"] : CAMPOS_RM;
    const { limpos, erro: falhaFormato } = normalizarRealManual(valores, gravaveis);
    if (!limpos) {
      setRecadoRm({ tipo: "erro", texto: falhaFormato });
      return;
    }
    const preenchidos = gravaveis.filter((k) => limpos[k]);
    setSalvando("rm");
    try {
      if (!preenchidos.length) {
        // "Tudo vazio limpa" — o mesmo caminho do `deletar_real_manual` do Python.
        await apagarDP360("ponto_real_manual", { cracha: `eq.${cra8(cracha)}`, date_ref: `eq.${dia}` });
        setRecadoRm({ tipo: "ok", texto: "Real manual apagado — o dia volta para a sugestão." });
      } else {
        const payload = {
          cracha: cra8(cracha),
          date_ref: dia,
          entrada: limpos.entrada || null,
          saida: limpos.saida || null,
          definido_por: quemEstaUsando(),
          definido_em: agoraUtc(),
        };
        if (!travado) {
          payload.alm_saida = limpos.alm_saida || null;
          payload.alm_volta = limpos.alm_volta || null;
        }
        await upsertDP360("ponto_real_manual", payload);
        setRecadoRm({ tipo: "ok", texto: "Real cravado." });
      }
      setForm(null);
      await recarregar();
    } catch (falha) {
      setRecadoRm({ tipo: "erro", texto: falha.message || "Não foi possível gravar o Real manual." });
    } finally {
      setSalvando("");
    }
  };

  const limparRealManual = async () => {
    setRecadoRm(null);
    setSalvando("rm-limpar");
    try {
      await apagarDP360("ponto_real_manual", { cracha: `eq.${cra8(cracha)}`, date_ref: `eq.${dia}` });
      setRecadoRm({ tipo: "ok", texto: "Real manual apagado — o dia volta para a sugestão." });
      setForm(null);
      await recarregar();
    } catch (falha) {
      setRecadoRm({ tipo: "erro", texto: falha.message || "Não foi possível apagar o Real manual." });
    } finally {
      setSalvando("");
    }
  };

  /* ═══════════════════ A LINHA DO TEMPO DO CASO ═══════════════════
     Porte de app.js:4655-4713 (`tlDefs`). Ela responde três perguntas que a versão
     curta não respondia (os três buracos que o DP apontou em 25/08): O QUE FOI
     FEITO, PARA QUAL HORÁRIO, e se a advertência veio de PEDIDO INCORRETO ou de
     VENCIMENTO DO PRAZO — a tela dizia as duas coisas do mesmo jeito ("Advertência"
     e a data) e quem abria o histórico não sabia qual dos dois caminhos foi.        */

  // O QUE ELE PEDIU, com VEREDITO POR AÇÃO. O julgamento é do MOTOR (`julgaAcoes`,
  // o mesmo da Ocorrências, validado 1:1 contra o Python) — nada de reescrever aqui
  // a régua de "bate / não bate". A duplicata vira "2×" em vez de repetir na tela.
  const acoesPedidas = useMemo(() => {
    if (!extra.pedidos.length) return [];
    return julgaAcoes({
      pedidos: extra.pedidos.map((o) => ({
        tipo: String(o.tipo_ajuste ?? "").trim(),
        hora: String(o.horario_ajuste ?? "").trim(),
        ajuste: String(o.horario_ajuste ?? "").trim(),
        id: String(o.id_ocorrencia ?? "").trim(),
      })),
      // O alvo do CASO é o congelado no aviso — é contra ele que o pedido é julgado.
      alvo: {
        entrada: caso?.alvo_entrada,
        saida: caso?.alvo_saida,
        almSaida: caso?.alvo_alm_saida,
        almVolta: caso?.alvo_alm_volta,
        origem: caso?.origem,
      },
      gordura: g,
      sugestao: {
        entrada_sug: linha.entrada_sug,
        saida_sug: linha.saida_sug,
        almoco_saida_sug: linha.almoco_saida_sug,
        almoco_volta_sug: linha.almoco_volta_sug,
      },
      escala: { entrada: linha.esc_entrada, saida: linha.esc_saida },
      // `cartao` aceita a linha do ponto_diario direto (lê `todas_batidas`).
      cartao: linha,
    });
  }, [extra.pedidos, g, caso, linha]);

  // A frase de uma linha: horário pedido + veredito, no formato do original.
  const textoPedido = useMemo(() => {
    if (!acoesPedidas.length) return "";
    const veredito = (a) =>
      a.redundante ? "já tinha" : a.ok === null ? "sem base" : a.ok ? "bate" : "não bate";
    // "D/ 09:19 P/ 08:30" (alteração) vira "09:19→08:30": é o que se lê num relance.
    const hora = (a) => {
      const m = /D\/\s*(\S+)\s*P\/\s*(\S+)/.exec(a.hora || "");
      return m ? `${m[1]}→${m[2]}` : a.hora || "";
    };
    return acoesPedidas.slice(0, 3).map((a) => ({
      tipo: String(a.tipo || "").slice(0, 3).toLowerCase(),
      hora: hora(a),
      n: a.n,
      veredito: veredito(a),
      ok: a.redundante ? false : a.ok,
    }));
  }, [acoesPedidas]);

  // NÃO RESPONDEU vs RESPONDEU ERRADO (app.js:4680-4683). `ajuste_ids` guarda as
  // ocorrências do ciclo com prefixo R:/A: — R é o que ele PEDIU, A é o que foi
  // advertido. Vencido = houve aviso e nada voltou.
  const idsR = String(caso?.ajuste_ids ?? "").split(",").filter((x) => x.trim().startsWith("R:")).length;
  const idsA = String(caso?.ajuste_ids ?? "").split(",").filter((x) => x.trim().startsWith("A:")).length;
  const respondeu = !!(acoesPedidas.length || idsR || idsA || (caso?.ajuste && caso.ajuste !== "nao_ajustou"));
  const houveAviso = !!String(caso?.aviso_enviado_em ?? "").trim();
  const venceu = !respondeu && houveAviso;
  const advertido = !!String(caso?.advertencia_enviada_em ?? "").trim();

  // PARA QUAL HORÁRIO FOI: o alvo CONGELADO no aviso (não o alvo de hoje). É o
  // horário que a pessoa recebeu, e é por ele que a correção lança.
  const alvoCongelado = [caso?.alvo_entrada, caso?.alvo_alm_saida, caso?.alvo_alm_volta, caso?.alvo_saida]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
  const gorduraCortada = parseInt(caso?.gordura_min, 10);

  const passos = [
    {
      icone: "📤",
      titulo: "Aviso enviado",
      quando: fmtDataHora(caso?.aviso_enviado_em),
      feito: houveAviso,
      nota: caso?.aviso_conferido_em ? `visto no app · ${fmtDataHora(caso.aviso_conferido_em)}` : "",
      // O BALÃO SEMPRE APARECE (app.js:4665): se já mandamos, mostra o que foi; se
      // não, a PRÉVIA do que vai sair. Sem isso a linha do tempo dizia "Aviso
      // enviado" e não dizia qual mensagem — o DP clicava no botão sem saber o texto
      // que o colaborador ia receber.
      balao: true,
    },
    {
      icone: venceu ? "⏰" : "✏️",
      titulo: venceu ? "Não respondeu" : textoPedido.length ? "Pedido do colaborador" : "Ajuste no app",
      quando: "",
      feito: !!(textoPedido.length || venceu || (caso?.ajuste && caso.ajuste !== "nao_ajustou")),
      alerta: venceu,
      nota: venceu
        ? "o prazo de 48 h venceu sem ajuste — por isso a advertência"
        : textoPedido.length
          ? ""
          : caso?.ajuste === "nao_ajustou"
            ? "não ajustou"
            : // O caso diz que ele respondeu mas o pedido não veio (leitura de
              // `ponto_ajustes_app` falhou, ou a ocorrência já foi arquivada): dizer
              // "não pediu nada" aqui seria mentira — o detalhe está na Ocorrências.
              respondeu
              ? `${idsR || idsA || "algum"} pedido(s) no ciclo — o detalhe está nas Ocorrências`
              : "não pediu nada neste dia",
      acoes: venceu ? [] : textoPedido,
      maisAcoes: acoesPedidas.length > 3 ? acoesPedidas.length - 3 : 0,
    },
    {
      icone: "⚖️",
      titulo: "Decisão do DP",
      quando: fmtDataHora(caso?.aceito_em),
      feito: !!(venceu || (caso?.aceite && caso.aceite !== "pendente")),
      nota: venceu
        ? "nada a decidir — vencido segue direto para advertir e corrigir"
        : caso?.aceite === "aceito"
          ? "aceitou — o ponto fica como ele pediu"
          : caso?.aceite === "rejeitado"
            ? houveAviso
              ? `recusou ${idsR ? `${idsR} pedido(s) ` : ""}— advertência e correção`
              : "recusou — o ponto continua como estava"
            : "",
    },
    {
      icone: advertido ? "⚠" : "✓",
      titulo: advertido ? "Advertência" : "Ponto OK",
      quando: fmtDataHora(caso?.advertencia_enviada_em || caso?.conferido_em),
      feito: !!(caso?.conferido_em || advertido),
      alerta: advertido,
      // A distinção que faltava: vencimento (não corrigiu no prazo) ≠ pedido incorreto.
      nota: advertido ? (venceu ? "motivo: não corrigiu no prazo" : "motivo: ajuste incorreto") : "",
    },
    {
      icone: "🔧",
      titulo: "Correção do ponto",
      quando: fmtDataHora(caso?.correcao_final_em),
      feito: !!String(caso?.correcao_final_em ?? "").trim(),
      nota: String(caso?.correcao_final_em ?? "").trim()
        ? (alvoCongelado.length ? `ponto lançado para ${alvoCongelado.join(" · ")}` : "lançado") +
          (gorduraCortada > 0 ? ` · ${fmtMin(gorduraCortada)} de gordura cortada` : "")
        : alvoCongelado.length
          ? `vai lançar ${alvoCongelado.join(" · ")}`
          : "",
    },
  ];
  // "agora" = o primeiro passo que ainda não aconteceu (app.js:4712).
  const passoAtual = passos.findIndex((p) => !p.feito);

  return (
    /* LAYOUT (queixa do dono: "dependendo da quantidade de batidas vai empurrando o
       pop-up para baixo"). O box é o DONO DA ROLAGEM — cabeçalho e rodapé ficam
       parados e só o corpo rola, com `max-height` em vez de crescer sem fim. E as
       duas colunas são independentes: `align-content: start` + `min-width: 0` no
       grid impedem que uma coluna comprida (o mapa, a lista de batidas) empurre a
       outra. Mesmo desenho do `gd-modal` do INOVE Guard, que já resolveu isto. */
    <div className="rv-overlay">
      <div className="rv-box dp-card" style={{ padding: 0 }}>
        <header
          className="flex items-start gap-3 rv-fixo"
          style={{ padding: "14px 18px", borderBottom: "1px solid var(--dp-border)" }}
        >
          <div
            className="flex shrink-0 items-center justify-center"
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: "var(--dp-accent-soft)",
              color: "var(--dp-accent)",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {String(linha.nm_funcionario ?? "")
              .trim()
              .split(/\s+/)
              .map((p) => p[0] || "")
              .filter((_, i, a) => i === 0 || i === a.length - 1)
              .join("")
              .toUpperCase() || "—"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate" style={{ fontWeight: 650, fontSize: 15 }}>
              {linha.nm_funcionario || "—"}
            </div>
            <div className="dp-muted flex flex-wrap items-center gap-2" style={{ fontSize: 12, marginTop: 1 }}>
              <span className="dp-num">Crachá {linha.cracha}</span>
              <span className="dp-num">· {fmtData(dia)}</span>
              {linha.nm_funcao && <span>· {linha.nm_funcao}</span>}
              {linha.categoria && <span>· {linha.categoria}</span>}
            </div>
          </div>
          {/* Pílulas da tela dona (Gordura: linha 99, reserva por GPS, status do caso). */}
          {selos}
          {!!extra.reserva && (
            <Pilula
              texto="🗓 reserva"
              tom="res"
              titulo="O gestor lançou reserva para este dia no Controle de Reservas — a anotação está no cartão."
            />
          )}
          <Pilula
            texto={linha.status_ponto || "—"}
            tom={String(linha.status_ponto ?? "").toUpperCase() === "OK" ? "ok" : "warn"}
          />
          <button type="button" onClick={aoFechar} className="dp-btn" aria-label="Fechar">
            <X size={14} />
          </button>
        </header>

        <div className="rv-corpo">
        <div style={{ display: "grid", gap: 8, padding: "12px 18px 0" }}>
          <AvisoTrava motivo={bloqueio} />
          {erro && (
            <div className="dp-card">
              <span className="dp-pill danger">{erro}</span>
            </div>
          )}
          {/* A ANOTAÇÃO DO GESTOR fica em faixa, antes das colunas: é fato do DIA
              INTEIRO (muda a operação real, a gordura e a régua do GPS) e o dono
              reclamou justamente que ela "não estava vindo do controle de reserva". */}
          <BlocoReserva reserva={extra.reserva} />

          {/* A SEMANA vem ANTES das colunas, e antes de qualquer número do dia: ela é o
              contexto que decide se o dia sequer devia ter ponto. Enfiada numa coluna,
              ficaria abaixo da dobra num cartão com muitas batidas — e a trava contra
              inserir ponto em dia de folga só serve se for a primeira coisa que se vê. */}
          <FaixaSemana
            semana={semana}
            resumo={resumoSemana}
            carregando={semana === null}
            erro={erroSemana}
          />

          {/* QUAL PEDIDO ESTE DIA MERECE (app.js:4927). Só aparece quando o dia tem a
              assinatura do coletor; nos outros formatos o pedido é o da aba (📣 no
              rodapé), e esta faixa fica fora do caminho. */}
          {cabeExclusao && (
            <div className="dp-card cd-acao">
              <div className="cd-acao-t">
                <b>
                  {exclusao.marcacoes} marcação(ões) em {exclusao.span == null ? 0 : exclusao.span} min
                </b>{" "}
                — não é jornada, é a mesma leitura do coletor repetida.
                {!!resumoSemana?.outrosCompletos && (
                  <>
                    {" "}
                    A semana tem <b>{resumoSemana.outrosCompletos} dia(s) completo(s)</b>.
                  </>
                )}
                {!!resumoSemana?.outrosColados && (
                  <>
                    {" "}
                    <b className="cd-rj">
                      Atenção: mais {resumoSemana.outrosColados} dia(s) da semana também têm batida colada
                    </b>{" "}
                    — vale olhar o crachá ou o relógio.
                  </>
                )}{" "}
                O pedido certo é <b>excluir</b> a batida — pedir que ele registre o ponto cobra uma
                jornada que não existiu.
              </div>
              <button
                type="button"
                className="dp-btn primary"
                onClick={() => setPedirExclusao(true)}
                title="Abre o comunicado deste dia com o modelo template_pedir_exclusao: prévia do texto e os dois botões (Ensaio · Enviar de verdade)."
              >
                🗑 Pedir exclusão desta batida
              </button>
            </div>
          )}
        </div>

        <div className="rv-colunas" style={{ padding: 18 }}>
          {/* ---------- coluna 1: fontes, sugestão, real ---------- */}
          <div style={{ display: "grid", gap: 16, alignContent: "start", minWidth: 0 }}>
            <section>
              <TituloBloco nota="de onde vêm os números — nenhuma delas é decisão">1 · Fontes</TituloBloco>
              <div className="dp-card" style={{ padding: "6px 14px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr className="dp-faint" style={{ textAlign: "left", fontSize: 11 }}>
                    <th style={{ padding: "6px 0", fontWeight: 700 }}>Fonte</th>
                    <th style={{ padding: "6px 0", textAlign: "right", fontWeight: 700 }}>Entrada</th>
                    <th style={{ padding: "6px 0", textAlign: "right", fontWeight: 700 }}>Saída</th>
                    <th style={{ padding: "6px 0", textAlign: "right", fontWeight: 700 }}>Jornada</th>
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
                  {/* A reserva lançada é FONTE: ela alarga a operação real (união
                      reserva ∪ operação). Some sozinha quando não há lançamento. */}
                  <LinhaFonte
                    rotulo="Reserva (INOVE)"
                    ini={extra.reserva?.hora_entrada}
                    fim={extra.reserva?.hora_saida}
                    cor="var(--dp-res-ink)"
                    titulo="Reserva lançada pelo gestor no INOVE — período em que ele ficou à disposição."
                  />
                  {/* A LINHA DO CITATTI VIRA BOTÃO (app.js:4602-4605): é a operação dele
                      que fica estranha na dupla pegada, e as viagens são a explicação.
                      Clicar abre linha, tabela, veículo e os intervalos entre as pegadas
                      sem sair do caso. */}
                  <LinhaFonte
                    rotulo={
                      <>
                        Citatti{" "}
                        <button
                          type="button"
                          className="rv-vg"
                          onClick={() => setVerViagens(true)}
                          title="Ver as viagens do dia: linha, tabela, atividade, veículo e os intervalos entre as pegadas."
                        >
                          🚌 viagens
                        </button>
                      </>
                    }
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
              </div>
              {carregando && <p className="dp-faint" style={{ margin: "6px 0 0" }}>Carregando fontes…</p>}
              {/* POR QUE NÃO HÁ FONTE — e a resposta não é sempre a mesma (09/09/2026).
                  A frase acusava "interno/aprendiz" em TODO dia sem fonte, e o dono estranhou
                  com razão num MOTORISTA: a própria linha do dia dizia `teve_operacao = true`.
                  O que falta ali não é operação, é a APURAÇÃO — `ponto_gordura` não tem linha
                  para o dia (`tem_gordura = false`), o que acontece quando o ponto do dia
                  ainda não foi importado (`tem_ponto = false`). Agora a linha do dia responde. */}
              {!carregando && !g.op_inicio && !g.sst_vinculo && !g.val_inicio && (
                <p className="dp-faint" style={{ margin: "6px 0 0" }}>
                  {ehVerdadeiro(linha.teve_operacao) ? (
                    <>
                      Este dia <b>teve operação</b> (a linha do dia marca <span className="dp-mono">teve_operacao</span>),
                      mas ela ainda <b>não foi apurada</b>: não há linha em <span className="dp-mono">ponto_gordura</span>
                      {ehVerdadeiro(linha.tem_ponto) ? "" : " — e o ponto deste dia também não foi importado"}.
                      Sem apuração não há Citatti, SST nem bilhetagem para mostrar aqui.
                    </>
                  ) : String(linha.categoria ?? "").toUpperCase() === "MOTORISTA" ? (
                    "Sem operação apurada neste dia."
                  ) : (
                    "Sem operação apurada neste dia (interno/aprendiz não tem Citatti, SST nem bilhetagem)."
                  )}
                </p>
              )}
            </section>

            <section>
              <TituloBloco nota="o que a ferramenta propõe — ainda não é lançamento">2 · Sugestão</TituloBloco>
              <div className="dp-card" style={{ display: "grid", gap: 7 }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="dp-muted" style={ESTILO_ROTULO}>Operação real</span>
                  <span className="dp-num dp-mono" style={{ fontWeight: 600 }}>
                    {fmtHora(g.real_inicio) || "—"} → {fmtHora(g.real_fim) || "—"}
                  </span>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <span
                    className="dp-muted"
                    style={ESTILO_ROTULO}
                    title={`Alvo = operação real com tolerância: entrada −${TOL_ENTRADA_MIN} min, saída +${TOL_SAIDA_MIN} min.`}
                  >
                    Alvo (tol. {TOL_ENTRADA_MIN}/{TOL_SAIDA_MIN})
                  </span>
                  <Cartao4 valores={alvo4} />
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <span className="dp-muted" style={ESTILO_ROTULO}>Ponto sugerido</span>
                  {bloqueio ? (
                    <span className="dp-pill warn">⚠ sugestão inválida</span>
                  ) : (
                    <Cartao4 valores={sug4} tom="done" />
                  )}
                </div>
                <div
                  className="dp-faint flex flex-wrap gap-x-4 gap-y-1"
                  style={{ borderTop: "1px solid var(--dp-border)", paddingTop: 7, fontSize: 11.5 }}
                >
                  <span>Fonte do alvo: {linha.fonte_alvo || "—"}</span>
                  <span>Fonte SUG: {linha.sugestao_fonte || "—"}</span>
                  <span>Ação: {linha.acao_sugerida || "—"}</span>
                  <span>Alvo confiável: {ehVerdadeiro(linha.alvo_confiavel) ? "sim" : "não"}</span>
                </div>
              </div>
            </section>

            <section>
              <TituloBloco nota="o que ele bateu">3 · Real</TituloBloco>
              <div className="dp-card" style={{ display: "grid", gap: 7 }}>
                <div className="flex flex-wrap items-start gap-2">
                  <span className="dp-muted" style={ESTILO_ROTULO}>Ponto (bateu)</span>
                  <Cartao4 valores={real4} />
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <span className="dp-muted" style={ESTILO_ROTULO}>Todas as batidas</span>
                  <span className="dp-num dp-mono">{linha.todas_batidas || "—"}</span>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <span className="dp-muted" style={ESTILO_ROTULO}>Batidas limpas</span>
                  <span className="dp-num dp-mono">{linha.batidas_limpas || "—"}</span>
                  {!!diagnostico.fantasmas.length && (
                    <span
                      className="dp-pill mute"
                      title="Batidas a 6 min ou menos uma da outra são o MESMO evento registrado duas vezes (bug do coletor). O motor fica com a última."
                    >
                      👻 {diagnostico.fantasmas.join(" · ")}
                    </span>
                  )}
                </div>
                {!!diagnostico.motivo && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="dp-muted" style={ESTILO_ROTULO}>Dá para julgar?</span>
                    <span
                      className="dp-pill warn"
                      title="Veredito do motor (bloqueioSimulacao): sem cartão utilizável, nem a régua automática nem o aviso valem — o DP tem de cravar o Real na mão."
                    >
                      ⚠ {diagnostico.motivo}
                    </span>
                  </div>
                )}
              </div>
            </section>

            <section>
              <TituloBloco nota="crava e vira a régua do veredito e o alvo da correção">
                4 · Real manual do DP
              </TituloBloco>
              <div className="dp-card">
                <p className="dp-muted" style={{ margin: 0, fontSize: 11.5 }}>
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
                    ["Entrada", "entrada", false],
                    ["Saída almoço", "alm_saida", travado],
                    ["Volta almoço", "alm_volta", travado],
                    ["Saída", "saida", false],
                  ].map(([rot, campo, cadeado]) => (
                    <label key={campo} className="block">
                      <span
                        className="dp-muted flex items-center gap-1"
                        style={{ ...ESTILO_TITULO, margin: 0, fontSize: 10 }}
                      >
                        {rot}
                        {cadeado && <Lock size={10} />}
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        readOnly={cadeado}
                        disabled={cadeado || salvando === "rm"}
                        value={valores[campo] || ""}
                        onChange={(e) => mudarCampo(campo, e.target.value)}
                        placeholder="HH:MM"
                        title={
                          cadeado
                            ? "Almoço travado pela regra da Revisão — não entra na gravação."
                            : "HH:MM (aceita 25:40 para o turno que vira o dia). Vazio nas quatro pontas apaga o Real manual."
                        }
                        style={cadeado ? ESTILO_INPUT_TRAVADO : ESTILO_INPUT}
                      />
                    </label>
                  ))}
                </div>
                {!!almocoExigido && almocoExigido.exige > 0 && (
                  <p className="dp-faint" style={{ margin: "6px 0 0", fontSize: 11.5 }}>
                    Jornada de {Math.floor(almocoExigido.jornada / 60)}h
                    {String(almocoExigido.jornada % 60).padStart(2, "0")}: a matriz da Revisão pede{" "}
                    <b>{almocoExigido.exige} min</b> de almoço. Quem decide é você — isto é só a régua.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="dp-btn primary"
                    disabled={salvando === "rm" || salvando === "rm-limpar"}
                    onClick={salvarRealManual}
                    title="Grava em ponto_real_manual. Com as quatro pontas vazias, apaga o Real deste dia."
                  >
                    {salvando === "rm" ? "gravando…" : "✓ Salvar Real"}
                  </button>
                  <button
                    type="button"
                    className="dp-btn"
                    disabled={salvando === "rm" || salvando === "rm-limpar" || !(linha.rm_entrada || linha.rm_saida || linha.rm_alm_saida || linha.rm_alm_volta)}
                    onClick={limparRealManual}
                    title="Apaga a linha de ponto_real_manual deste crachá/dia — o dia volta para a sugestão."
                  >
                    {salvando === "rm-limpar" ? "apagando…" : "Limpar"}
                  </button>
                  <Recado recado={recadoRm} />
                </div>
              </div>
            </section>
          </div>

          {/* ---------- coluna 2: o bloco da tela, almoço e GPS ---------- */}
          <div style={{ display: "grid", gap: 16, alignContent: "start", minWidth: 0 }}>
            {blocoLateral}

            <section>
              <h3 className="dp-muted flex items-center gap-2" style={ESTILO_TITULO}>
                Almoço
                {travado && (
                  <span
                    className="dp-pill mute"
                    title="Miolo travado pela regra da Revisão — não é editável."
                    style={{ textTransform: "none", letterSpacing: 0 }}
                  >
                    <Lock size={10} /> travado
                  </span>
                )}
              </h3>
              <div className="grid gap-2 sm:grid-cols-3">
                <BlocoAlmoco titulo="Batido (ponto)" ini={linha.saida_almoco} fim={linha.volta_almoco} />
                <BlocoAlmoco
                  titulo="Programado (escala)"
                  ini={iv.programado_inicio}
                  fim={iv.programado_fim}
                />
                <BlocoAlmoco
                  titulo={`Sugestão${almRef.origem ? ` · ${almRef.origem}` : ""}`}
                  ini={almSugIni}
                  fim={almSugFim}
                  travado={travado}
                  tom="sug"
                />
              </div>
              <div className="dp-faint mt-2 flex flex-wrap gap-x-4 gap-y-1" style={{ fontSize: 11.5 }}>
                {!!almRef.detalhe && <span title="Regra dos 27 min (simulador.py:335)">{almRef.detalhe}</span>}
                <span>Fonte do almoço: {linha.fonte_almoco || "—"}</span>
                <span>Faixa: {linha.almoco_faixa || "—"}</span>
                <span>Confiável: {ehVerdadeiro(linha.almoco_confiavel) ? "sim" : "não"}</span>
              </div>
            </section>

            <section>
              <TituloBloco>📍 Local da batida (GPS do app)</TituloBloco>
              {!gpsEfetivo || !gpsEfetivo.total ? (
                <p className="dp-faint" style={{ margin: 0 }}>
                  {carregando && !semGpsProprio ? "Carregando o GPS deste dia…" : "Sem GPS registrado neste dia."}
                </p>
              ) : (
                /* MUITAS BATIDAS NÃO PODEM EMPURRAR O RESTO (queixa do dono): a lista
                   é dona da própria rolagem a partir de umas 8 linhas, em vez de
                   esticar a coluna e jogar o mapa e o rodapé para fora da tela. */
                <ul
                  className="dp-card rv-rolante"
                  style={{ listStyle: "none", margin: 0, padding: 8, display: "grid", gap: 3 }}
                >
                  {gpsEfetivo.detalhes.map((d, i) => (
                    <li
                      key={`${d.hora}-${i}`}
                      className="flex items-center justify-between"
                      style={{
                        padding: "5px 8px",
                        borderRadius: 8,
                        fontSize: 12,
                        ...(d.fora === null
                          ? { background: "var(--dp-surface-2)", color: "var(--dp-muted)" }
                          : d.fora
                            ? { background: "var(--dp-danger-bg)", color: "var(--dp-danger-ink)" }
                            : { background: "var(--dp-ok-bg)", color: "var(--dp-ok-ink)" }),
                      }}
                      title={
                        d.fora === null
                          ? "Não medido: a âncora do veículo veio sem coordenada — não dá para calcular distância. Não conta como junto."
                          : d.fonte === "RESERVA"
                            ? "Dia de reserva: sem carro atribuído, a batida em local conhecido vale por si."
                            : `${d.papel || "—"} · ${d.fonte || "sem fonte"}${d.horaVeiculo ? ` · veículo às ${d.horaVeiculo}` : ""}`
                      }
                    >
                      <span className="dp-num dp-mono" style={{ fontWeight: 600 }}>{d.hora || "—"}</span>
                      <span className="truncate" style={{ padding: "0 8px", fontSize: 11.5, opacity: 0.85 }}>
                        {referenciaGps(d)}
                      </span>
                      <span className="dp-num" style={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                        {d.fora === null ? "não medido" : `${d.fora ? "fora" : "junto"} · ${fmtDist(d.distancia)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {!!gpsEfetivo?.naoMedido && (
                <p className="dp-faint" style={{ margin: "6px 0 0", fontSize: 11.5 }}>
                  {gpsEfetivo.naoMedido} batida(s) não medida(s): a posição operacional do veículo veio só com o
                  nome do terminal, sem coordenada. Não vira "junto" nem "fora".
                </p>
              )}
              {/* O MAPA vem DEPOIS da lista de propósito: a lista dá o veredito
                  ("fora · 2,1 km"), o mapa mostra ONDE. As cercas desenhadas são
                  a mesma régua de `regrasGps` — nada é recalculado aqui. */}
              {!!gpsEfetivo?.total && (
                <div style={{ marginTop: 8 }}>
                  <MapaBatidas
                    batidas={gpsEfetivo.batidas}
                    ancoras={gpsEfetivo.ancoras}
                    resultadoRegua={gpsEfetivo.detalhes}
                    nome={linha.nm_funcionario || ""}
                    altura={300}
                  />
                </div>
              )}
              <p className="dp-faint" style={{ margin: "6px 0 0", fontSize: 11 }}>
                Mais de {RAIO_VEIC} m da posição do veículo é "fora"; sem veículo, vale o local conhecido
                até {RAIO_LOCAL} m.
              </p>
            </section>
          </div>

          {/* ---------- coluna 3: a LINHA DO TEMPO ----------
              Coluna própria, altura inteira, à direita — onde o dono marcou. Já foi
              faixa no pé do pop-up: com o cartão comprido a linha do tempo ficava
              abaixo da dobra e ninguém via a mensagem que o colaborador recebeu.
              Numa coluna ela acompanha o cartão desde o topo, e o balão continua
              largo o bastante para o texto não quebrar em palavra por linha. */}
          <section className="rv-tl-col">
          <TituloBloco nota="o que já aconteceu com este dia — e o que a pessoa recebeu">
            Linha do tempo do caso
          </TituloBloco>
          <ol className="dp-card rv-tl">
            {passos.map((p, i) => (
              <li
                key={p.titulo}
                className={`rv-tl-passo${p.feito ? " feito" : ""}${i === passoAtual ? " agora" : ""}${
                  p.alerta && p.feito ? " alerta" : ""
                }`}
              >
                <span className="rv-tl-marca">{p.feito ? p.icone : i === passoAtual ? "•" : ""}</span>
                <div className="rv-tl-conteudo">
                  <div className="rv-tl-titulo">
                    {p.titulo}
                    {p.quando && <time className="dp-muted dp-num">{p.quando}</time>}
                  </div>

                  {/* O QUE ELE PEDIU, com veredito por ação (não por dia): é o que
                      permite ler um caso MISTO sem achar que foi tudo recusado. */}
                  {!!p.acoes?.length && (
                    <div className="rv-tl-acoes">
                      {p.acoes.map((a, j) => (
                        <span
                          key={`${a.tipo}-${a.hora}-${j}`}
                          className={`rv-acao${a.ok === true ? " ok" : a.ok === false ? " nao" : ""}`}
                        >
                          {a.tipo} <b className="dp-num dp-mono">{a.hora}</b>
                          {a.n > 1 ? ` ${a.n}×` : ""} <i>({a.veredito})</i>
                        </span>
                      ))}
                      {p.maisAcoes > 0 && <span className="dp-faint">+{p.maisAcoes}</span>}
                    </div>
                  )}

                  {p.nota && <div className="rv-tl-nota">{p.nota}</div>}

                  {/* O BALÃO. Se já mandamos, é o que saiu; se não, a prévia do que
                      vai sair — o DP não clica mais no botão sem saber o texto. */}
                  {p.balao && !!mensagemAviso && (
                    <div className="rv-balao">
                      <span className="rv-balao-lb">
                        {houveAviso ? "o que mandamos" : `prévia — ${previaAviso?.rotulo || "o que vai sair"}`}
                      </span>
                      {mensagemAviso}
                    </div>
                  )}
                  {p.balao && !mensagemAviso && !houveAviso && (
                    <div className="rv-tl-nota">
                      {impedimentoAviso || "Nada a pedir por aqui — não há mensagem para este dia."}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {!!extra.ajustes.length && (
            <p className="dp-faint" style={{ margin: "6px 0 0", fontSize: 11.5 }}>
              {extra.ajustes.length} edição(ões) registrada(s) em ponto_ajustes para este dia.
            </p>
          )}
          </section>
        </div>

        </div>

        <footer
          className="flex flex-wrap items-center justify-between gap-3 rv-fixo"
          style={{
            padding: "12px 18px",
            borderTop: "1px solid var(--dp-border)",
            background: "var(--dp-surface-2)",
            borderRadius: "0 0 var(--dp-radius) var(--dp-radius)",
          }}
        >
          <p className="dp-muted" style={{ margin: 0, fontSize: 11.5 }}>
            {rodapeInfo || (
              <>
                Real manual fica na base do DP e pode ser desfeito. <b>Enviar ocorrência</b> fala com o
                trabalhador: abre o comunicado deste dia, com Ensaio e envio de verdade.
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {/* Os botões de DECISÃO são da tela dona (a Revisão pendura aqui o
                ✓ Ponto conferido, que é dela). */}
            {acoesRodape}
            {/* O aviso deste DIA, para esta PESSOA. Quem monta o CSV, decide os barrados
                e grava `ponto_caso` (com o alvo congelado, nunca reescrito por um segundo
                aviso) é o `ModalComunicado` da aba — aqui só se escolhe o escopo de uma
                linha. Recusar ≠ advertir: a advertência só existe depois de um aviso que
                ele não atendeu, e ela não sai desta tela. */}
            {aoAvisar &&
              (impedimentoAviso ? (
                <BotaoSemAlvo titulo={impedimentoAviso}>📣 Enviar ocorrência</BotaoSemAlvo>
              ) : (
                <button
                  type="button"
                  className="dp-btn"
                  onClick={() => aoAvisar(linha)}
                  title="Abre o comunicado deste dia: prévia do texto, quem recebe e os dois botões (Ensaio · Enviar de verdade)."
                >
                  📣 Enviar ocorrência
                </button>
              ))}
            <button type="button" onClick={aoFechar} className="dp-btn">
              Fechar
            </button>
          </div>
        </footer>
      </div>

      {/* As viagens ficam POR CIMA do cartão em vez de fechá-lo: quem clicou no
          Citatti continua vendo o dia que está lendo. */}
      {verViagens && (
        <ModalViagens
          cracha={cracha}
          nome={linha.nm_funcionario || ""}
          dia={dia}
          aoFechar={() => setVerViagens(false)}
        />
      )}

      {/* O pedido de exclusão também abre POR CIMA: quem vai mandar apagar uma batida
          precisa continuar vendo a semana que justifica o pedido. */}
      {pedirExclusao && (
        <ModalPedirExclusao
          linha={linhaExclusao}
          caso={caso}
          aoFechar={() => setPedirExclusao(false)}
          aoConcluir={recarregar}
        />
      )}
    </div>
  );
}
