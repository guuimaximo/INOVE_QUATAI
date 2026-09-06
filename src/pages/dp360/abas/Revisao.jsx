import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, MapPin, RefreshCw, X } from "lucide-react";
import AbaShell from "./AbaShell";
import TabelaDP from "../TabelaDP";
import MapaBatidas from "../MapaBatidas";
import {
  apagarDP360,
  dispararRoboDP360,
  lerDP360,
  lerTudoDP360,
  upsertDP360,
} from "../../../services/dp360Api";
import { supabase } from "../../../supabase";
import { getStoredUser } from "../../../utils/auth";
import { RAIO_LOCAL, RAIO_VEIC, reguaLocal, resumoGps } from "../regrasGps";
import { COLUNAS_INDICE_DATAS, datasComPonto } from "../regrasDia";
import {
  MOTIVO_AVISO,
  TIPO,
  chaveTemplate,
  contratoDaRevisao,
  escolherTemplate,
  marcarReavisos,
  medianasJornada,
  mensagemBateuFora,
  mensagemInterno,
  mensagemRevisaoMotorista,
  prepararComunicado,
  rotaAvisoInterno,
  variaveisPendentes,
} from "../comunicadoTransnet";
import {
  CONSTANTES,
  almocoDaRefeicao,
  almocoMatrizPorCategoria,
  batidasDoCartao,
  bloqueioSimulacao,
  difRelogio,
  hm2min,
  jornadaEntreMin,
  min2hm,
  removeFantasmas,
  simulaCartao,
} from "../regrasPonto";

/* =============================================================================
   Revisão (Passo 2) — porte da tela do DP360 (Sistemas/PONTO: app/ui/app.js
   `viewP2`/`COLS_REV`/`p2RowClass`/`fmtCol`/`pontoDetalhe`).

   O QUE ESTA TELA GRAVA (liberado pelo dono):
     · Real manual do DP  -> `ponto_real_manual` (upsert; tudo vazio APAGA a linha,
       igual a main.py `salvar_real_manual` ~392);
     · Ponto conferido    -> `ponto_caso` com tipo='ponto_ok' (upsert), e o desfazer
       grava tipo='' / aceite='pendente' (main.py `marcar_ponto_ok` ~415).
     · Aviso ao trabalhador -> CSV do comunicado disparado no robô do Transnet
       (`dispararRoboDP360("comunicado", …)`) e, quando o envio é o de verdade,
       `ponto_caso` com o alvo CONGELADO. O formato do CSV, os barrados, os casos
       e os reavisos moram em `../comunicadoTransnet` (porte de main.py
       `_escrever_comunicados` ~2340 e `enviar_aviso_interno` ~2646), porque a
       Gordura manda o MESMO arquivo pelo MESMO robô.

   O AVISO SAI DAQUI, MAS QUEM DIRIGE O TRANSNET É O ROBÔ. O navegador não fala
   com o Transnet: o Selenium (`bot_comunicado.py`) roda no GitHub Actions do repo
   DP360, onde a credencial já é secret. Esta tela DECIDE e dispara; e são sempre
   DOIS BOTÕES — Ensaio (o robô anexa o arquivo e não confirma) e Enviar de verdade
   —, nunca um checkbox "confirmar", que marcado por engano manda comunicado real
   para a ficha de alguém.

   A REGRA DE NEGÓCIO NÃO MORA AQUI. `status_ponto`, `motivo`, `acao_sugerida`,
   `alvo_*`, `*_sug`, `almoco_*`, `pede_entrada/pede_saida`, `requer_alvo_manual`,
   `fonte_alvo` e `alvo_confiavel` já vêm calculados pela view do Athena
   (importador_supabase/sql_catalogo/3_vw_ponto_revisao_motorista.sql) e chegam
   prontos na `ponto_diario`. Esta tela só EXIBE.

   As contas de HORÁRIO são do MOTOR (`../regrasPonto`), porte validado 1:1 contra
   o Python (2.240 execuções, veredito idêntico). Nada de aritmética de relógio
   escrita à mão aqui: `hm2min`/`min2hm` (parse/formata, inclusive 25:40),
   `jornadaEntreMin` (virada de meia-noite), `difRelogio` (distância circular com
   o módulo que a versão ingênua esquecia), `almocoDaRefeicao` (regra dos 27 min),
   `almocoMatriz` (quanto de almoço a jornada exige), `removeFantasmas` (batida
   duplicada do coletor) e `bloqueioSimulacao` (por que o dia não dá pra julgar).
   O único cálculo local é o de GPS ("bateu fora"), que mora em `../regrasGps`.
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

// A régua de GPS (LOCAIS, raios, Haversine, reserva, "não medido") mora em
// ../regrasGps.js — porte de main.py `_regua_local`. Não duplicar aqui.

const CATEGORIAS_PADRAO = ["MOTORISTA", "INTERNO", "APRENDIZ"];
const PAGINAS_POR_LOTE = 6; // 6 × 1000 linhas de ponto_diario ≈ 15 dias de datas

// Quantos nomes a confirmação lista antes de resumir o resto. A pessoa precisa
// reconhecer QUEM vai receber; uma lista de 80 linhas num window.confirm não é lida.
const NOMES_NA_CONFIRMACAO = 8;

/** Quem está cravando. Porte de main.py `_quem_esta_usando` (lá é a conta do Windows;
 *  aqui o INOVE tem login de verdade, então vale o usuário da sessão). */
function quemEstaUsando() {
  const u = getStoredUser();
  return String(u?.nome_completo || u?.nome || u?.login || u?.email || "").trim();
}

/** Carimbo UTC dos campos `*_em`. São TIMESTAMP, não data local — é exatamente o
 *  `datetime.now(timezone.utc).isoformat()` do Python. (O `date_ref`, esse sim data
 *  local, NUNCA sai de `new Date()`: vem pronto da linha do banco.) */
const agoraUtc = () => new Date().toISOString();

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

// `hm2m` local morreu: era um parse de HH:MM feito à mão, mais pobre que o do motor
// (o dele lê "1420" sem dois-pontos, que é o que a tela do Cartão de Ponto devolve, e
// preserva a notação >24h). Todo mundo aqui usa `hm2min` de ../regrasPonto.

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

// Jornada entre duas pontas, com desconto opcional do almoço. A virada de meia-noite
// é do motor (`jornadaEntreMin`); aqui só sobrou a FORMATAÇÃO "10h09".
function durHM(ini, fim, descontar = 0) {
  const bruta = jornadaEntreMin(ini, fim);
  if (bruta == null) return "—";
  const liq = bruta - (descontar || 0);
  if (liq <= 0) return "—";
  return `${Math.floor(liq / 60)}h${String(liq % 60).padStart(2, "0")}`;
}

// `difCircularMin` local morreu: era `min(d, 1440-d)` SEM o módulo, e o motor documenta
// que essa versão devolve NEGATIVO quando a diferença passa de 24h (notação 25:14 do
// cartão) — o caso RONALDO, em que "-14 <= 10" dava BATE numa divergência de 14 min.
// Quem faz distância de relógio agora é `difRelogio` (main.py:6439).

/* ---------- GPS: batida fora de lugar ---------- */
// A conta em si é do módulo `../regrasGps` (porte de main.py `_regua_local`,
// linhas 191-299). Aqui ficou só o que é de TELA.


/**
 * Roda a régua completa de um crachá/dia e devolve o pacote que a grade e o
 * pop-up consomem: o resumo (total/fora/naoMedido/maiorDistancia) + a lista
 * batida a batida.
 *
 * `batidas` e `ancoras` viajam junto SEM SEREM ALTERADAS: o mapa do pop-up
 * (`MapaBatidas`) precisa da COORDENADA do veículo, que a régua usa por dentro
 * mas não devolve em `detalhes`. Nenhum cálculo muda por causa disso.
 */
function calcularGps({ batidas, ancoras, ehReserva, opIni, opFim }) {
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
// row-ok verde OK · row-sug âmbar ponto invertido · row-msg azul falta marcação
// identificada · row-sug âmbar sugestão utilizável · row-sem vermelho sem
// sugestão e sem ponta identificada. As classes são as da ferramenta original.
function classeLinha(r, bloqueio) {
  if (String(r.status_ponto ?? "").toUpperCase() === "OK") return "row-ok";
  if (ehPontoInvertido(r)) return "row-sug";
  if (marcacaoAusente(r)) return "row-msg";
  if (temSugestaoUtil(r, bloqueio)) return "row-sug";
  return "row-sem";
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
// Pílula da ferramenta original: `dp-pill` + tom (ok/warn/danger/accent/mute).
function Pilula({ texto, tom = "mute", titulo }) {
  return (
    <span title={titulo} className={`dp-pill ${tom}`}>
      {texto}
    </span>
  );
}

/** Botão que existe mas não tem o que fazer agora: fica visível (some da tela =
 *  "sumiu a função") e o title diz POR QUE está apagado. */
function BotaoSemAlvo({ children, titulo, className = "" }) {
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
const ESTILO_TITULO = {
  margin: "0 0 6px",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

function TituloBloco({ children, nota }) {
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

// Quadradinho da legenda de cores da linha.
const ESTILO_LEGENDA = { width: 12, height: 12, borderRadius: 3, display: "inline-block" };

// Rótulo da coluna esquerda dos blocos do pop-up.
const ESTILO_ROTULO = { width: 118, flex: "none", fontWeight: 600, fontSize: 12 };

// Campo do Real manual — mesma paleta da ferramenta.
const ESTILO_INPUT = {
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

// Coluna "Avisado?" — porte de app.js `fmtCol("rv_enviado")`. O aviso da Revisão
// já era gravado em ponto_caso, mas a tela antiga nunca mostrou: não dava pra
// saber se o colaborador já tinha recebido a mensagem.
// O ESTADO é calculado fora do componente porque a grade precisa dele DUAS vezes:
// como pílula (`render`) e como texto ordenável/exportável (`valor` da coluna).
function estadoAviso(caso) {
  const enviado = String(caso?.aviso_enviado_em ?? "").trim();
  if (!enviado) return { texto: "não", tom: "mute", titulo: "Nenhum aviso registrado para este dia" };
  const quando = fmtData(enviado.slice(0, 10));
  if (String(caso.correcao_final_em ?? "").trim())
    return { texto: "🔧 corrigido", tom: "ok", titulo: `Aviso em ${quando} — ponto já corrigido` };
  if (String(caso.advertencia_enviada_em ?? "").trim())
    return { texto: "⚠ advertido", tom: "danger", titulo: `Aviso em ${quando} — depois virou advertência` };
  if (String(caso.aceite ?? "").trim() === "aceito")
    return { texto: "✓ resolvido", tom: "ok", titulo: `Aviso em ${quando} — ele ajustou e você aceitou` };
  const visto = String(caso.aviso_conferido_em ?? "").trim();
  if (visto)
    return {
      texto: `👁 leu · ${quando}`,
      tom: "mute",
      titulo: `Enviado em ${quando} · aberto no app em ${fmtData(visto.slice(0, 10))}`,
    };
  return { texto: `📤 ${quando}`, tom: "warn", titulo: `Enviado em ${quando} — ainda não abriu no app` };
}

function Avisado({ caso }) {
  const { texto, tom, titulo } = estadoAviso(caso);
  return <Pilula texto={texto} tom={tom} titulo={titulo} />;
}

/** Este dia já foi marcado como conferido pelo DP? (main.py `get_pontos_ok`) */
const pontoConferido = (caso) => String(caso?.tipo ?? "").trim() === "ponto_ok";

// Versão TEXTO do mesmo veredito, para ordenar e exportar a coluna 📍 (a grade ordena
// pelo `valor`, nunca pelo JSX). Os três baldes começam com letras que já ordenam do
// pior pro melhor em pt-BR: fora < junto < não medido.
function textoGps(gps) {
  if (!gps || !gps.total) return "";
  const nm = gps.naoMedido ? ` · n/m ${gps.naoMedido}` : "";
  if (gps.fora) return `fora ${gps.fora}/${gps.total} · ${fmtDist(gps.maiorDistancia)}${nm}`;
  if (!gps.junto) return `não medido (${gps.total})`;
  return `junto ${gps.junto}/${gps.total}${nm}`;
}

// TRÊS estados, nunca dois. "Não medido" (âncora do veículo sem coordenada)
// tem balde próprio: contá-lo como "junto" é o falso 'junto' que contamina a
// régua e a sugestão (main.py:274-276, bug ALENCAR/Ciganos).
function LocalGps({ gps }) {
  if (!gps || !gps.total) return <span className="dp-faint">—</span>;

  const nm = gps.naoMedido || 0;
  const dicaNm = nm
    ? ` ${nm} batida(s) não medida(s) — âncora do veículo sem coordenada (terminal que a régua não sabe localizar).`
    : "";
  const selo = nm ? (
    <>
      {" "}
      <span className="dp-pill mute" title={`${nm} batida(s) não medida(s) — âncora do veículo sem coordenada.`}>
        n/m {nm}
      </span>
    </>
  ) : null;

  if (gps.fora)
    return (
      <>
        <span
          className="dp-pill danger dp-num"
          title={`${gps.fora} de ${gps.total} batida(s) FORA. A mais longe: ${fmtDist(gps.maiorDistancia)}${gps.horaMaisLonge ? ` às ${gps.horaMaisLonge}` : ""}.${dicaNm}`}
        >
          📍 {gps.fora}/{gps.total} fora · {fmtDist(gps.maiorDistancia)}
        </span>
        {selo}
      </>
    );

  // Nada fora, mas nada medido: não dá para dizer "junto".
  if (!gps.junto)
    return (
      <span
        className="dp-pill mute dp-num"
        title={`Nenhuma das ${gps.total} batida(s) pôde ser medida — a âncora do veículo veio sem coordenada. Não é "junto": é sem informação.`}
      >
        n/m ({gps.total})
      </span>
    );

  return (
    <>
      <span
        className="dp-pill ok dp-num"
        title={`${gps.junto} de ${gps.total} batida(s) junto da referência operacional (≤ ${RAIO_VEIC} m do veículo, ou ≤ ${RAIO_LOCAL} m do local conhecido).${dicaNm}`}
      >
        ✓ junto ({gps.junto})
      </span>
      {selo}
    </>
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
        className="dp-pill danger"
        title="Há operação apurada no dia, mas nenhuma batida no cartão. O ponto tem de ser criado pela operação."
      >
        OPEROU SEM PONTO · criar pela operação
      </span>
    );
  if (ehPontoInvertido(linha))
    return (
      <span
        className="dp-pill warn"
        title="Cartão rotacionado: defeito de posição das batidas. Exige decisão manual do DP — não gera comunicado ao colaborador."
      >
        {motivo || "PONTO_INVERTIDO"}
      </span>
    );
  if (!motivo) return <span className="dp-faint">—</span>;
  return <span title={motivo}>{motivo.split(" (")[0]}</span>;
}

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

function CartaoModal({ linha, caso, gps, aoFechar, aoRecarregar, aoAvisar, impedimentoAviso }) {
  const [extra, setExtra] = useState({ gordura: null, intervalo: null, ajustes: [] });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  // Gravação: um recado por bloco, para o sucesso/erro aparecer ONDE a pessoa clicou.
  const [salvando, setSalvando] = useState("");
  const [recadoRm, setRecadoRm] = useState(null);
  const [recadoOk, setRecadoOk] = useState(null);

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
  const jaConferido = pontoConferido(caso);

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

  // main.py `marcar_ponto_ok` (~415). Um registro em ponto_caso alimenta a Revisão (o
  // dia sai da lista) e as Folgas (o dia conta como certo). Desfazer LIMPA a marca.
  // O crachá vai como `str(cracha).strip()`, igual ao Python — a chave do upsert é
  // (cracha, date_ref) e mudar a forma criaria uma segunda linha para o mesmo dia.
  const marcarPontoOk = async (ligar) => {
    setRecadoOk(null);
    setSalvando("ok");
    const agora = agoraUtc();
    const payload = {
      cracha: String(cracha ?? "").trim(),
      date_ref: dia,
      nm_funcionario: linha.nm_funcionario || "",
      atualizado_em: agora,
      ...(ligar
        ? { origem: "revisao", tipo: "ponto_ok", aceite: "aceito", ajuste: "certo", conferido_em: agora }
        : { tipo: "", aceite: "pendente", ajuste: null, conferido_em: null }),
    };
    try {
      await upsertDP360("ponto_caso", payload);
      setRecadoOk({
        tipo: "ok",
        texto: ligar ? "Dia marcado como conferido." : "Marca desfeita — o dia volta para a Revisão.",
      });
      await recarregar();
    } catch (falha) {
      setRecadoOk({ tipo: "erro", texto: falha.message || "Não foi possível gravar o ponto conferido." });
    } finally {
      setSalvando("");
    }
  };

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
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
      style={{ background: "rgba(15,20,32,.5)", padding: 16 }}
    >
      <div className="dp-card w-full max-w-6xl" style={{ padding: 0 }}>
        <header
          className="flex items-start gap-3"
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
          <Pilula
            texto={linha.status_ponto || "—"}
            tom={String(linha.status_ponto ?? "").toUpperCase() === "OK" ? "ok" : "warn"}
          />
          <button type="button" onClick={aoFechar} className="dp-btn" aria-label="Fechar">
            <X size={14} />
          </button>
        </header>

        <div style={{ display: "grid", gap: 8, padding: "12px 18px 0" }}>
          <AvisoTrava motivo={bloqueio} />
          {erro && (
            <div className="dp-card">
              <span className="dp-pill danger">{erro}</span>
            </div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2" style={{ padding: 18 }}>
          {/* ---------- coluna 1: fontes, sugestão, real ---------- */}
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
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
              </div>
              {carregando && <p className="dp-faint" style={{ margin: "6px 0 0" }}>Carregando fontes…</p>}
              {!carregando && !g.op_inicio && !g.sst_vinculo && !g.val_inicio && (
                <p className="dp-faint" style={{ margin: "6px 0 0" }}>
                  Sem operação apurada neste dia (interno/aprendiz não tem Citatti, SST nem bilhetagem).
                </p>
              )}
              {/* O mapa das batidas já entrou — fica na coluna 2, junto do bloco
                  "📍 Local da batida". TODO(port DP360): falta o detalhamento de
                  viagens_qh (linha/tabela/veículo). */}
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

          {/* ---------- coluna 2: almoço, GPS, linha do tempo ---------- */}
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
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
              {!gps || !gps.total ? (
                <p className="dp-faint" style={{ margin: 0 }}>Sem GPS registrado neste dia.</p>
              ) : (
                <ul className="dp-card" style={{ listStyle: "none", margin: 0, padding: 8, display: "grid", gap: 3 }}>
                  {gps.detalhes.map((d, i) => (
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
              {!!gps?.naoMedido && (
                <p className="dp-faint" style={{ margin: "6px 0 0", fontSize: 11.5 }}>
                  {gps.naoMedido} batida(s) não medida(s): a posição operacional do veículo veio só com o
                  nome do terminal, sem coordenada. Não vira "junto" nem "fora".
                </p>
              )}
              {/* O MAPA vem DEPOIS da lista de propósito: a lista dá o veredito
                  ("fora · 2,1 km"), o mapa mostra ONDE. As cercas desenhadas são
                  a mesma régua de `regrasGps` — nada é recalculado aqui. */}
              {!!gps?.total && (
                <div style={{ marginTop: 8 }}>
                  <MapaBatidas
                    batidas={gps.batidas}
                    ancoras={gps.ancoras}
                    resultadoRegua={gps.detalhes}
                    nome={linha.nm_funcionario || ""}
                    altura={300}
                  />
                </div>
              )}
            </section>

            <section>
              <TituloBloco>Linha do tempo do caso</TituloBloco>
              <ol className="dp-card" style={{ listStyle: "none", margin: 0, padding: 8, display: "grid", gap: 3 }}>
                {passos.map((p) => (
                  <li
                    key={p.titulo}
                    className="flex gap-3"
                    style={{
                      padding: "6px 9px",
                      borderRadius: 8,
                      ...(p.alerta && p.feito
                        ? { background: "var(--dp-danger-bg)" }
                        : p.feito
                          ? { background: "var(--dp-ok-bg)" }
                          : { background: "var(--dp-surface-2)" }),
                    }}
                  >
                    <span>{p.feito ? p.icone : "○"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2" style={{ fontSize: 12.5, fontWeight: 600 }}>
                        {p.titulo}
                        {p.quando && <span className="dp-muted dp-num" style={{ fontWeight: 500 }}>{p.quando}</span>}
                      </div>
                      {p.nota && <div className="dp-muted" style={{ marginTop: 2, fontSize: 11.5 }}>{p.nota}</div>}
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
          className="flex flex-wrap items-center justify-between gap-3"
          style={{
            padding: "12px 18px",
            borderTop: "1px solid var(--dp-border)",
            background: "var(--dp-surface-2)",
            borderRadius: "0 0 var(--dp-radius) var(--dp-radius)",
          }}
        >
          <p className="dp-muted" style={{ margin: 0, fontSize: 11.5 }}>
            {jaConferido ? (
              <>
                ✓ <b>Conferido pelo DP</b>
                {caso?.conferido_em ? ` · ${fmtDataHora(caso.conferido_em)}` : ""} — o dia sai da Revisão e
                conta como certo nas Folgas.
              </>
            ) : (
              <>
                Real manual e ponto conferido ficam na base do DP. <b>Enviar ocorrência</b> fala com o
                trabalhador: abre o comunicado deste dia, com Ensaio e envio de verdade.
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Recado recado={recadoOk} />
            {/* main.py `marcar_ponto_ok`: um registro em ponto_caso (tipo='ponto_ok') tira o
                dia da Revisão E o conta como certo nas Folgas. Desfazer limpa a marca. */}
            <button
              type="button"
              className={`dp-btn ${jaConferido ? "" : "primary"}`}
              disabled={salvando === "ok"}
              onClick={() => marcarPontoOk(!jaConferido)}
              title={
                jaConferido
                  ? "Desfaz a marca: o dia volta para a lista da Revisão."
                  : "O dia está certo do jeito que está, mesmo que a régua automática ainda peça revisão."
              }
            >
              {salvando === "ok" ? "gravando…" : jaConferido ? "↩ Desfazer conferido" : "✓ Ponto conferido"}
            </button>
            {/* O aviso deste DIA, para esta PESSOA. Quem monta o CSV, decide os barrados
                e grava `ponto_caso` (com o alvo congelado, nunca reescrito por um segundo
                aviso) é o `ModalComunicado`, o mesmo da barra de filtros — aqui só se
                escolhe o escopo de uma linha. Recusar ≠ advertir: a advertência só existe
                depois de um aviso que ele não atendeu, e ela não sai desta tela. */}
            {impedimentoAviso ? (
              <BotaoSemAlvo titulo={impedimentoAviso}>📣 Enviar ocorrência</BotaoSemAlvo>
            ) : (
              <button
                type="button"
                className="dp-btn"
                onClick={() => aoAvisar && aoAvisar(linha)}
                title="Abre o comunicado deste dia: prévia do texto, quem recebe e os dois botões (Ensaio · Enviar de verdade)."
              >
                📣 Enviar ocorrência
              </button>
            )}
            <button type="button" onClick={aoFechar} className="dp-btn">
              Fechar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ═══════════════════════════ O COMUNICADO AO TRABALHADOR ═══════════════════════════
   Porte de app.js `comunicadoModal` + do padrão de disparo já pronto em `Folgas.jsx`.

   As regras (formato do CSV, quem é barrado, que caso abre) NÃO moram aqui: são de
   `../comunicadoTransnet`, porque a Gordura manda o MESMO arquivo pelo MESMO robô.
   Este componente é a TELA: mostra a prévia, mostra quem recebe, mostra QUEM FICOU DE
   FORA e por quê, e oferece os dois botões.

   DOIS BOTÕES, NUNCA UM CHECKBOX. "Confirmar" marcado por engano vira comunicado real
   na ficha de alguém e, 48 h depois, advertência. Ensaio: o robô anexa o arquivo no
   Envio via CSV e NÃO confirma — e ENSAIO NÃO ABRE CASO (main.py:2440: enquanto abria,
   o prazo passava a correr por causa de um teste, sem nenhuma mensagem ter saído).   */

function ListaPessoas({ itens, limite = 12 }) {
  const mostrados = itens.slice(0, limite);
  return (
    <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", fontSize: 12 }}>
      {mostrados.map((i) => (
        <li key={`${i.cracha}|${i.data}`} className="dp-muted">
          · <b style={{ color: "var(--dp-ink)" }}>{i.nome || "—"}</b>{" "}
          <span className="dp-num">{i.cracha}</span>
          {i.motivo ? ` — ${i.motivo}` : ""}
        </li>
      ))}
      {itens.length > mostrados.length && (
        <li className="dp-faint">+ {itens.length - mostrados.length} outro(s)</li>
      )}
    </ul>
  );
}

function ModalComunicado({
  titulo,
  ajuda,
  rota, // TIPO.REVMOT | TIPO.FORA | TIPO.INTERNO
  linhas, // alvo já escolhido pela aba
  chavesTemplate, // quais modelos ler do app_config
  templateEditavel, // qual deles a caixa de texto edita (null = nenhum)
  mensagemDe, // (linha, templates) => texto renderizado
  alvoDe, // (linha) => { contrato, erro } — só revmot
  casoTipoDe, // (linha) => "almoco"|"incompleto"|"curta" — só interno
  congelarReaviso = true,
  comPontoAntes = false,
  casoDe, // (cracha, date_ref) => caso já gravado
  nota, // texto extra da aba (ex.: os pulados do interno)
  aoFechar,
  aoConcluir,
}) {
  const [templates, setTemplates] = useState(null);
  const [erro, setErro] = useState("");
  const [disparando, setDisparando] = useState(false);
  const [recado, setRecado] = useState(null);

  // Os modelos vivem no `app_config` — a MESMA chave que a ferramenta antiga lê na hora
  // do envio (aba Config). Vazio cai no texto oficial (Quataí + Art. 74 da CLT).
  useEffect(() => {
    let ativo = true;
    const chaves = chavesTemplate.map(chaveTemplate);
    lerDP360("app_config", { filtros: { chave: `in.(${chaves.join(",")})` } })
      .then((linhasCfg) => {
        if (!ativo) return;
        // `app_config.valor` é jsonb e a ferramenta grava STRING; `escolherTemplate`
        // aceita o que vier e cai no texto oficial quando está vazio.
        const salvos = {};
        for (const l of linhasCfg || []) salvos[l.chave] = l.valor;
        const out = {};
        for (const tipo of chavesTemplate) out[tipo] = escolherTemplate(salvos[chaveTemplate(tipo)], tipo);
        setTemplates(out);
      })
      .catch((falha) => {
        if (!ativo) return;
        // Sem o app_config o envio não fica travado: cai no texto oficial e a tela avisa.
        const out = {};
        for (const tipo of chavesTemplate) out[tipo] = escolherTemplate("", tipo);
        setTemplates(out);
        setErro(`Não foi possível ler os modelos salvos (${falha.message || falha}). Usando o texto padrão.`);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chavesTemplate.join(",")]);

  useEffect(() => {
    const escapa = (e) => {
      if (e.key === "Escape" && !disparando) aoFechar();
    };
    document.addEventListener("keydown", escapa);
    return () => document.removeEventListener("keydown", escapa);
  }, [aoFechar, disparando]);

  // O carimbo do caso é o INSTANTE do envio, então o preparo é refeito no clique. Este
  // aqui é só o da tela (prévia, contagem, barrados, CSV que a pessoa vê).
  const montar = useCallback(
    (agora) =>
      prepararComunicado({
        tipo: rota,
        linhas,
        mensagemDe: (l) => mensagemDe(l, templates),
        alvoDe,
        casoTipoDe,
        comPontoAntes,
        agora,
      }),
    [rota, linhas, mensagemDe, templates, alvoDe, casoTipoDe, comPontoAntes],
  );

  const preparo = useMemo(() => (templates ? montar(undefined) : null), [templates, montar]);

  // app.js `varsPendentes`: variável que ficou sem preencher BLOQUEIA o envio. Depois do
  // `normalizaMensagem` só sobra o que foi digitado errado no modelo ({data} em vez de
  // {DATA}) — e isso não pode chegar ao colaborador dentro de uma carta.
  const pendentes = useMemo(
    () => [...new Set((preparo?.itens || []).flatMap((i) => variaveisPendentes(i.mensagem)))],
    [preparo],
  );

  const disparar = async (confirmar) => {
    const p = montar(agoraUtc());
    if (!p.itens.length) {
      setRecado({ tipo: "erro", texto: "Nenhum comunicado a enviar — veja os barrados abaixo." });
      return;
    }
    // main.py `enviar_aviso_interno` (~2687): a tela do Transnet recebe UMA Data
    // Referência por envio. Duas datas no mesmo arquivo carimbariam o dia errado.
    if (p.datas.length > 1) {
      setRecado({
        tipo: "erro",
        texto: `A tela envia uma data por vez, e há ${p.datas.length} datas: ${p.datas.join(", ")}. Filtre por data.`,
      });
      return;
    }
    if (pendentes.length) {
      setRecado({ tipo: "erro", texto: `Envio bloqueado: variável sem preencher (${pendentes.join(", ")}).` });
      return;
    }

    const nomes = p.itens
      .slice(0, NOMES_NA_CONFIRMACAO)
      .map((i) => `· ${i.nome || i.cracha} (${i.cracha})`)
      .join("\n");
    const resto = p.itens.length > NOMES_NA_CONFIRMACAO ? `\n· … e mais ${p.itens.length - NOMES_NA_CONFIRMACAO}` : "";
    const cabeca = confirmar
      ? `ENVIAR DE VERDADE ${p.itens.length} comunicado(s) no Transnet, do dia ${p.datas[0]}:`
      : `ENSAIO (o robô anexa o arquivo e NÃO confirma o envio) — ${p.itens.length} comunicado(s) do dia ${p.datas[0]}:`;
    // O que ACONTECE, dito sem eufemismo. O caso é o que faz o ciclo (48 h → advertência)
    // existir; onde ele não é aberto, a tela diz isso em vez de deixar subentendido.
    const efeito = !confirmar
      ? `Nada é enviado e NENHUM caso é aberto.`
      : rota === TIPO.FORA
        ? `Cada um recebe a mensagem no Transnet. NENHUM caso é aberto: bater ponto fora é ` +
          `justificativa, não ajuste — e um caso aqui sobrescreveria o do dia.`
        : `Cada um recebe a mensagem no Transnet e o caso do dia é aberto/atualizado em ` +
          `ponto_caso, com o prazo correndo a partir de agora (o alvo já congelado não é reescrito).`;
    if (
      !window.confirm(
        `${cabeca}\n\n${nomes}${resto}\n\n${efeito}\n\n` +
          `Quem executa é o robô, no GitHub Actions. O disparo fica registrado com o seu nome.`,
      )
    )
      return;

    setDisparando(true);
    setRecado(null);
    try {
      // ORDEM DELIBERADA: dispara PRIMEIRO, grava o caso DEPOIS. O caso é o que faz o
      // prazo de 48 h correr e a advertência nascer; gravá-lo antes de saber se o robô
      // saiu deixaria alguém "avisado" por um disparo que o GitHub recusou. O contrário
      // (mensagem enviada e caso não gravado) é barulho recuperável — e a tela grita.
      const r = await dispararRoboDP360("comunicado", {
        csv: p.csv,
        data: p.datas[0],
        motivo: MOTIVO_AVISO, // aviso. Advertência (103) não sai desta tela.
        confirmar: confirmar ? "true" : "false",
      });

      let alerta = "";
      let reavisados = [];
      if (confirmar && p.casos.length) {
        const { casos, reavisos } = marcarReavisos(p.casos, casoDe, { congelar: congelarReaviso });
        reavisados = reavisos;
        try {
          await upsertDP360("ponto_caso", casos);
        } catch (falha) {
          alerta =
            ` ATENÇÃO: o comunicado SAIU, mas o registro em ponto_caso falhou (${falha.message || falha}).` +
            ` O prazo de 48 h não está correndo para este lote — avise quem cuida do ciclo.`;
        }
      }
      setRecado({
        tipo: alerta ? "erro" : "ok",
        texto:
          `${confirmar ? "Envio" : "Ensaio"} disparado — ${p.itens.length} comunicado(s) do dia ${p.datas[0]}.` +
          (reavisados.length ? ` ${reavisados.length} já tinham sido avisados antes (o alvo original ficou).` : "") +
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
            <b style={{ fontSize: 14 }}>{titulo}</b>
            <div className="dp-muted" style={{ fontSize: 11.5, marginTop: 2 }}>
              {ajuda} O CSV sai idêntico ao Transnet — <b>uma linha por colaborador, campos entre aspas</b>{" "}
              (Empresa · Crachá · Comunicado).
            </div>
          </div>
          <button type="button" className="dp-det-x" onClick={aoFechar} aria-label="Fechar">
            <X size={16} />
          </button>
        </header>

        <div style={{ padding: "14px 18px", display: "grid", gap: 12 }}>
          {erro && <div className="dp-pill warn">{erro}</div>}
          {!templates && <div className="dp-muted">Carregando os modelos…</div>}

          {templates && templateEditavel && (
            <div>
              <label className="dp-muted" style={{ fontSize: 11.5, display: "block", marginBottom: 4 }}>
                Texto que vai para o colaborador — a edição aqui vale <b>só para este envio</b>. Para mudar o
                modelo salvo, use a aba <b>Config</b>.
              </label>
              <textarea
                value={templates[templateEditavel] || ""}
                onChange={(e) => setTemplates({ ...templates, [templateEditavel]: e.target.value })}
                rows={7}
                style={{ ...ESTILO_INPUT, width: "100%", minHeight: 120, resize: "vertical" }}
              />
            </div>
          )}

          {primeira && (
            <div className="dp-card" style={{ fontSize: 12 }}>
              <b>Prévia ({primeira.nome || primeira.cracha}) — como vai no CSV:</b>
              <div style={{ marginTop: 4 }}>&quot;{primeira.mensagem}&quot;</div>
            </div>
          )}

          {!!pendentes.length && (
            <div className="dp-pill danger">
              Não enviar: variável sem preencher ({pendentes.join(", ")}).
            </div>
          )}

          {!!preparo?.itens?.length && (
            <div>
              <b style={{ fontSize: 12.5 }}>{preparo.itens.length} vão receber</b>
              <ListaPessoas itens={preparo.itens} />
            </div>
          )}

          {/* OS BARRADOS APARECEM. A pessoa não some da lista em silêncio: quem não recebe
              e POR QUE fica escrito, senão o DP conta 40 marcados e vê 31 enviados sem
              nunca saber o que aconteceu com os outros nove. */}
          {!!preparo?.barrados?.length && (
            <div className="dp-card" style={{ borderColor: "var(--dp-danger-ink)" }}>
              <span className="dp-pill danger">⚠ {preparo.barrados.length} não recebem</span>{" "}
              <span className="dp-muted" style={{ fontSize: 11.5 }}>
                O aviso não sai para estes — o motivo está ao lado do nome. Nada é enviado e nenhum caso é
                aberto para eles.
              </span>
              <ListaPessoas itens={preparo.barrados} />
            </div>
          )}

          {nota && (
            <p className="dp-muted" style={{ margin: 0, fontSize: 11.5 }}>
              {nota}
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
                      ver o robô rodando
                    </a>
                  </>
                )}
              </>
            )}
          </div>
          <div className="dp-det-bot-acoes">
            <button
              type="button"
              className="dp-btn"
              disabled={disparando || !preparo?.itens?.length}
              onClick={() => disparar(false)}
              title="O robô anexa o arquivo no Envio via CSV e NÃO confirma — serve para conferir o lote. Nenhum caso é aberto."
            >
              🤖 Ensaio
            </button>
            <button
              type="button"
              className="dp-btn"
              style={{ color: "var(--dp-danger-ink)" }}
              disabled={disparando || !preparo?.itens?.length}
              onClick={() => disparar(true)}
              title="Publica o comunicado na ficha de cada colaborador, no Transnet."
            >
              ⚠ Enviar de verdade
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

/* ---------- colunas da grade (ordem do COLS_REV do app antigo) ----------
   A grade é a `TabelaDP` compartilhada: ela entrega ordenar, ocultar coluna (⚙),
   fixar, redimensionar, CSV e preferência salva por tela (`tbl_p2` no app_config).
   Contrato dela: `valor` é o que ORDENA e EXPORTA, `render` só EXIBE. Coluna cujo
   `render` devolve pílula/chip PRECISA de `valor` em texto — senão o CSV sai vazio
   e a ordenação compara `[object Object]`.
   As colunas que dependem de estado da aba (Avisado?, 📍 Local, Motivo, e os chips
   de sugestão bloqueada) recebem `render`/`valor` dentro do componente. */
const COLUNAS = [
  { id: "cracha", rotulo: "Crachá", classe: "dp-num dp-mono", largura: 92 },
  { id: "nm_funcionario", rotulo: "Nome", estilo: { fontWeight: 600 }, largura: 210 },
  { id: "nm_funcao", rotulo: "Função", classe: "dp-muted", largura: 150 },
  { id: "date_ref", rotulo: "Data", classe: "dp-num dp-mono", largura: 100 },
  { id: "status_ponto", rotulo: "Status", largura: 175 }, // cabe status + "✓ conferido"
  { id: "_avisado", rotulo: "Avisado?", largura: 120 },
  { id: "_gps", rotulo: "📍 Local", largura: 170 },
  { id: "motivo", rotulo: "Motivo", largura: 200 },
  { id: "sugestao_fonte", rotulo: "Fonte SUG", classe: "dp-muted", largura: 130 },
  { id: "qtd_batidas", rotulo: "Qtd batidas", classe: "dp-num", alinhar: "center", largura: 90 },
  { id: "todas_batidas", rotulo: "Todas as batidas", classe: "dp-num dp-mono", largura: 210 },
  { id: "batidas_limpas", rotulo: "Batidas limpas", classe: "dp-num dp-mono", largura: 180 },
  { id: "entrada", rotulo: "Entrada", classe: "dp-num dp-mono", hora: true, largura: 88 },
  { id: "saida_almoco", rotulo: "Saída almoço", classe: "dp-num dp-mono", hora: true, largura: 105 },
  { id: "volta_almoco", rotulo: "Volta almoço", classe: "dp-num dp-mono", hora: true, largura: 105 },
  { id: "saida", rotulo: "Saída", classe: "dp-num dp-mono", hora: true, largura: 88 },
  { id: "_jornada", rotulo: "Jornada", classe: "dp-num dp-mono", largura: 92 },
  { id: "esc_entrada", rotulo: "Esc. apresentação", classe: "dp-num dp-mono", hora: true, largura: 125 },
  { id: "programado_entrada", rotulo: "Esc. início", classe: "dp-num dp-mono", hora: true, largura: 95 },
  { id: "programado_saida", rotulo: "Esc. fim", classe: "dp-num dp-mono", hora: true, largura: 95 },
  { id: "esc_saida", rotulo: "Esc. saída", classe: "dp-num dp-mono", hora: true, largura: 95 },
  { id: "_sep", rotulo: "│" },
  { id: "entrada_sug", rotulo: "Entrada SUG", hora: true, sug: true, largura: 105 },
  { id: "almoco_saida_sug", rotulo: "S. almoço SUG", hora: true, sug: true, largura: 118 },
  { id: "almoco_volta_sug", rotulo: "V. almoço SUG", hora: true, sug: true, largura: 118 },
  { id: "saida_sug", rotulo: "Saída SUG", hora: true, sug: true, largura: 105 },
  { id: "duracao_total_sug", rotulo: "Dur. total SUG", classe: "dp-num dp-mono", sug: true, largura: 115 },
  { id: "atraso_min", rotulo: "Atraso (min)", classe: "dp-num", alinhar: "right", largura: 95 },
  { id: "he_min", rotulo: "HE (min)", classe: "dp-num", alinhar: "right", largura: 85 },
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
  // `jornada_total_min` NAO existe em ponto_diario — e coluna da ponto_intervalo.
  // Pedir aqui devolvia HTTP 400 e derrubava a aba. A jornada do cartao e
  // `jornada_liquida_min` (ha tambem jornada_bruta_min e jornada_corrigida_min).
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

// Só o que a régua de GPS precisa da `ponto_gordura`: a janela da operação
// (escada real > citatti > bilhetagem > SST) e a marca de dia de reserva.
// Crachas com RESERVA lancada pelo gestor no dia. A tabela vive no projeto do INOVE
// (nao na base de importacao), entao vai pelo cliente normal — o gateway dp360-api so
// cobre as tabelas de ponto. Porte de ferramenta/supabase_client.py:695.
// DEGRADA sem quebrar: sem a tabela / sem permissao / sem rede, devolve vazio e a tela
// segue com a regua do veiculo, igual ao try/except do original (main.py:4851).
async function lerReservasInove(dia) {
  try {
    const { data, error } = await supabase
      .from("reservas_motoristas")
      .select("funcionario_cracha,data_referencia")
      .eq("data_referencia", dia);
    if (error) throw error;
    const set = new Set();
    for (const r of data || []) {
      const cr = cra8(r.funcionario_cracha);
      if (cr) set.add(cr);
    }
    return set;
  } catch {
    return new Set();
  }
}

const COLUNAS_GORDURA_GPS = [
  "cracha",
  "data_ref",
  "real_inicio",
  "real_fim",
  "op_inicio",
  "op_fim",
  "val_inicio",
  "val_fim",
  "sst_vinculo",
  "sst_desvinculo",
  // NAO peca `tem_reserva_inove` aqui: ela NAO e coluna da tabela. O Python cria esse
  // campo em memoria, na camada _aplica_reserva (main.py:4844), a partir da tabela
  // `reservas_motoristas` — que vive no projeto do INOVE, nao na base de importacao.
  // Pedir no select devolvia HTTP 400 e derrubava a aba inteira ("Edge Function
  // returned a non-2xx status code"). O dia de reserva vem de lerReservasInove().
].join(",");

/* =============================================================================
   Componente
   ========================================================================== */
export default function Revisao() {
  const [categoria, setCategoria] = useState("MOTORISTA");
  const [categorias, setCategorias] = useState(CATEGORIAS_PADRAO);
  const [datas, setDatas] = useState([]);
  const [data, setData] = useState("");
  // Dias que TÊM linha na base mas ainda não têm ponto importado. Não entram no
  // seletor (é a regra do original); viram aviso, para ninguém procurar ontem.
  const [datasSemPonto, setDatasSemPonto] = useState([]);
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
    // `tem_ponto` vem junto: é ele que diz se o dia CHEGOU (main.py:7067). A
    // `ponto_diario` cria uma linha por pessoa por dia assim que a escala existe
    // — a linha nasce antes da batida —, então sem este filtro o seletor oferece
    // o dia que ainda está importando e a tela mostra a garagem toda em SEM_PONTO.
    lerTudoDP360(
      "ponto_diario",
      { colunas: COLUNAS_INDICE_DATAS.join(","), ordem: "date_ref.desc" },
      lotesDatas,
    )
      .then((rows) => {
        if (!ativo) return;
        const { datas: dts, semPonto, categorias: cats } = datasComPonto(rows);
        setDatas(dts);
        setDatasSemPonto(semPonto);
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
    // A `ponto_gordura` entra aqui por DOIS motivos, os mesmos do app antigo
    // (main.py `get_gps_flags`, 6929-6957):
    //   1. a JANELA DA OPERAÇÃO (real > citatti > bilhetagem > SST), que ancora
    //      cada ponta na régua — sem ela a entrada é medida contra o carro da
    //      hora errada;
    //   2. `tem_reserva_inove`, a marca de DIA DE RESERVA. Sem carro atribuído,
    //      batida em local conhecido vale por si (main.py:281-288) — é o que
    //      apagava o falso "bateu fora" do ANTONIO (03:10 na Garagem 046
    //      aparecendo "a 4,9 km do veículo (07:08)").
    Promise.all([
      lerTudoDP360("ponto_gps", {
        colunas: "cracha,hora,latitude,longitude,origem",
        filtros: { date_ref: `eq.${data}` },
        ordem: "cracha.asc",
      }),
      lerTudoDP360("gps_carro", {
        colunas: "cracha,hora,latitude,longitude,veiculo,poi,cerca,tipo,fonte,linha",
        filtros: { date_ref: `eq.${data}` },
        ordem: "cracha.asc",
      }),
      lerTudoDP360("ponto_gordura", {
        colunas: COLUNAS_GORDURA_GPS,
        filtros: { data_ref: `eq.${data}` },
        ordem: "cracha.asc",
      }),
      lerReservasInove(data),
    ])
      .then(([batidas, carros, gordura, reservas]) => {
        if (!ativo) return;
        const porCracha = {};
        const balde = (cracha) => {
          const cr = cra8(cracha);
          if (!porCracha[cr]) porCracha[cr] = { batidas: [], ancoras: [] };
          return porCracha[cr];
        };
        for (const b of batidas) balde(b.cracha).batidas.push(b);
        for (const c of carros) balde(c.cracha).ancoras.push(c);

        // Mesma escada do app antigo para a janela da operação.
        const contexto = {};
        for (const g of gordura) {
          contexto[cra8(g.cracha)] = {
            opIni: g.real_inicio || g.op_inicio || g.val_inicio || g.sst_vinculo || "",
            opFim: g.real_fim || g.op_fim || g.val_fim || g.sst_desvinculo || "",
            // Dia de reserva vem da tabela do INOVE, nao da gordura (ver COLUNAS_GORDURA_GPS).
            ehReserva: reservas.has(cra8(g.cracha)),
          };
        }
        // Quem tem reserva lancada mas nao tem linha de gordura no dia tambem precisa
        // entrar no contexto — senao a batida dele cai na regua do veiculo e vira
        // falso "bateu fora", que e exatamente o bug que esta camada existe para evitar.
        for (const cr of reservas) {
          if (!contexto[cr]) contexto[cr] = { opIni: "", opFim: "", ehReserva: true };
        }

        const resumo = {};
        for (const [cr, dados] of Object.entries(porCracha)) {
          if (!dados.batidas.length) continue;
          const ctx = contexto[cr] || { opIni: "", opFim: "", ehReserva: false };
          resumo[cr] = calcularGps({
            batidas: dados.batidas,
            ancoras: dados.ancoras,
            ehReserva: ctx.ehReserva,
            opIni: ctx.opIni,
            opFim: ctx.opFim,
          });
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

  /* ---- colunas da TabelaDP: mesma ordem/cor/render de antes, agora com `valor` ----
     `render` continua sendo o que a tela mostra (pílulas, chips, "—"); `valor` é a
     versão TEXTO/NÚMERO que a grade usa para ordenar e para o CSV. Sem os dois, ou o
     CSV sai com JSX ou a ordenação compara string com objeto. */
  const colunas = useMemo(
    () =>
      COLUNAS.map((col) => {
        const bloqueioDe = (l) => bloqueios[chaveDia(l.cracha, l.date_ref)];

        if (col.id === "_sep") return { ...col, render: () => <span className="dp-faint">│</span> };

        // O "conferido pelo DP" mora em ponto_caso, não em ponto_diario — a régua
        // automática continua marcando REVISAR. Sem mostrar a marca aqui, o DP clica,
        // fecha o cartão e a grade fica exatamente igual (main.py `get_pontos_ok`).
        if (col.id === "status_ponto")
          return {
            ...col,
            valor: (l) => {
              const s = String(l.status_ponto ?? "").trim();
              return pontoConferido(casos[chaveDia(l.cracha, l.date_ref)]) ? `${s} · conferido` : s;
            },
            render: (l) => (
              <>
                <Pilula
                  texto={l.status_ponto || "—"}
                  tom={String(l.status_ponto ?? "").toUpperCase() === "OK" ? "ok" : "warn"}
                />
                {pontoConferido(casos[chaveDia(l.cracha, l.date_ref)]) && (
                  <>
                    {" "}
                    <Pilula
                      texto="✓ conferido"
                      tom="ok"
                      titulo="O DP marcou este dia como certo — ele conta como OK nas Folgas."
                    />
                  </>
                )}
              </>
            ),
          };

        if (col.id === "_avisado")
          return {
            ...col,
            valor: (l) => estadoAviso(casos[chaveDia(l.cracha, l.date_ref)]).texto,
            render: (l) => <Avisado caso={casos[chaveDia(l.cracha, l.date_ref)]} />,
          };

        if (col.id === "_gps")
          return {
            ...col,
            valor: (l) => textoGps(gpsPorCracha[cra8(l.cracha)]),
            render: (l) => <LocalGps gps={gpsPorCracha[cra8(l.cracha)]} />,
          };

        if (col.id === "motivo")
          return { ...col, valor: (l) => String(l.motivo ?? "").trim(), render: (l) => <Motivo linha={l} /> };

        // Data em dd/mm/aaaa: a `chaveOrd` da grade entende esse formato e ordena por
        // ano/mês/dia — foi justamente aqui que a ferramenta ordenava pelo DIA DO MÊS.
        if (col.id === "date_ref") return { ...col, valor: (l) => fmtData(l.date_ref) };

        // Jornada ordena/exporta em MINUTOS (número) e exibe "8h02".
        if (col.id === "_jornada")
          return {
            ...col,
            valor: (l) => {
              const n = parseInt(l.jornada_liquida_min, 10);
              return Number.isNaN(n) ? null : n;
            },
            render: (l) => fmtMin(l.jornada_liquida_min),
          };

        const valor = col.hora ? (l) => fmtHora(l[col.id]) : (l) => String(l[col.id] ?? "").trim();

        return {
          ...col,
          valor,
          render: (l) => {
            const texto = valor(l);
            if (!texto) return <span className="dp-faint">—</span>;
            // Sugestão bloqueada não é sugestão: o valor continua visível (o DP precisa
            // ver o que a view propôs), mas marcado — não dá pra avisar nem lançar.
            const bloqueio = col.sug ? bloqueioDe(l) : "";
            if (col.sug && bloqueio)
              return (
                <span className="dp-chip dp-num new" title={`⚠ ${bloqueio}`}>
                  {texto}
                  <span className="es">⚠</span>
                </span>
              );
            // Horário sugerido utilizável: chip mono, como as batidas da ferramenta.
            if (col.sug && col.hora) return <span className="dp-chip dp-num">{texto}</span>;
            return texto;
          },
        };
      }),
    [bloqueios, casos, gpsPorCracha],
  );

  /* ---- releitura de UMA linha depois de gravar ----
     A tela nunca pinta o estado otimista: relê `ponto_diario` (cru), `ponto_real_manual`
     e `ponto_caso` do crachá/dia e reaplica o overlay do Real. O `ponto_diario` cru é o
     que permite DESFAZER o overlay quando o Real manual é apagado — reaproveitar a linha
     já sobrescrita deixaria `entrada_sug`/`alvo_*` com o valor antigo do DP.
     `in.(...)` com as variantes do crachá porque as tabelas do lake divergem no zero à
     esquerda (é o mesmo truque do pop-up). */
  const recarregarLinha = useCallback(async (cracha, dia) => {
    const cr = String(cracha ?? "").trim();
    const variantes = [...new Set([cr, cr.replace(/^0+/, ""), cra8(cr)].filter(Boolean))].join(",");
    const filtros = { cracha: `in.(${variantes})`, date_ref: `eq.${dia}` };
    const [diario, reaisManuais, listaCasos] = await Promise.all([
      lerDP360("ponto_diario", { colunas: COLUNAS_PONTO_DIARIO, filtros, limite: 5 }),
      lerDP360("ponto_real_manual", { filtros, limite: 5 }),
      lerDP360("ponto_caso", { filtros, limite: 5 }),
    ]);
    const chave = chaveDia(cr, dia);
    const rm = reaisManuais?.[0] || null;
    const caso = listaCasos?.[0] || null;
    const nova = diario?.[0] ? aplicarRealManual(diario[0], rm) : null;

    setCasos((mapa) => {
      const novo = { ...mapa };
      if (caso) novo[chave] = caso;
      else delete novo[chave];
      return novo;
    });
    if (!nova) return;
    setLinhas((ls) => ls.map((l) => (chaveDia(l.cracha, l.date_ref) === chave ? nova : l)));
    // O pop-up aberto recebe a MESMA linha nova: sem isto ele continuaria mostrando o
    // Real antigo enquanto a grade atrás dele já mostra o novo.
    setAberta((a) => (a && chaveDia(a.cracha, a.date_ref) === chave ? nova : a));
  }, []);

  /* ═══════════════════ AVISO AO TRABALHADOR (o robô do Transnet) ═══════════════════
     Três rotas, as mesmas do app antigo (app.js `avisarMotoristas`, `avisarInternos`,
     `avisarFora`). O que muda entre elas é QUEM entra, QUAL modelo e QUE caso abre —
     as regras estão em `../comunicadoTransnet`; aqui só se escolhe o escopo.        */

  const casoDe = useCallback((cracha, dia) => casos[chaveDia(cracha, dia)] || null, [casos]);

  // main.py `sc.tem_coluna("ponto_caso", "ponto_antes")`: a coluna existe em algumas
  // instalações e não em outras. Mandar coluna inexistente no upsert derruba o lote
  // inteiro, então a gente só a inclui quando VÊ a coluna numa linha já lida.
  const comPontoAntes = useMemo(
    () => Object.values(casos).some((c) => c && Object.prototype.hasOwnProperty.call(c, "ponto_antes")),
    [casos],
  );

  // Interno/aprendiz não tem operação (GPS/SST/bilhetagem) e a escala do cadastro é
  // lixo — o "normal" dele sai do PRÓPRIO histórico de batidas (main.py
  // `_jornada_normal`). Só o modelo "jornada curta" depende disso, então a leitura é
  // preguiçosa: só quando a aba está numa categoria de interno, e uma vez por sessão.
  const [medianas, setMedianas] = useState(null);
  const [carregandoMedianas, setCarregandoMedianas] = useState(false);
  const ehInterno = categoria !== "MOTORISTA";
  useEffect(() => {
    if (!ehInterno || medianas || carregandoMedianas) return undefined;
    let ativo = true;
    setCarregandoMedianas(true);
    lerTudoDP360(
      "ponto_diario",
      {
        colunas: "cracha,todas_batidas,categoria",
        filtros: { categoria: "in.(INTERNO,APRENDIZ)" },
        ordem: "date_ref.desc",
      },
      12,
    )
      .then((historico) => {
        if (ativo) setMedianas(medianasJornada(historico));
      })
      .catch(() => {
        // Sem histórico o aviso continua funcionando: os modelos "almoço curto" e
        // "registro incompleto" não dependem da mediana. Só a "jornada curta" fica de
        // fora — melhor não avisar do que avisar contra uma régua que não existe.
        if (ativo) setMedianas(new Map());
      })
      .finally(() => {
        if (ativo) setCarregandoMedianas(false);
      });
    return () => {
      ativo = false;
    };
  }, [ehInterno, medianas, carregandoMedianas]);

  const [envio, setEnvio] = useState(null);

  /* ---- rota 1: motorista com marcação faltando (app.js `avisarMotoristas`) ----
     Ponto invertido fica FORA: é defeito do cartão, não comunicado ao colaborador.
     Dia já conferido pelo DP também: ele decidiu que está certo. */
  const podeAvisarMotorista = useCallback(
    (l) =>
      String(l.status_ponto ?? "").toUpperCase() !== "OK" &&
      !pontoConferido(casos[chaveDia(l.cracha, l.date_ref)]) &&
      !ehPontoInvertido(l) &&
      !!marcacaoAusente(l),
    [casos],
  );
  const alvoMotoristas = useMemo(
    () => (ehInterno ? [] : visiveis.filter(podeAvisarMotorista)),
    [ehInterno, visiveis, podeAvisarMotorista],
  );
  // O ALVO CONGELADO do aviso. `sugBloqueio` é o porte de `_sug_bloqueio` e já é a
  // frase que a tela mostra quando o dia não pode ser usado ("não dá para avisar nem
  // lançar") — é ela que entra como motivo do barrado.
  const contratoDe = useCallback(
    (l) => contratoDaRevisao(l, bloqueios[chaveDia(l.cracha, l.date_ref)] ?? sugBloqueio(l)),
    [bloqueios],
  );
  const mensagemDeMotorista = useCallback(
    (l, tpls) => mensagemRevisaoMotorista(tpls.ocorrencia_motorista, l, marcacaoAusente(l)),
    [],
  );
  const abrirMotoristas = (alvo) =>
    setEnvio({
      rota: TIPO.REVMOT,
      titulo: `📣 Enviar ocorrência — ${alvo.length} motorista(s)`,
      ajuda:
        "A ferramenta identifica a marcação faltante. Com alvo confiável, a mensagem pede o ajuste no " +
        "horário; sem alvo, pede apenas o registro de ENTRADA, SAÍDA ou ambos.",
      linhas: alvo,
      chavesTemplate: ["ocorrencia_motorista"],
      templateEditavel: "ocorrencia_motorista",
      mensagemDe: mensagemDeMotorista,
      alvoDe: contratoDe,
      congelarReaviso: true,
    });

  /* ---- rota 2: interno/aprendiz, três modelos num envio só (`avisarInternos`) ---- */
  const rotasInternos = useMemo(() => {
    if (!ehInterno) return { alvo: [], pulados: 0 };
    const alvo = [];
    let pulados = 0;
    for (const l of visiveis) {
      if (pontoConferido(casos[chaveDia(l.cracha, l.date_ref)])) continue;
      const { modelo, divergencia } = rotaAvisoInterno(l, medianas);
      if (!modelo) {
        if (String(l.status_ponto ?? "").toUpperCase() === "REVISAR") pulados += 1;
        continue;
      }
      alvo.push({ ...l, __modelo: modelo, __divergencia: divergencia });
    }
    return { alvo, pulados };
  }, [ehInterno, visiveis, casos, medianas]);
  const mensagemDeInterno = useCallback((l, tpls) => mensagemInterno(tpls[`interno_${l.__modelo}`], l, l.__divergencia), []);
  const abrirInternos = (alvo) => {
    const conta = (m) => alvo.filter((l) => l.__modelo === m).length;
    setEnvio({
      rota: TIPO.INTERNO,
      titulo: `📣 Enviar ocorrência — ${alvo.length} interno(s)/aprendiz(es)`,
      ajuda:
        `${conta("almoco")} almoço curto (só comunica) · ${conta("incompleto")} registro incompleto ` +
        `(pede ajuste em 24 h) · ${conta("curta")} jornada curta (pede verificação). ` +
        "Cada linha já leva a mensagem do seu modelo.",
      linhas: alvo,
      chavesTemplate: ["interno_almoco", "interno_incompleto", "interno_curta"],
      templateEditavel: null, // são três modelos num envio só: editar um só confundiria
      mensagemDe: mensagemDeInterno,
      casoTipoDe: (l) => l.__modelo,
      // main.py `enviar_aviso_interno` NÃO congela o caso do interno, de propósito: é o
      // TIPO (almoco/incompleto/curta) que decide se o ciclo de 48 h corre. Travá-lo no
      // primeiro aviso deixaria um "incompleto" registrado como "almoço curto" e sem prazo.
      congelarReaviso: false,
      nota: rotasInternos.pulados
        ? `${rotasInternos.pulados} pendente(s) do dia não se encaixam em nenhum modelo e não recebem aviso.`
        : "",
    });
  };

  /* ---- rota 3: bateu ponto FORA de local conhecido (GPS) (`avisarFora`) ----
     JUSTIFICATIVA, não ajuste: este envio NÃO abre `ponto_caso` (ver
     comunicadoTransnet). Abrir poria a pessoa em "Meus avisos" como ajuste e ainda
     sobrescreveria o caso de gordura do mesmo dia. */
  const alvoFora = useMemo(
    () => visiveis.filter((l) => (gpsPorCracha[cra8(l.cracha)]?.fora || 0) > 0),
    [visiveis, gpsPorCracha],
  );
  const mensagemDeFora = useCallback(
    (l, tpls) => mensagemBateuFora(tpls.aviso_fora, l, gpsPorCracha[cra8(l.cracha)]),
    [gpsPorCracha],
  );
  const abrirFora = (alvo) =>
    setEnvio({
      rota: TIPO.FORA,
      titulo: `📍 Avisar quem bateu fora — ${alvo.length}`,
      ajuda:
        "Batida FORA de local conhecido (garagem/terminal), pelo GPS do app. A mensagem pede JUSTIFICATIVA, " +
        "não ajuste de horário — e por isso este envio não abre caso nem inicia prazo.",
      linhas: alvo,
      chavesTemplate: ["aviso_fora"],
      templateEditavel: "aviso_fora",
      mensagemDe: mensagemDeFora,
    });

  /* ---- o mesmo aviso, para UMA linha (botão do rodapé do cartão) ---- */
  const impedimentoAviso = useMemo(() => {
    if (!aberta) return "";
    if (pontoConferido(casos[chaveDia(aberta.cracha, aberta.date_ref)]))
      return "Este dia já foi marcado como conferido pelo DP — não há o que pedir.";
    if (ehInterno) {
      if (carregandoMedianas) return "Carregando o histórico de jornada do interno…";
      const { modelo } = rotaAvisoInterno(aberta, medianas);
      if (!modelo) return "Este dia não se encaixa em nenhum dos modelos de aviso de interno/aprendiz.";
      return "";
    }
    if (String(aberta.status_ponto ?? "").toUpperCase() === "OK") return "O dia está OK — não há o que pedir.";
    if (ehPontoInvertido(aberta))
      return "Ponto invertido é defeito do cartão: exige decisão manual do DP, não comunicado ao colaborador.";
    if (!marcacaoAusente(aberta))
      return "A ferramenta não identificou marcação de entrada ou saída faltando neste dia.";
    return contratoDe(aberta).erro;
  }, [aberta, casos, ehInterno, carregandoMedianas, medianas, contratoDe]);

  const avisarUmaLinha = (linha) => {
    if (!ehInterno) return abrirMotoristas([linha]);
    const { modelo, divergencia } = rotaAvisoInterno(linha, medianas);
    return abrirInternos([{ ...linha, __modelo: modelo, __divergencia: divergencia }]);
  };

  const chips = [
    ["TODOS", "TODOS"],
    ["REVISAR", "REVISAR"],
    ["OK", "OK"],
    ["FORA", "📍 FORA"],
  ];

  return (
    <AbaShell
      resumo="Cartão, fontes e decisão de ajuste. A régua é da view do Athena — esta tela só exibe o que já foi calculado."
      carregando={carregandoDatas && !datas.length}
      erro={erro}
      filtros={
        <>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select value={data} onChange={(e) => setData(e.target.value)}>
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
            className="dp-btn"
            title="Busca mais páginas de ponto_diario para trazer datas anteriores."
          >
            {carregandoDatas ? "carregando…" : "+ datas anteriores"}
          </button>

          {chips.map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltro(id)}
              className={`dp-chip-f ${filtro === id ? "on" : ""}`}
            >
              {rotulo} <span className="n">{contagens[id] || 0}</span>
            </button>
          ))}

          <span style={{ flex: 1 }} />

          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou crachá…"
            style={{ width: 230 }}
          />
          {/* O aviso vai para as linhas VISÍVEIS (o filtro e a busca da barra são a
              seleção). Quem não se encaixa na rota nem entra na conta; quem entra mas
              é barrado aparece no modal, com o motivo. */}
          {ehInterno ? (
            rotasInternos.alvo.length ? (
              <button
                type="button"
                className="dp-btn"
                onClick={() => abrirInternos(rotasInternos.alvo)}
                title="Almoço curto (comunica), registro incompleto (pede ajuste em 24 h) e jornada curta — os três num envio só."
              >
                📣 Enviar ocorrência ({rotasInternos.alvo.length})
              </button>
            ) : (
              <BotaoSemAlvo
                titulo={
                  carregandoMedianas
                    ? "Carregando o histórico de jornada do interno para decidir os modelos…"
                    : "Nenhum interno/aprendiz visível se encaixa nos modelos de aviso."
                }
              >
                📣 Enviar ocorrência
              </BotaoSemAlvo>
            )
          ) : alvoMotoristas.length ? (
            <button
              type="button"
              className="dp-btn"
              onClick={() => abrirMotoristas(alvoMotoristas)}
              title="Motoristas com marcação de entrada ou saída faltando. Com alvo, a mensagem pede o horário; sem alvo, pede o registro."
            >
              📣 Enviar ocorrência ({alvoMotoristas.length})
            </button>
          ) : (
            <BotaoSemAlvo titulo="Nenhum motorista visível com marcação de entrada ou saída faltando identificada.">
              📣 Enviar ocorrência
            </BotaoSemAlvo>
          )}
          {alvoFora.length ? (
            <button
              type="button"
              className="dp-btn"
              onClick={() => abrirFora(alvoFora)}
              title="Quem bateu ponto FORA de local conhecido (garagem/terminal), pelo GPS do app. Pede justificativa — não abre caso."
            >
              📍 Avisar quem bateu fora ({alvoFora.length})
            </button>
          ) : (
            <BotaoSemAlvo titulo="Ninguém com batida fora de local conhecido nas linhas visíveis.">
              📍 Avisar quem bateu fora
            </BotaoSemAlvo>
          )}
          <button type="button" onClick={() => carregarDia()} className="dp-btn">
            <RefreshCw size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> Atualizar
          </button>
        </>
      }
    >
      {/* O dia sem ponto importado NÃO entra no seletor (regra do original,
          main.py:7067). Mas some em silêncio lá, e aí ninguém entende por que
          ontem não está na lista — então ele aparece aqui, como aviso. */}
      {datasSemPonto.length > 0 && (
        <div className="dp-resumo" style={{ borderColor: "var(--dp-danger-line)" }}>
          <span className="dp-pill danger">ponto ainda não importado</span>{" "}
          <b>{datasSemPonto.slice(0, 5).map(fmtData).join(" · ")}</b>
          {datasSemPonto.length > 5 ? ` e mais ${datasSemPonto.length - 5}` : ""} — esses dias já têm
          escala na base, mas nenhuma batida chegou do Transnet, então não entram no seletor. Não é
          gente que faltou: é dia que não chegou.
        </div>
      )}

      {/* O que grava e o que ainda não — a distinção que importa é: nada aqui FALA com o
          trabalhador. Real manual e ponto conferido mexem só na base do DP. */}
      <div className="dp-resumo">
        <span className="dp-pill ok">✓ grava</span> <b>Real manual do DP</b> (ponto_real_manual) e{" "}
        <b>ponto conferido</b> (ponto_caso) — abra o cartão da linha. Os dois ficam na base do DP e
        podem ser desfeitos.{" "}
        <span className="dp-pill danger">📣 fala com o trabalhador</span> <b>Enviar ocorrência</b> e{" "}
        <b>avisar quem bateu fora</b> montam o CSV do Transnet e disparam o robô — sempre com{" "}
        <b>Ensaio</b> antes do envio de verdade. O envio de verdade abre/atualiza o caso do dia (e
        com ele o prazo de 48 h); o ensaio não abre nada. <b>Bateu fora</b> abre caso com
        origem <span className="dp-mono">fora</span> — é justificativa, não ajuste, e é a origem
        que mantém essa diferença.
      </div>

      {/* ---- legenda das cores da linha + contagem de sugestões ---- */}
      <div className="dp-resumo flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5">
          <i style={{ ...ESTILO_LEGENDA, background: "var(--dp-ok-bg)" }} /> ponto OK
        </span>
        <span className="flex items-center gap-1.5">
          <i style={{ ...ESTILO_LEGENDA, background: "var(--dp-warn-bg)" }} /> invertido ou com sugestão utilizável
        </span>
        <span className="flex items-center gap-1.5">
          <i style={{ ...ESTILO_LEGENDA, background: "var(--dp-accent-soft)" }} /> falta marcação identificada
        </span>
        <span className="flex items-center gap-1.5">
          <i style={{ ...ESTILO_LEGENDA, background: "var(--dp-danger-bg)" }} /> sem sugestão e sem ponta
          identificada
        </span>
        {!!comSugestao && <span style={{ marginLeft: "auto" }}>{comSugestao} com sugestão utilizável</span>}
      </div>

      {/* ---- grade (a compartilhada: ⚙ colunas, fixar, redimensionar, CSV, preferência
              salva em `tbl_p2`). O filtro é da aba; a grade só ordena o que recebe. ---- */}
      <TabelaDP
        chave="p2"
        colunas={colunas}
        linhas={visiveis}
        classeLinha={(l) => classeLinha(l, bloqueios[chaveDia(l.cracha, l.date_ref)])}
        idLinha={(l) => chaveDia(l.cracha, l.date_ref)}
        aoClicarLinha={(l) => setAberta(l)}
        carregando={carregando}
        mensagemCarregando={`Carregando a revisão de ${fmtData(data)}…`}
        vazio={linhas.length ? "Nada neste filtro." : "Nenhum cartão para esta categoria e data."}
        nomeCsv={`revisao_${String(categoria).toLowerCase()}_${data}`}
      />

      <p className="dp-resumo flex items-center gap-1.5" style={{ margin: 0, paddingBottom: 20 }}>
        <MapPin size={12} />
        Régua do GPS: mais de {RAIO_VEIC} m da posição do veículo (gps_carro) é "fora"; sem veículo, vale o local
        conhecido até {RAIO_LOCAL} m. Em dia de <b>reserva</b> ele não tem carro — batida em local conhecido vale
        por si. <b>n/m</b> = não medido: a âncora do veículo veio sem coordenada, e isso não conta como "junto".
        Tolerância do alvo: entrada −{TOL_ENTRADA_MIN} min, saída +{TOL_SAIDA_MIN} min.
      </p>

      {aberta && (
        <CartaoModal
          linha={aberta}
          caso={casos[chaveDia(aberta.cracha, aberta.date_ref)]}
          gps={gpsPorCracha[cra8(aberta.cracha)]}
          aoFechar={() => setAberta(null)}
          aoRecarregar={recarregarLinha}
          aoAvisar={avisarUmaLinha}
          impedimentoAviso={impedimentoAviso}
        />
      )}

      {/* O comunicado fica POR CIMA do cartão (z-index maior) em vez de fechá-lo: quem
          clicou em "Enviar ocorrência" continua vendo o dia que está cobrando. */}
      {envio && (
        <ModalComunicado
          {...envio}
          casoDe={casoDe}
          comPontoAntes={comPontoAntes}
          aoFechar={() => setEnvio(null)}
          aoConcluir={carregarDia}
        />
      )}
    </AbaShell>
  );
}
