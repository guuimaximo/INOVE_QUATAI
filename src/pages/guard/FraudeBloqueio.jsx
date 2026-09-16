// ============================================================================
// INOVE GUARD · FRAUDES · BLOQUEIO — o que bloquear hoje
//
// Porte da tela de bloqueio do PROGRAMA_FRAUDES (painel/painel_bloqueio.template.html),
// a que a bilhetagem abre de manhã. Pedido do dono (16/09/2026): "a tela de bloqueio +3
// dias".
//
// A FILA DO ROBÔ usa a regra PADRÃO (PROGRAMA_FRAUDES/fraudes/regra.py → fila.py) e chega
// em `fraude_bloqueio_cartao`, uma linha por CARTÃO:
//     rajada = 5 ou mais passagens efetivas (girou a catraca) dentro de 30 minutos
//              (eram 10 minutos até 16/09/2026 — o cartão 484361 passava devagar)
//     fraude = rajada em 3+ dias, seguidos ou não, nos últimos 15 dias da base
//              (era "3 dias seguidos" até 16/09/2026)
//
// A REGRA É MÓVEL NA ABA BLOQUEIO (16/09/2026, dono: "deixa móvel em campos / data de
// dias + 15 e aí eu escrevo / quantos dias com rajada / quantidade rajada / tempo total
// rajadas"). Os quatro números viram campos, e a aba RECALCULA a lista das passagens
// (`regraBloqueio.js`, o porte de regra.py — com o padrão, dá o mesmo resultado do robô).
// A fila do robô continua valendo para quem entra e sai sozinho; a tela só usa a situação
// gravada dela (bloqueado, "não é fraude") para tirar da lista quem já foi
// decidido. Cartão que só aparece com a regra da tela não tem linha: ao bloquear ou
// descartar, a tela CRIA a linha já com a decisão (o gateway não deixa criar pendente).
//
// O CICLO DO CARTÃO: pendente (a bloquear) → bloqueado ou descartado ("não é fraude").
// Desbloquear devolve para pendente (16/09/2026); `desbloqueado` só existe em linha antiga.
// Cada mudança grava a situação na fila E uma linha em
// `fraude_bloqueio_historico` (de → para, quem, motivo): é o que responde "quando
// bloqueamos este cartão?", que a base da bilhetagem não sabe dizer.
//
// O BLOQUEIO DE VERDADE É FEITO NO SISTEMA DA BILHETAGEM. Esta tela registra a decisão,
// guarda a prova e entrega o NÚMERO DO USUÁRIO pronto para copiar — o `id_usuario` (o
// "código" das planilhas), não o `cru_id`, que a tela chama de número do cartão
// (confirmado pelo nome nas levas de fevereiro e julho).
//
// 🔒 Quem grava é o gateway `dp360-api` (só Administrador), e só as colunas de fluxo.
//    O nome de quem bloqueou é o do login do INOVE, escrito pelo servidor.
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { atualizarDP360, inserirDP360, lerDP360, lerTudoDP360 } from "../../services/dp360Api";
import TabelaDP from "../dp360/TabelaDP";
import MapaPassagens from "./MapaPassagens";
import {
  LIMITES,
  REGRA_PADRAO,
  cartoesDaRegra,
  descreverRegra,
  diasDaJanela,
  ehPadrao,
  inicioDaJanela,
  rajadas,
  regraDosCampos,
} from "./regraBloqueio";

const TAB = "fraude_bloqueio_cartao";
const HIST = "fraude_bloqueio_historico";
const GIROS = "fraude_cartao_giros";
const OCORRENCIAS = "fraude_cartao_sequencial";

// O que a lista precisa das passagens e das ocorrências da janela (o resto só o pop-up lê)
const COLUNAS_GIROS = "id_evento,id_evento_final,cru_id,data_ref,giro_dthora,giro_efetuado";
const COLUNAS_OCORRENCIAS =
  "id_evento_final,id_usuario,id_tipo_cartao,id_empresa,valor_total_debitado,saldo,local_fraude,latitude,longitude,link_maps";
// 90 dias são ~41 mil passagens (medido na base até 13/09/2026: 15 dias = 6,5 mil)
const PAGINAS_DA_JANELA = 100;
// a regra só é relida quando a pessoa para de digitar
const ESPERA_DIGITAR_MS = 600;
// os números da regra ficam guardados neste navegador (a data não: ela segue a base)
const CHAVE_REGRA = "guard_bloqueio_regra";

// Linha nova (cartão que só aparece com a regra da tela): a evidência que a tela calculou
// e, da decisão, só o que o gateway aceita na criação.
const COLUNAS_EVIDENCIA = [
  "cru_id", "id_usuario", "tipo_cartao", "id_empresa", "dias_seguidos", "sequencia_de",
  "sequencia_ate", "qtd_sequencias", "dias_com_rajada", "rajadas", "maior_pico",
  "menor_janela_seg", "passagens", "valor_debitado", "saldo", "ultima_rajada",
  "local_fraude", "latitude", "longitude", "link_maps", "base_ate",
];
const CAMPOS_NA_CRIACAO = ["bloqueado_em", "bloqueado_por", "descartado_em", "observacao"];

// "ativo" = rajada nos últimos N dias DA BASE (não de hoje: a base tem defasagem)
const DIAS_ATIVO = 10;

// A aba Bloqueio mostra SÓ o que precisa bloquear; o resto do ciclo mora na aba "Cartões
// bloqueados" (dono, 16/09/2026: "ali eu quero na cara da pessoa o que precisa bloquear, e
// acabou / os bloqueados têm que ficar em outra aba").
// A aba "Cartões bloqueados" mostra SÓ os bloqueados (dono, 16/09/2026: "é apenas bloqueados
// nessa tela"). DESBLOQUEAR DEVOLVE O CARTÃO PARA A ABA BLOQUEIO ("se eu desbloquear ele volta
// de novo para a primeira tela e não pode ficar em desbloqueados"): a situação volta a
// `pendente` e a liberação fica em desbloqueado_em/por/motivo e no histórico. A situação
// `desbloqueado` só existe em linha antiga, e a tela a trata como "a bloquear". O "não é
// fraude" sai das duas listas e continua no Histórico, de onde o cartão abre e pode voltar.
const ROTULO_SITUACAO = {
  pendente: "a bloquear",
  bloqueado: "bloqueado",
  desbloqueado: "desbloqueado",
  descartado: "não é fraude",
  saiu_da_janela: "saiu da lista",
};
const TOM_SITUACAO = { pendente: "danger", bloqueado: "ok", desbloqueado: "warn", descartado: "mute" };

const ORDENS = [
  { k: "dias_com_rajada", rotulo: "Mais dias com rajada" },
  { k: "ultima_rajada", rotulo: "Rajada mais recente" },
  { k: "dias_seguidos", rotulo: "Mais dias seguidos" },
  { k: "valor_debitado", rotulo: "Maior valor" },
  { k: "saldo", rotulo: "Maior saldo" },
  { k: "maior_pico", rotulo: "Maior pico" },
];

const MOTIVOS_DESBLOQUEIO = [
  "Titular contestou e comprovou uso próprio",
  "Erro de leitura da catraca",
  "Bloqueio indevido — cartão de terceiro",
  "Decisão da gestão",
  "Outro",
];

/* ─────────────────────────────── utilidades ─────────────────────────────── */

const txt = (v) => String(v ?? "").trim();
const num = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const brl = (v) => num(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const situacaoDe = (c) => txt(c?.situacao) || "pendente";

// '2026-09-01' → '01/09/2026' por fatia de texto (passar por Date volta um dia no Brasil)
function paraBR(iso) {
  const s = txt(iso).slice(0, 10);
  return s.length === 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—";
}
const diaCurto = (iso) => paraBR(iso).slice(0, 5);
function horaDe(ts) {
  const m = /(\d{2}:\d{2}:\d{2})/.exec(txt(ts));
  return m ? m[1] : "";
}
// instante gravado (timestamptz) → data e hora de Brasília
function quandoBR(ts) {
  const t = Date.parse(txt(ts));
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function diaDoInstante(ts) {
  const t = Date.parse(txt(ts));
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(t));
}
function isoDataLocal(d) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

/** Dias entre a rajada e o ÚLTIMO DIA DA BASE — medir contra hoje faria o cartão mais
 *  recente parecer parado só porque a carga ainda não chegou. */
function diasAtras(dia, baseAte) {
  const d = txt(dia).slice(0, 10);
  if (!d) return 999;
  const ref = baseAte ? Date.parse(`${baseAte}T12:00:00`) : Date.now();
  return Math.round((ref - Date.parse(`${d}T12:00:00`)) / 86400000);
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

/* ─────────────────────────── caixa de códigos ───────────────────────────── */

/** O que a pessoa leva para o sistema da bilhetagem é o CÓDIGO (`id_usuario`): ele
 *  aparece grande e com botão de copiar — é o único dado que sai desta tela. */
function CaixaCodigos({ cartoes, titulo }) {
  const [copiado, setCopiado] = useState(false);
  const codigos = cartoes.map((c) => txt(c.id_usuario)).join("\n");
  return (
    <div>
      <div className="gd-rot">{titulo}</div>
      <div className="gd-copia">
        <span className="gd-cod">{cartoes.length === 1 ? txt(cartoes[0].id_usuario) : `${cartoes.length} números`}</span>
        <button
          type="button"
          className="dp-btn"
          onClick={async () => {
            if (await copiar(codigos)) {
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1500);
            }
          }}
        >
          {copiado ? "copiado ✓" : "copiar"}
        </button>
      </div>
      {cartoes.length > 1 ? (
        <div className="gd-cod-lista">
          {cartoes.map((c) => (
            <div key={c.cru_id}>
              <b className="dp-mono">{txt(c.id_usuario)}</b>{" "}
              <span className="dp-faint">— nº do cartão {txt(c.cru_id)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ─────────────────────────── janela de ação ─────────────────────────────── */

function JanelaAcao({ acao, onFechar, onConfirmar }) {
  const { tipo, cartoes } = acao;
  const um = cartoes.length === 1;
  const [obs, setObs] = useState(tipo === "anotar" ? txt(cartoes[0]?.observacao) : "");
  const [motivo, setMotivo] = useState(MOTIVOS_DESBLOQUEIO[0]);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState("");

  const titulo = {
    bloquear: um ? "Bloquear o cartão" : `Bloquear ${cartoes.length} cartões`,
    desbloquear: `Desbloquear o cartão ${txt(cartoes[0]?.cru_id)}`,
    descartar: "Marcar como não é fraude",
    reabrir: "Voltar para a fila",
    anotar: "Anotar",
  }[tipo];
  const botao = {
    bloquear: "Marcar como bloqueado",
    desbloquear: "Confirmar desbloqueio",
    descartar: "Não é fraude",
    reabrir: "Voltar para a fila",
    anotar: "Salvar",
  }[tipo];

  async function confirmar() {
    setGravando(true);
    setErro("");
    try {
      await onConfirmar({ obs: obs.trim(), motivo });
    } catch (e) {
      setErro(e?.message || "Não consegui gravar.");
      setGravando(false);
    }
  }

  return (
    <div
      className="gd-modal gd-modal-acima"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !gravando) onFechar();
      }}
    >
      <div className="gd-acao-box">
        <b style={{ fontSize: 15 }}>{titulo}</b>
        <div className="dp-muted" style={{ fontSize: 12.5, margin: "4px 0 10px", lineHeight: 1.5 }}>
          {tipo === "bloquear" &&
            "Registra o bloqueio aqui e o cartão sai da fila. O bloqueio em si é feito no sistema da bilhetagem — use o número do usuário abaixo."}
          {tipo === "desbloquear" && (
            <>
              Registra a liberação aqui e <b>o cartão volta para a aba Bloqueio</b>. O desbloqueio também precisa
              ser feito no sistema da bilhetagem — use o número do usuário abaixo.
            </>
          )}
          {tipo === "descartar" && "O cartão sai da fila sem pedido de bloqueio. Fica registrado quem descartou e por quê."}
          {tipo === "reabrir" && "O cartão volta para \"A bloquear\"."}
          {tipo === "anotar" && `Nº do cartão ${txt(cartoes[0]?.cru_id)} · nº do usuário ${txt(cartoes[0]?.id_usuario)}`}
        </div>

        {tipo === "bloquear" && (
          <CaixaCodigos
            cartoes={cartoes}
            titulo={um ? "Número do usuário para bloquear" : "Números dos usuários para bloquear"}
          />
        )}
        {tipo === "desbloquear" && <CaixaCodigos cartoes={cartoes} titulo="Número do usuário para desbloquear" />}

        {tipo === "desbloquear" && (
          <>
            <div className="gd-rot">Por que está liberando?</div>
            <select className="gd-campo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {MOTIVOS_DESBLOQUEIO.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </>
        )}

        {tipo !== "reabrir" && (
          <>
            <div className="gd-rot">
              {tipo === "descartar" ? "Por que não é fraude?" : tipo === "anotar" ? "Observação" : "Detalhe (opcional)"}
            </div>
            <textarea
              className="gd-campo"
              rows={3}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder={
                tipo === "bloquear"
                  ? "ex.: enviado no chamado 4821"
                  : tipo === "desbloquear"
                    ? "quem pediu, número do chamado..."
                    : tipo === "descartar"
                      ? "ex.: catraca travada, giros repetidos no mesmo segundo"
                      : ""
              }
              autoFocus
            />
          </>
        )}

        {erro ? (
          <div className="dp-pill danger" style={{ marginTop: 10 }} role="alert">
            {erro}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button type="button" className="dp-btn" onClick={onFechar} disabled={gravando}>
            Cancelar
          </button>
          <button
            type="button"
            className={`dp-btn ${tipo === "desbloquear" ? "gd-btn-perigo" : "primary"}`}
            onClick={confirmar}
            disabled={gravando}
          >
            {gravando ? "Gravando…" : botao}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── o cartão aberto ───────────────────────────── */

const DIA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIA_SEMANA_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
// meio-dia local: o dia da semana não escorrega com o fuso
const semanaDe = (iso) => new Date(`${txt(iso).slice(0, 10)}T12:00:00`).getDay();
const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Quantos quadrados por linha na faixa de dias: até 16 numa linha só; mais que isso, no
 *  máximo 3 linhas (90 dias = 3 linhas de 30, e aí o quadrado fica compacto). */
const diasPorLinha = (n) => (n <= 16 ? n : Math.max(15, Math.ceil(n / 3)));

function lerRegraGuardada() {
  const padrao = Object.fromEntries(Object.entries(REGRA_PADRAO).map(([k, v]) => [k, String(v)]));
  try {
    const r = JSON.parse(window.localStorage.getItem(CHAVE_REGRA) || "null");
    if (r && typeof r === "object") {
      return Object.fromEntries(Object.keys(REGRA_PADRAO).map((k) => [k, String(r[k] ?? padrao[k])]));
    }
  } catch {
    /* navegador sem armazenamento: fica o padrão */
  }
  return padrao;
}

// 243 → "4min03s"; 58 → "58s"
function duracao(seg) {
  const s = Math.max(0, Math.round(num(seg)));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}min${String(s % 60).padStart(2, "0")}s`;
}

/** O que aconteceu numa linha do histórico, em palavras. `quem = "deteccao"` é o robô;
 *  `de === para` é anotação (a situação não mudou). */
function acaoDoHistorico(h) {
  const de = txt(h.de);
  const para = txt(h.para);
  if (txt(h.quem) === "deteccao") {
    // desbloqueado que voltou a fazer rajada: o robô devolve para a fila (fila.py)
    if (para === "pendente") return de ? "voltou para a fila" : "entrou na fila";
    if (para === "saiu_da_janela") return "saiu da lista";
    return ROTULO_SITUACAO[para] || para;
  }
  if (de && de === para) return "anotou";
  // desbloqueio: até 16/09/2026 ia para "desbloqueado"; agora o cartão volta para a fila
  if (para === "desbloqueado" || (para === "pendente" && de === "bloqueado")) return "desbloqueou";
  return (
    {
      bloqueado: de === "desbloqueado" ? "bloqueou de novo" : "bloqueou",
      descartado: "marcou como não é fraude",
      pendente: "voltou para a fila",
    }[para] || para
  );
}
const TOM_ACAO = { bloqueado: "ok", desbloqueado: "warn", descartado: "mute", pendente: "danger", saiu_da_janela: "mute" };
function tomDoHistorico(h) {
  if (txt(h.de) && txt(h.de) === txt(h.para)) return "mute";
  if (acaoDoHistorico(h) === "desbloqueou") return "warn";
  return TOM_ACAO[txt(h.para)] || "mute";
}
// "tela" sobra só se o servidor não achou o nome do login
const quemFez = (h) => {
  const q = txt(h.quem);
  if (q === "deteccao") return "regra automática";
  if (!q || q === "tela") return "INOVE (sem nome)";
  return q;
};

// o motivo da regra automática é a descrição inteira dela; na linha do tempo basta a base
function detalheDoHistorico(h) {
  const m = txt(h.motivo);
  if (txt(h.quem) !== "deteccao") return m;
  // a volta para a fila traz a frase do robô; as datas dela vêm em ISO
  if (txt(h.de)) return m.replace(/base ate/g, "base até").replace(/(\d{4})-(\d{2})-(\d{2})/g, "$3/$2/$1");
  const base = /base ate (\d{4}-\d{2}-\d{2})/.exec(m);
  const ate = base ? `base até ${paraBR(base[1])}` : "";
  if (txt(h.para) === "saiu_da_janela") {
    return `sem rajada em ${REGRA_PADRAO.diasComRajada} dias nos últimos ${REGRA_PADRAO.dias} dias${ate ? ` · ${ate}` : ""}`;
  }
  return ate;
}

/**
 * O HISTÓRICO DE UM CARTÃO, num pop-up por cima do cartão (pedido do dono, 16/09/2026:
 * "quando clicar no cartão já aparece o histórico desse cartão / faz um botão que abre
 * outro pop-up"). Tudo o que aconteceu com ele, do mais novo para o mais antigo: quem
 * bloqueou, desbloqueou, descartou, devolveu ou anotou (nome do login do INOVE) e as
 * entradas e saídas automáticas da regra.
 */
function HistoricoDoCartao({ cartao, historico, carregando, onFechar }) {
  useEffect(() => {
    const tecla = (e) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);
  const pessoas = historico.filter((h) => txt(h.quem) !== "deteccao").length;

  return (
    <div
      className="gd-modal gd-modal-acima"
      role="dialog"
      aria-modal="true"
      aria-label={`Histórico do cartão ${txt(cartao.cru_id)}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div className="gd-acao-box gd-bqm-histbox">
        <div className="gd-bqm-histhead">
          <div>
            <b style={{ fontSize: 16 }}>Histórico do cartão</b>
            <div className="dp-faint" style={{ fontSize: 12.5, marginTop: 2 }}>
              nº do usuário <b className="dp-mono">{txt(cartao.id_usuario) || "—"}</b> · nº do cartão{" "}
              <span className="dp-mono">{txt(cartao.cru_id)}</span> · {pessoas} ação(ões) de pessoas ·{" "}
              {historico.length - pessoas} da regra automática
            </div>
          </div>
          <button type="button" className="dp-btn" onClick={onFechar} aria-label="Fechar">
            ✕
          </button>
        </div>
        {carregando ? (
          <div className="gd-hint">Carregando o histórico…</div>
        ) : historico.length ? (
          <ol className="gd-bqm-tempo">
            {historico.map((h) => (
              <li key={h.id} className={`t-${tomDoHistorico(h)}`}>
                <div className="topo">
                  <span className={`dp-pill ${tomDoHistorico(h)}`}>{acaoDoHistorico(h)}</span>
                  <b>{quemFez(h)}</b>
                  <span className="dp-mono dp-faint quando">{quandoBR(h.em)}</span>
                </div>
                {txt(h.de) && txt(h.de) !== txt(h.para) ? (
                  <div className="dp-faint">estava: {ROTULO_SITUACAO[txt(h.de)] || txt(h.de)}</div>
                ) : null}
                {detalheDoHistorico(h) ? <div>{detalheDoHistorico(h)}</div> : null}
              </li>
            ))}
          </ol>
        ) : (
          <div className="dp-faint">Sem registro ainda.</div>
        )}
      </div>
    </div>
  );
}

/** Um dado do cartão no topo do pop-up (dono, 16/09/2026: "os dados do cartão precisam ter
 *  no topo também — número do cartão, número do usuário, tipo de cartão"). */
function FichaDoCartao({ rotulo, valor, copiavel = false, classe = "", dica }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className={`gd-bqm-ficha ${classe}`} title={dica}>
      <span className="gd-bqm-rot">{rotulo}</span>
      <span className="v">
        <b>{valor || "—"}</b>
        {copiavel && valor ? (
          <button
            type="button"
            className="dp-btn gd-bqm-mini"
            onClick={async () => {
              if (await copiar(valor)) {
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1500);
              }
            }}
          >
            {copiado ? "copiado ✓" : "copiar"}
          </button>
        ) : null}
      </span>
    </div>
  );
}

/** Uma rajada na lista da esquerda. */
function ItemRajada({ b, on, fora, onClick }) {
  return (
    <button
      type="button"
      className={`gd-bqm-item${on ? " on" : ""}${fora ? " fora" : ""}`}
      title={fora ? "Fora da janela da regra — não conta" : undefined}
      onClick={onClick}
    >
      <span className="d">
        <span className="dp-faint">{DIA_SEMANA[semanaDe(b.dia)]}</span> {paraBR(b.dia)}
      </span>
      <span className="v">
        {b.pico} em {duracao(b.dur)}
      </span>
      <span className="l">{b.local || "—"}</span>
      <span className="r">{brl(b.valor)}</span>
    </button>
  );
}

/**
 * O POP-UP DO CARTÃO (redesenhado em 16/09/2026 — "ta muito jogado"). Em faixas, de
 * cima para baixo: quem é o cartão e o que fazer · os números da prova · os 15 dias da
 * regra, um quadrado por dia (é a repetição em dias diferentes que denuncia o cartão) ·
 * embaixo, as rajadas à esquerda e o dia aberto (mapa + passagens) à direita, ocupando
 * o resto da altura. O histórico abre em outro pop-up pelo botão do cabeçalho, que já
 * mostra a última movimentação.
 */
function CartaoAberto({ cartao, baseAte, regra = REGRA_PADRAO, podeAnotar = true, onFechar, onAcao }) {
  const [giros, setGiros] = useState(null);
  const [historico, setHistorico] = useState(null);
  const [verHistorico, setVerHistorico] = useState(false);
  const [erro, setErro] = useState("");
  const [blocoAberto, setBlocoAberto] = useState("");
  const [foco, setFoco] = useState(null);
  const cru = txt(cartao.cru_id);

  useEffect(() => {
    let vivo = true;
    setGiros(null);
    setErro("");
    Promise.all([
      lerTudoDP360(GIROS, { filtros: { cru_id: `eq.${cru}` }, ordem: "giro_dthora.asc" }),
      lerTudoDP360(HIST, { filtros: { cru_id: `eq.${cru}` }, ordem: "id.desc" }).catch(() => []),
    ])
      .then(([g, h]) => {
        if (!vivo) return;
        setGiros(g || []);
        setHistorico(h || []);
      })
      .catch((e) => {
        if (vivo) setErro(e?.message || "Não consegui ler as passagens deste cartão.");
      });
    return () => {
      vivo = false;
    };
  }, [cru, cartao.situacao, cartao.observacao]);

  const blocos = useMemo(() => rajadas(giros || [], regra, { detalhe: true }), [giros, regra]);
  const janela = useMemo(() => diasDaJanela(baseAte, regra.dias), [baseAte, regra.dias]);
  const inicioJanela = janela[0] || "";
  const naJanela = (dia) => !!inicioJanela && dia >= inicioJanela && dia <= baseAte;
  const dentro = blocos.filter((b) => naJanela(b.dia));
  const antes = blocos.filter((b) => !naJanela(b.dia));
  // a pior rajada de cada dia: é a que o quadrado do dia abre
  const piorDoDia = useMemo(() => {
    const m = new Map();
    for (const b of blocos) if (!m.has(b.dia) || b.pico > m.get(b.dia).pico) m.set(b.dia, b);
    return m;
  }, [blocos]);
  const aberto = blocos.find((b) => b.id === blocoAberto) || dentro[0] || blocos[0] || null;
  const abrir = (id) => {
    setBlocoAberto(id);
    setFoco(null);
  };

  const pontos = useMemo(
    () =>
      (aberto?.passagens || [])
        .filter((g) => txt(g.latitude) && txt(g.longitude))
        .map((g) => ({
          id: g._id,
          lat: num(g.latitude),
          lon: num(g.longitude),
          rotulo: String(g._n),
          efetiva: true,
          hora: `${diaCurto(g.data_ref)} ${horaDe(g.giro_dthora)}`,
          placa: txt(g.vei_placa),
          valor: brl(g.valor),
          local: txt(g.local_fraude),
        })),
    [aberto],
  );

  const s = situacaoDe(cartao);
  const atras = diasAtras(cartao.ultima_rajada, baseAte);
  const diasComRajada = giros === null ? num(cartao.dias_com_rajada) : new Set(dentro.map((b) => b.dia)).size;
  const local = txt(cartao.local_fraude);
  const placasDoDia = aberto ? [...new Set(aberto.passagens.map((g) => txt(g.vei_placa)).filter(Boolean))] : [];
  const ultima = historico?.[0] || null;

  return (
    <>
    <div
      className="gd-modal gd-modal-bqm"
      role="dialog"
      aria-modal="true"
      aria-label={`Cartão ${cru}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div className="gd-modal-box gd-bqm">
        {/* ── quem é e o que fazer ── */}
        <div className="gd-modal-head gd-bqm-head">
          <div className="gd-bqm-id">
            <div className="gd-bqm-fichas">
              <FichaDoCartao rotulo="Número do cartão" valor={cru} copiavel classe="num" />
              <FichaDoCartao
                rotulo="Número do usuário"
                valor={txt(cartao.id_usuario)}
                copiavel
                classe="num destaque"
                dica="É o número que se usa para bloquear e desbloquear no sistema da bilhetagem"
              />
              <FichaDoCartao rotulo="Tipo de cartão" valor={txt(cartao.tipo_cartao) || "não informado"} classe="texto" />
              <span className={`dp-pill ${TOM_SITUACAO[s]}`}>{ROTULO_SITUACAO[s]}</span>
            </div>
            <div className="sub gd-bqm-local" title={local || undefined}>
              {local || "sem endereço"}
            </div>
            <div className="sub gd-bqm-ultima">
              {historico === null ? (
                "lendo o histórico…"
              ) : ultima ? (
                <>
                  última movimentação: <b>{acaoDoHistorico(ultima)}</b> · {quemFez(ultima)} ·{" "}
                  <span className="dp-mono">{quandoBR(ultima.em)}</span>
                </>
              ) : (
                "sem histórico ainda"
              )}
            </div>
          </div>
          <div className="gd-det-acoes">
            <button
              type="button"
              className="dp-btn gd-bqm-btn-hist"
              onClick={() => setVerHistorico(true)}
              disabled={historico === null}
              title="Quem bloqueou, desbloqueou ou mexeu neste cartão, e quando"
            >
              Histórico <span className="n">{historico === null ? "…" : historico.length}</span>
            </button>
            {txt(cartao.link_maps) ? (
              <a className="dp-btn" href={cartao.link_maps} target="_blank" rel="noreferrer">
                Abrir no Maps ↗
              </a>
            ) : null}
            {s === "pendente" && (
              <>
                <button type="button" className="dp-btn primary" onClick={() => onAcao("bloquear", [cartao])}>
                  Bloquear este cartão
                </button>
                <button type="button" className="dp-btn" onClick={() => onAcao("descartar", [cartao])}>
                  Não é fraude
                </button>
              </>
            )}
            {s === "bloqueado" && (
              <button type="button" className="dp-btn gd-btn-perigo" onClick={() => onAcao("desbloquear", [cartao])}>
                Desbloquear
              </button>
            )}
            {s === "desbloqueado" && (
              <button type="button" className="dp-btn primary" onClick={() => onAcao("bloquear", [cartao])}>
                Bloquear de novo
              </button>
            )}
            {s === "descartado" && (
              <button type="button" className="dp-btn" onClick={() => onAcao("reabrir", [cartao])}>
                Voltar para a fila
              </button>
            )}
            {podeAnotar ? (
              <button type="button" className="dp-btn" onClick={() => onAcao("anotar", [cartao])}>
                Anotar
              </button>
            ) : null}
            <button type="button" className="dp-btn" onClick={onFechar} aria-label="Fechar">
              ✕
            </button>
          </div>
        </div>

        {/* ── os números da prova ── */}
        <div className="gd-bqm-resumo">
          <div className="gd-bqm-kpi al">
            <span>Dias com rajada</span>
            <b>
              {diasComRajada} <small>de {regra.dias}</small>
            </b>
            <em>a regra pede {regra.diasComRajada}</em>
          </div>
          <div className="gd-bqm-kpi">
            <span>Rajadas</span>
            <b>{num(cartao.rajadas)}</b>
            <em>{num(cartao.passagens)} passagens</em>
          </div>
          <div className="gd-bqm-kpi">
            <span>Maior pico</span>
            <b>
              {num(cartao.maior_pico)} <small>passagens</small>
            </b>
            <em>janela mais curta {duracao(cartao.menor_janela_seg)}</em>
          </div>
          <div className="gd-bqm-kpi">
            <span>Debitado</span>
            <b>{brl(cartao.valor_debitado)}</b>
            <em>nas rajadas dos {regra.dias} dias</em>
          </div>
          <div className="gd-bqm-kpi">
            <span>Saldo</span>
            <b>{brl(cartao.saldo)}</b>
            <em>no cartão</em>
          </div>
          <div className="gd-bqm-kpi">
            <span>Última rajada</span>
            <b>{paraBR(cartao.ultima_rajada).slice(0, 5)}</b>
            <em>{atras <= 0 ? "no último dia da base" : `${atras} dia${atras === 1 ? "" : "s"} antes do fim da base`}</em>
          </div>
        </div>
        {txt(cartao.observacao) ? (
          <div className="gd-bqm-obs">
            <b>Observação:</b> {cartao.observacao}
          </div>
        ) : null}

        {/* ── os 15 dias da regra ── */}
        {janela.length ? (
          <div className="gd-bqm-faixa-box">
            <div className="gd-bqm-faixa-tit">
              <b>
                {regra.dias === 1 ? "O dia" : `Os ${regra.dias} dias`} da regra
              </b>
              <span className="dp-faint">
                {paraBR(inicioJanela)} a {paraBR(baseAte)} · o número é o pico de passagens do dia · clique para ver
              </span>
            </div>
            <div
              className={`gd-bqm-faixa${diasPorLinha(janela.length) > 20 ? " compacta" : ""}`}
              style={{ "--dias-linha": diasPorLinha(janela.length) }}
            >
              {janela.map((d) => {
                const b = piorDoDia.get(d);
                const sem = semanaDe(d);
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!b}
                    className={`gd-bqm-d${b ? " tem" : ""}${aberto?.dia === d ? " on" : ""}${
                      sem === 0 || sem === 6 ? " fds" : ""
                    }`}
                    title={`${DIA_SEMANA_LONGO[sem]}, ${paraBR(d)} · ${
                      b ? `${b.pico} passagens em ${duracao(b.dur)}` : "sem rajada"
                    }`}
                    onClick={() => b && abrir(b.id)}
                  >
                    <span className="s">{DIA_SEMANA[sem]}</span>
                    <span className="n">{diaCurto(d)}</span>
                    <span className="p">{b ? b.pico : "–"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {erro ? (
          <div className="gd-modal-erro">
            <span className="dp-pill danger">{erro}</span>
          </div>
        ) : null}

        {/* ── rajadas e histórico | o dia aberto ── */}
        <div className="gd-bqm-corpo">
          <aside className="gd-bqm-lado">
            <div className="gd-bqm-sec">
              Rajadas <span className="dp-faint">· {blocos.length}</span>
            </div>
            {giros === null && !erro ? <div className="gd-hint">Carregando as passagens…</div> : null}
            {giros !== null && !blocos.length ? <div className="gd-hint">Sem rajada na base para este cartão.</div> : null}
            {dentro.length ? (
              <div className="gd-bqm-grupo">
                Na janela da regra ({regra.dias} dias) · {dentro.length}
              </div>
            ) : null}
            {dentro.map((b) => (
              <ItemRajada key={b.id} b={b} on={aberto?.id === b.id} onClick={() => abrir(b.id)} />
            ))}
            {antes.length ? (
              <div className="gd-bqm-grupo">Fora da janela · {antes.length} — não contam para a regra</div>
            ) : null}
            {antes.map((b) => (
              <ItemRajada key={b.id} b={b} on={aberto?.id === b.id} fora onClick={() => abrir(b.id)} />
            ))}
          </aside>

          <section className="gd-bqm-dia">
            {aberto ? (
              <>
                <div className="gd-bqm-dia-tit">
                  <div>
                    <b>
                      {maiuscula(DIA_SEMANA_LONGO[semanaDe(aberto.dia)])}, {paraBR(aberto.dia)}
                    </b>{" "}
                    {naJanela(aberto.dia) ? null : <span className="dp-pill mute">fora da janela da regra</span>}
                  </div>
                  <div className="dp-faint">
                    {aberto.passagens.length} passagens · pior janela <b>{aberto.pico}</b> em {duracao(aberto.dur)} ·{" "}
                    {brl(aberto.valor)} · {placasDoDia.length ? placasDoDia.join(", ") : "sem veículo"} ·{" "}
                    {aberto.local || "sem endereço"}
                  </div>
                </div>
                <div className="gd-bqm-dia-grade">
                  <div className="gd-bqm-mapa">
                    <MapaPassagens pontos={pontos} foco={foco} altura="100%" legenda={false} />
                  </div>
                  <div className="gd-bqm-tab">
                    <table className="dp-tabela">
                      <thead>
                        <tr>
                          <th className="dp-num">#</th>
                          <th>Hora</th>
                          <th className="dp-num">Intervalo</th>
                          <th>Veículo</th>
                          <th className="dp-num">Valor</th>
                          <th className="dp-num">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aberto.passagens.map((g) => (
                          <tr
                            key={g._id}
                            className={`${g._id === foco ? "gd-foco" : ""}${g._janela ? " gd-bqm-pior" : ""}`}
                            onMouseEnter={() => setFoco(g._id)}
                            title={g._janela ? `dentro da pior janela de ${regra.minutos} minutos` : ""}
                          >
                            <td className="dp-num">{g._n}</td>
                            <td className="dp-mono">{horaDe(g.giro_dthora)}</td>
                            <td className="dp-num">{g._gap == null ? "—" : duracao(g._gap)}</td>
                            <td className="dp-mono">{txt(g.vei_placa) || "—"}</td>
                            <td className="dp-num">{brl(g.valor)}</td>
                            <td className="dp-num">{brl(g.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="gd-hint gd-bqm-leg">
                  <span className="gd-bqm-marca" /> pior janela de {regra.minutos} minutos do dia · o número do pino é a ordem da
                  passagem · o bloco é sempre o mesmo endereço, então os pinos ficam um em cima do outro · passe o mouse
                  numa linha para achar o ponto
                </div>
              </>
            ) : (
              <div className="gd-bqm-vazio">
                {giros === null && !erro ? "Carregando as passagens…" : "Nenhuma rajada para mostrar."}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
    {verHistorico ? (
      <HistoricoDoCartao
        cartao={cartao}
        historico={historico || []}
        carregando={historico === null}
        onFechar={() => setVerHistorico(false)}
      />
    ) : null}
    </>
  );
}

/* ──────────────────────────── histórico geral ───────────────────────────── */

/** Quem bloqueou, desbloqueou, descartou ou devolveu cada cartão, e quando — o nome é o
 *  do login do INOVE, escrito pelo servidor (`dp360-api`, `autorEm`). As entradas e
 *  saídas automáticas da regra ficam escondidas por padrão. */
function HistoricoBloqueio({ historico, cartoes, termo, carregando, onAbrir }) {
  const [comRegra, setComRegra] = useState(false);
  const existe = useMemo(() => new Set(cartoes.map((c) => txt(c.cru_id))), [cartoes]);
  const linhas = useMemo(() => {
    const t = termo.trim().toLowerCase();
    return historico
      // a volta de um desbloqueado para a fila aparece sempre: é decisão da regra sobre um cartão já tratado
      .filter((h) => comRegra || txt(h.quem) !== "deteccao" || (txt(h.de) && txt(h.para) === "pendente"))
      .filter(
        (h) =>
          !t ||
          [h.id_usuario, h.cru_id, h.quem, h.motivo, acaoDoHistorico(h)].some((v) => txt(v).toLowerCase().includes(t)),
      );
  }, [historico, comRegra, termo]);
  const pessoas = historico.filter((h) => txt(h.quem) !== "deteccao");
  const conta = (f) => pessoas.filter(f).length;

  const colunas = useMemo(
    () => [
      {
        id: "em",
        titulo: "Quando",
        largura: 150,
        classe: "dp-mono",
        valor: (h) => txt(h.em),
        render: (h) => quandoBR(h.em),
      },
      {
        id: "acao",
        titulo: "O que foi feito",
        largura: 190,
        valor: (h) => acaoDoHistorico(h),
        render: (h) => <span className={`dp-pill ${tomDoHistorico(h)}`}>{acaoDoHistorico(h)}</span>,
      },
      { id: "quem", titulo: "Quem", largura: 190, valor: (h) => quemFez(h) },
      {
        id: "id_usuario",
        titulo: "Nº do usuário",
        largura: 110,
        classe: "dp-mono",
        valor: (h) => txt(h.id_usuario),
        render: (h) => <b className="gd-cod-lin">{txt(h.id_usuario) || "—"}</b>,
      },
      { id: "cru_id", titulo: "Nº do cartão", largura: 100, classe: "dp-mono", valor: (h) => txt(h.cru_id) },
      {
        id: "de",
        titulo: "Estava",
        largura: 110,
        valor: (h) => ROTULO_SITUACAO[txt(h.de)] || txt(h.de),
        render: (h) => (txt(h.de) ? ROTULO_SITUACAO[txt(h.de)] || txt(h.de) : <span className="dp-faint">—</span>),
      },
      { id: "motivo", titulo: "Detalhe", largura: 340, valor: (h) => txt(h.motivo) },
    ],
    [],
  );

  return (
    <>
      <div className="gd-bq-kpis">
        <div className="gd-bq-kpi ok">
          <b>{conta((h) => acaoDoHistorico(h).startsWith("bloqueou"))}</b>
          <span>bloqueios</span>
        </div>
        <div className="gd-bq-kpi">
          <b>{conta((h) => acaoDoHistorico(h) === "desbloqueou")}</b>
          <span>desbloqueios</span>
        </div>
        <div className="gd-bq-kpi">
          <b>{conta((h) => acaoDoHistorico(h) === "marcou como não é fraude")}</b>
          <span>não é fraude</span>
        </div>
        <div className="gd-bq-kpi">
          <b>{new Set(pessoas.map((h) => quemFez(h))).size}</b>
          <span>pessoas que mexeram</span>
        </div>
      </div>
      <div className="dp-viewbar" style={{ paddingTop: 4 }}>
        <label className="gd-bqm-check">
          <input type="checkbox" checked={comRegra} onChange={(e) => setComRegra(e.target.checked)} />
          mostrar também as entradas e saídas automáticas da regra
        </label>
      </div>
      <TabelaDP
        chave="guard_bloqueio_historico"
        colunas={colunas}
        linhas={linhas}
        carregando={carregando}
        mensagemCarregando="Carregando o histórico…"
        idLinha={(h) => String(h.id)}
        aoClicarLinha={(h) => (existe.has(txt(h.cru_id)) ? onAbrir(txt(h.cru_id)) : null)}
        nomeCsv={`bloqueio_historico_${isoDataLocal(new Date())}`}
        vazio={
          comRegra
            ? "Nenhum registro."
            : "Ninguém bloqueou, desbloqueou ou descartou cartão pelo INOVE ainda."
        }
        pinPadrao={1}
      />
    </>
  );
}

/* ─────────────────────────── os campos da regra ─────────────────────────── */

/**
 * OS QUATRO NÚMEROS DA REGRA, editáveis (dono, 16/09/2026). A janela termina no último dia
 * com passagem na base, ou na data escolhida. Campo inválido fica vermelho e, enquanto
 * isso, vale o número do padrão (ou o limite mais próximo).
 */
function CamposDaRegra({ campos, onCampo, regra, ate, fimBase, onAte, onPadrao, lendo, comparacao, truncada, baseParadaHa }) {
  const padrao = ehPadrao(regra) && (!ate || ate === fimBase);
  const numero = (k, rotulo) => {
    const [min, limite] = LIMITES[k];
    const max = k === "diasComRajada" ? Math.min(limite, regra.dias) : limite;
    const bruto = String(campos[k] ?? "");
    const n = Number(bruto);
    const invalido = bruto.trim() === "" || !Number.isInteger(n) || n < min || n > max;
    return (
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={bruto}
        className={`${invalido ? "erro" : ""}${regra[k] !== REGRA_PADRAO[k] ? " mudou" : ""}`}
        onChange={(e) => onCampo(k, e.target.value)}
        aria-label={rotulo}
        title={
          invalido
            ? `Use um número de ${min} a ${max} — enquanto isso vale ${regra[k]}`
            : `padrão do robô: ${REGRA_PADRAO[k]}`
        }
      />
    );
  };

  return (
    <section className="gd-regra" aria-label="Regra da lista">
      <div className="gd-regra-campos">
        <div className="gd-regra-campo">
          <span className="rot">Janela</span>
          <span className="val">
            últimos {numero("dias", "Quantos dias")} dias até
            <input
              type="date"
              value={ate || ""}
              max={fimBase || undefined}
              className={ate && fimBase && ate !== fimBase ? "mudou" : ""}
              onChange={(e) => onAte(e.target.value)}
              aria-label="Até o dia"
              title={fimBase ? `a base tem passagem até ${paraBR(fimBase)}` : undefined}
            />
          </span>
        </div>
        <div className="gd-regra-campo">
          <span className="rot">Dias com rajada</span>
          <span className="val">
            {numero("diasComRajada", "Quantos dias com rajada")} ou mais <em>seguidos ou não</em>
          </span>
        </div>
        <div className="gd-regra-campo">
          <span className="rot">Quantidade na rajada</span>
          <span className="val">{numero("passagens", "Quantas passagens na rajada")} passagens ou mais</span>
        </div>
        <div className="gd-regra-campo">
          <span className="rot">Tempo da rajada</span>
          <span className="val">em até {numero("minutos", "Tempo da rajada em minutos")} min</span>
        </div>
        <button
          type="button"
          className="dp-btn gd-regra-padrao"
          onClick={onPadrao}
          disabled={padrao}
          title={`A regra do robô: ${descreverRegra(REGRA_PADRAO)}, até o último dia da base`}
        >
          Voltar ao padrão
        </button>
      </div>
      <div className="gd-regra-rodape">
        <span>
          {ate ? (
            <>
              período <b>{paraBR(inicioDaJanela(ate, regra.dias))}</b> a <b>{paraBR(ate)}</b>
            </>
          ) : (
            "base sem data"
          )}
        </span>
        <span className="dp-faint">· só conta passagem que girou a catraca</span>
        {lendo ? <span className="dp-pill">lendo as passagens…</span> : null}
        {!ehPadrao(regra) ? (
          <span className="dp-pill warn" title="O robô continua pondo e tirando cartões da fila pelo padrão">
            regra diferente da do robô ({descreverRegra(REGRA_PADRAO)})
          </span>
        ) : null}
        {comparacao?.novos ? (
          <span className="dp-pill warn" title="Cartões que o robô não pôs na fila: só aparecem com esta regra">
            {comparacao.novos} fora da fila do robô
          </span>
        ) : null}
        {comparacao?.deFora ? (
          <span className="dp-pill mute" title="Estão na fila do robô, mas não passam nesta regra — ficam escondidos">
            {comparacao.deFora} da fila do robô não entram
          </span>
        ) : null}
        {truncada ? <span className="dp-pill danger">leitura cortada — diminua os dias</span> : null}
        {baseParadaHa > 3 ? (
          <span className="dp-pill warn">
            a base de passagens está {baseParadaHa} dias atrás — só anda quando o robô de fraudes roda
          </span>
        ) : null}
      </div>
    </section>
  );
}

/* ──────────────────────────────── a aba ──────────────────────────────────── */

/** CARTÃO QUE SÓ APARECE COM A REGRA DA TELA não tem linha na fila: a decisão cria a linha,
 *  com a evidência calculada e a situação já decidida (o gateway recusa criar pendente e
 *  escreve o autor). Se o robô pôs o cartão na fila nesse meio-tempo, a criação bate na
 *  chave e a decisão vira a mudança de situação de sempre. */
async function criarLinha(c, situacao, mudancas, rotulo) {
  const linha = { situacao };
  for (const k of COLUNAS_EVIDENCIA) linha[k] = c[k] ?? null;
  for (const k of CAMPOS_NA_CRIACAO) if (mudancas[k] != null) linha[k] = mudancas[k];
  try {
    await inserirDP360(TAB, [linha], rotulo);
  } catch (e) {
    const msg = String(e?.message || "");
    if (/409|duplicate|conflict/i.test(msg)) {
      await atualizarDP360(TAB, { cru_id: `eq.${txt(c.cru_id)}` }, { situacao, ...mudancas }, rotulo);
      return;
    }
    if (/não liberada/i.test(msg)) {
      throw new Error(
        `O cartão ${txt(c.cru_id)} só aparece com a regra desta tela e o servidor ainda não aceita gravá-lo — avise o administrador.`,
      );
    }
    throw e;
  }
}

/** O cartão voltou de um desbloqueio? Devolve o dia (ISO) ou "". Bloquear de novo limpa. */
function desbloqueadoEm(c) {
  return situacaoDe(c) === "bloqueado" ? "" : diaDoInstante(c?.desbloqueado_em);
}

/** A última rajada é de um dia DEPOIS do bloqueio? (o dia do bloqueio não conta: a
 *  bilhetagem pode levar o dia para aplicar). Devolve a data da rajada ou "". */
function rajadaDepoisDoBloqueio(c) {
  const dia = diaDoInstante(c?.bloqueado_em);
  const ultima = txt(c?.ultima_rajada).slice(0, 10);
  return dia && ultima && ultima > dia ? ultima : "";
}

/**
 * `modo="fila"` (aba Bloqueio): só os cartões A BLOQUEAR, pela regra dos campos.
 * `modo="gestao"` (aba Cartões bloqueados): só os bloqueados, e o histórico. Desbloqueado que volta a fazer rajada volta sozinho para a fila — quem faz isso
 * é o robô (PROGRAMA_FRAUDES/fraudes/fila.py).
 */
export default function FraudeBloqueio({ modo = "fila" }) {
  const gestao = modo === "gestao";
  const [cartoes, setCartoes] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [aba, setAba] = useState(gestao ? "bloqueado" : "pendente");
  const [termo, setTermo] = useState("");
  const [ordem, setOrdem] = useState("dias_com_rajada");
  const [selecionados, setSelecionados] = useState([]);
  const [aberto, setAberto] = useState("");
  const [acao, setAcao] = useState(null);
  const [recado, setRecado] = useState(null);

  // ── a regra móvel (só na aba Bloqueio) ──
  const [campos, setCampos] = useState(lerRegraGuardada);
  const regra = useMemo(() => regraDosCampos(campos), [campos]);
  const [ateEscolhido, setAteEscolhido] = useState("");
  const [fimBase, setFimBase] = useState("");
  const [janelaLida, setJanelaLida] = useState(null);
  const [lendoJanela, setLendoJanela] = useState(false);
  const [erroJanela, setErroJanela] = useState("");
  const [recargaJanela, setRecargaJanela] = useState(0);
  const [chavePedida, setChavePedida] = useState("");
  const jaLeuJanela = useRef(false);

  useEffect(() => {
    if (gestao) return;
    try {
      window.localStorage.setItem(CHAVE_REGRA, JSON.stringify(campos));
    } catch {
      /* navegador sem armazenamento: a regra vale só nesta visita */
    }
  }, [campos, gestao]);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro("");
    Promise.all([
      lerTudoDP360(TAB, { ordem: "cru_id.asc" }),
      // o histórico não pode derrubar a fila: sem ele, só a aba Histórico fica vazia
      lerTudoDP360(HIST, { ordem: "id.desc" }).catch(() => []),
      // o último dia com passagem: é onde a janela da regra termina
      gestao
        ? Promise.resolve([])
        : lerDP360(GIROS, { colunas: "data_ref", ordem: "data_ref.desc", limite: 1 }).catch(() => []),
    ])
      .then(([linhas, hist, ultimo]) => {
        if (!vivo) return;
        setCartoes(linhas || []);
        setHistorico(hist || []);
        if (!gestao) setFimBase(txt(ultimo?.[0]?.data_ref).slice(0, 10));
      })
      .catch((e) => {
        if (vivo) setErro(e?.message || "Não consegui ler a fila de bloqueio.");
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [recarga, gestao]);

  const baseAte = useMemo(
    () => cartoes.map((c) => txt(c.base_ate).slice(0, 10)).filter(Boolean).sort().pop() || "",
    [cartoes],
  );
  // onde a janela da regra termina: a data escolhida, ou o último dia com passagem
  const fimDaBase = fimBase || baseAte;
  const ate = ateEscolhido && fimDaBase && ateEscolhido < fimDaBase ? ateEscolhido : fimDaBase;
  // a base parada é informação de operação: a fila não anda se a detecção não roda
  const baseParadaHa = fimDaBase ? diasAtras(isoDataLocal(new Date()), fimDaBase) * -1 : 0;

  /* AS PASSAGENS DA JANELA. Só os dias e a data pedem leitura nova; passagens, minutos e
     dias com rajada recalculam em cima do que já veio. A leitura espera a pessoa parar de
     digitar (a primeira sai na hora). */
  const chaveJanela = !gestao && ate ? `${inicioDaJanela(ate, regra.dias)}|${ate}` : "";
  useEffect(() => {
    if (!chaveJanela) return undefined;
    const t = setTimeout(() => setChavePedida(chaveJanela), jaLeuJanela.current ? ESPERA_DIGITAR_MS : 0);
    return () => clearTimeout(t);
  }, [chaveJanela]);

  useEffect(() => {
    if (!chavePedida) return undefined;
    let vivo = true;
    const [de, fimJanela] = chavePedida.split("|");
    const periodo = { data_ref: [`gte.${de}`, `lte.${fimJanela}`] };
    setLendoJanela(true);
    setErroJanela("");
    Promise.all([
      lerTudoDP360(GIROS, { colunas: COLUNAS_GIROS, filtros: periodo, ordem: "id_evento.asc" }, PAGINAS_DA_JANELA),
      lerTudoDP360(
        OCORRENCIAS,
        { colunas: COLUNAS_OCORRENCIAS, filtros: periodo, ordem: "id_evento_final.asc" },
        PAGINAS_DA_JANELA,
      ),
    ])
      .then(([giros, ocorrencias]) => {
        if (!vivo) return;
        jaLeuJanela.current = true;
        setJanelaLida({
          chave: chavePedida,
          giros: giros || [],
          ocorrencias: new Map((ocorrencias || []).map((o) => [txt(o.id_evento_final), o])),
          truncada: (giros || []).length >= PAGINAS_DA_JANELA * 1000,
        });
      })
      .catch((e) => {
        if (vivo) setErroJanela(e?.message || "Não consegui ler as passagens da janela.");
      })
      .finally(() => {
        if (vivo) setLendoJanela(false);
      });
    return () => {
      vivo = false;
    };
  }, [chavePedida, recargaJanela]);

  const janelaPronta = !gestao && !!janelaLida && janelaLida.chave === chaveJanela;
  const calculados = useMemo(
    () => (janelaPronta ? cartoesDaRegra(janelaLida.giros, janelaLida.ocorrencias, regra, ate) : null),
    [janelaPronta, janelaLida, regra, ate],
  );

  /* A LISTA A BLOQUEAR = quem a regra pegou, menos quem já tem decisão gravada: bloqueado e
     "não é fraude" saem. Desbloqueado fica (desbloquear devolve para esta aba). Cartão sem
     linha é marcado `_naFila: false`: a decisão sobre ele CRIA a linha. */
  const porCru = useMemo(() => new Map(cartoes.map((c) => [txt(c.cru_id), c])), [cartoes]);
  const fila = useMemo(() => {
    if (!calculados) return [];
    const lista = [];
    for (const l of calculados) {
      const gravado = porCru.get(l.cru_id);
      const s = gravado ? situacaoDe(gravado) : "pendente";
      if (s === "bloqueado" || s === "descartado") continue;
      lista.push(gravado ? { ...gravado, ...l, _naFila: true } : { ...l, situacao: "pendente", _naFila: false });
    }
    return lista;
  }, [calculados, porCru]);

  const comparacao = useMemo(() => {
    if (!calculados) return null;
    const naRegra = new Set(calculados.map((l) => l.cru_id));
    return {
      novos: fila.filter((c) => !c._naFila).length,
      deFora: cartoes.filter((c) => situacaoDe(c) === "pendente" && !naRegra.has(txt(c.cru_id))).length,
    };
  }, [calculados, fila, cartoes]);

  // os dias "atrás" contam até o fim da janela na aba Bloqueio, e até a base na gestão
  const refDias = gestao ? baseAte : ate;

  const contagem = useMemo(() => {
    const c = {};
    cartoes.forEach((x) => {
      c[situacaoDe(x)] = (c[situacaoDe(x)] || 0) + 1;
    });
    return c;
  }, [cartoes]);

  const kpis = useMemo(() => {
    const p = gestao ? [] : fila;
    const soma = (l, k) => l.reduce((s, x) => s + num(x[k]), 0);
    return {
      pendentes: p.length,
      ativos: p.filter((c) => diasAtras(c.ultima_rajada, refDias) <= DIAS_ATIVO).length,
      debitado: soma(p, "valor_debitado"),
      saldo: soma(p, "saldo"),
      // bloqueado que fez rajada DEPOIS do dia do bloqueio: o bloqueio não pegou na bilhetagem
      passandoBloqueado: cartoes.filter((c) => situacaoDe(c) === "bloqueado" && rajadaDepoisDoBloqueio(c)).length,
    };
  }, [cartoes, fila, gestao, refDias]);

  const visiveis = useMemo(() => {
    const t = termo.trim().toLowerCase();
    return (gestao ? cartoes.filter((c) => situacaoDe(c) === aba) : fila)
      .filter((c) =>
        !t || [c.id_usuario, c.cru_id, c.local_fraude, c.tipo_cartao].some((v) => txt(v).toLowerCase().includes(t)),
      )
      .sort((a, b) =>
        ordem === "ultima_rajada"
          ? txt(b.ultima_rajada).localeCompare(txt(a.ultima_rajada))
          : num(b[ordem]) - num(a[ordem]),
      );
  }, [cartoes, fila, gestao, aba, termo, ordem]);

  const colunas = useMemo(() => {
    const base = [
      {
        id: "id_usuario",
        titulo: "Nº do usuário",
        largura: 110,
        classe: "dp-mono",
        valor: (c) => txt(c.id_usuario),
        render: (c) => <b className="gd-cod-lin">{txt(c.id_usuario)}</b>,
      },
      { id: "cru_id", titulo: "Nº do cartão", largura: 100, classe: "dp-mono", valor: (c) => txt(c.cru_id) },
      { id: "tipo_cartao", titulo: "Tipo de cartão", largura: 160, valor: (c) => txt(c.tipo_cartao) },
      {
        id: "dias_com_rajada",
        titulo: "Dias c/ rajada",
        largura: 96,
        classe: "dp-num",
        valor: (c) => num(c.dias_com_rajada),
        render: (c) =>
          num(c.dias_com_rajada) > (gestao ? REGRA_PADRAO : regra).diasComRajada ? (
            <span className="dp-pill danger">{num(c.dias_com_rajada)} dias</span>
          ) : (
            num(c.dias_com_rajada)
          ),
      },
      {
        id: "dias_seguidos",
        titulo: "Seguidos",
        largura: 76,
        classe: "dp-num dp-faint",
        valor: (c) => num(c.dias_seguidos),
      },
      {
        id: "periodo",
        titulo: "Primeira → última",
        largura: 150,
        valor: (c) => `${paraBR(c.sequencia_de)} a ${paraBR(c.sequencia_ate)}`,
        render: (c) => (
          <span className="dp-faint">
            {diaCurto(c.sequencia_de)} a {paraBR(c.sequencia_ate)}
          </span>
        ),
      },
      { id: "maior_pico", titulo: "Pico", largura: 60, classe: "dp-num", valor: (c) => num(c.maior_pico) },
      { id: "rajadas", titulo: "Rajadas", largura: 70, classe: "dp-num", valor: (c) => num(c.rajadas) },
      {
        id: "valor_debitado",
        titulo: "Valor",
        largura: 100,
        classe: "dp-num",
        valor: (c) => num(c.valor_debitado),
        render: (c) => brl(c.valor_debitado),
      },
      {
        id: "saldo",
        titulo: "Saldo",
        largura: 96,
        classe: "dp-num",
        valor: (c) => num(c.saldo),
        render: (c) => brl(c.saldo),
      },
      {
        id: "ultima_rajada",
        titulo: "Última",
        largura: 120,
        valor: (c) => txt(c.ultima_rajada),
        render: (c) => (
          <span>
            {paraBR(c.ultima_rajada)}{" "}
            <span className="dp-faint">({diasAtras(c.ultima_rajada, refDias)}d)</span>
          </span>
        ),
      },
    ];
    if (!gestao) {
      // de onde o cartão veio: da fila do robô ou só da regra da tela — e se voltou de um desbloqueio
      base.splice(2, 0, {
        id: "origem",
        titulo: "Origem",
        largura: 190,
        valor: (c) =>
          (c._naFila === false ? "só nesta regra" : "fila do robô") +
          (desbloqueadoEm(c) ? ` · desbloqueado ${paraBR(desbloqueadoEm(c))}` : ""),
        render: (c) => (
          <span className="gd-origem">
            {c._naFila === false ? (
              <span className="dp-pill warn" title="O robô não pôs este cartão na fila: ele só aparece com a regra desta tela">
                só nesta regra
              </span>
            ) : (
              <span className="dp-faint">fila do robô</span>
            )}
            {desbloqueadoEm(c) ? (
              <span
                className="dp-pill danger"
                title={`Desbloqueado em ${quandoBR(c.desbloqueado_em)}${
                  txt(c.desbloqueado_por) ? ` por ${txt(c.desbloqueado_por)}` : ""
                }${txt(c.motivo_desbloqueio) ? ` — ${txt(c.motivo_desbloqueio)}` : ""}`}
              >
                desbloqueado {paraBR(desbloqueadoEm(c)).slice(0, 5)}
              </span>
            ) : null}
          </span>
        ),
      });
    }
    if (aba === "bloqueado") {
      base.push(
        { id: "bloqueado_em", titulo: "Bloqueado em", largura: 140, valor: (c) => quandoBR(c.bloqueado_em) },
        { id: "bloqueado_por", titulo: "Por", largura: 150, valor: (c) => txt(c.bloqueado_por) },
        {
          id: "rajada_depois",
          titulo: "Rajada depois?",
          largura: 130,
          valor: (c) => rajadaDepoisDoBloqueio(c),
          render: (c) => {
            const dia = rajadaDepoisDoBloqueio(c);
            return dia ? (
              <span className="dp-pill danger" title="Fez rajada depois do dia do bloqueio — confira se a bilhetagem bloqueou">
                sim · {paraBR(dia).slice(0, 5)}
              </span>
            ) : (
              <span className="dp-faint">não</span>
            );
          },
        },
      );
    }
    if (aba !== "pendente") {
      base.push({ id: "observacao", titulo: "Observação", largura: 220, valor: (c) => txt(c.observacao) });
    }
    return base;
  }, [aba, gestao, regra, refDias]);

  const cartaoAberto = (gestao ? cartoes : fila).find((c) => txt(c.cru_id) === aberto) || null;
  const marcados = visiveis.filter((c) => selecionados.includes(txt(c.cru_id)));

  /* GRAVA: a situação na fila e uma linha de histórico por cartão. O histórico vai depois
     de todos os cartões: se um falhar no meio, o que já mudou fica registrado com a
     mensagem do erro, e a tela relê a fila para mostrar o estado real. */
  const aplicar = useCallback(async (lista, situacao, mudancas, motivo, rotulo) => {
    // o "de" do histórico é lido ANTES de gravar — depois disso a linha já diz "para"
    const antes = new Map(lista.map((c) => [txt(c.cru_id), c._naFila === false ? null : situacaoDe(c)]));
    const feitos = [];
    try {
      for (const c of lista) {
        if (c._naFila === false) await criarLinha(c, situacao, mudancas, rotulo);
        else await atualizarDP360(TAB, { cru_id: `eq.${txt(c.cru_id)}` }, { situacao, ...mudancas }, rotulo);
        feitos.push(c);
      }
    } finally {
      if (feitos.length) {
        await inserirDP360(
          HIST,
          feitos.map((c) => ({
            cru_id: txt(c.cru_id),
            id_usuario: txt(c.id_usuario) || null,
            de: antes.get(txt(c.cru_id)) || null,
            para: situacao,
            quem: "tela",          // o servidor troca pelo nome de quem está logado
            motivo: motivo || null,
          })),
          rotulo,
        ).catch(() => {
          setRecado({ tom: "warn", texto: "A situação foi gravada, mas o histórico não — avise o administrador." });
        });
        setRecarga((n) => n + 1);
      }
    }
  }, []);

  const confirmarAcao = useCallback(
    async ({ obs, motivo }) => {
      const { tipo, cartoes: lista } = acao;
      const agora = new Date().toISOString(); // instante (timestamptz), não data local
      // o histórico guarda com que regra a pessoa viu o cartão, quando não é a do robô
      const naRegra = !gestao && !ehPadrao(regra) ? ` · regra da tela: ${descreverRegra(regra)}` : "";
      if (tipo === "bloquear") {
        await aplicar(
          lista,
          "bloqueado",
          {
            bloqueado_em: agora,
            bloqueado_por: "tela",
            desbloqueado_em: null,
            desbloqueado_por: null,
            motivo_desbloqueio: null,
            observacao: obs || null,
          },
          (obs || "bloqueado") + naRegra,
          "Bloqueio de cartão (fraude)",
        );
      } else if (tipo === "desbloquear") {
        // desbloqueou, VOLTA PARA A ABA BLOQUEIO; a liberação fica registrada nas colunas e no histórico
        const texto = motivo + (obs ? ` — ${obs}` : "");
        await aplicar(
          lista,
          "pendente",
          { desbloqueado_em: agora, desbloqueado_por: "tela", motivo_desbloqueio: texto },
          texto,
          "Desbloqueio de cartão (fraude)",
        );
      } else if (tipo === "descartar") {
        await aplicar(
          lista,
          "descartado",
          { descartado_em: agora, observacao: obs || null },
          (obs || "sem motivo informado") + naRegra,
          "Cartão descartado (não é fraude)",
        );
      } else if (tipo === "reabrir") {
        await aplicar(lista, "pendente", {}, "voltou para a fila", "Cartão voltou para a fila");
      } else if (tipo === "anotar") {
        const c = lista[0];
        await atualizarDP360(TAB, { cru_id: `eq.${txt(c.cru_id)}` }, { observacao: obs || null }, "Anotação no cartão (fraude)");
        await inserirDP360(
          HIST,
          [
            {
              cru_id: txt(c.cru_id),
              id_usuario: txt(c.id_usuario) || null,
              de: situacaoDe(c),
              para: situacaoDe(c),
              quem: "tela", // o servidor troca pelo nome de quem está logado
              motivo: obs ? `anotação: ${obs}` : "anotação apagada",
            },
          ],
          "Anotação no cartão (fraude)",
        ).catch(() => {
          setRecado({ tom: "warn", texto: "A anotação foi gravada, mas o histórico não — avise o administrador." });
        });
        setRecarga((n) => n + 1);
      }
      setRecado({
        tom: "ok",
        texto:
          tipo === "anotar"
            ? "Anotação salva."
            : tipo === "desbloquear"
              ? `${lista.length} cartão(ões) desbloqueado(s) — de volta na aba Bloqueio.`
              : `${lista.length} cartão(ões) → ${ROTULO_SITUACAO[
                { bloquear: "bloqueado", desbloquear: "desbloqueado", descartar: "descartado", reabrir: "pendente" }[tipo]
              ]}.`,
      });
      setAcao(null);
      if (tipo !== "anotar") setAberto("");
      setSelecionados([]);
    },
    [acao, aplicar, gestao, regra],
  );

  const copiarDaAba = async () => {
    if (!visiveis.length) return setRecado({ tom: "warn", texto: "Nada para copiar nesta aba." });
    const ok = await copiar(visiveis.map((c) => txt(c.id_usuario)).join("\n"));
    setRecado(
      ok
        ? { tom: "ok", texto: `${visiveis.length} número(s) de usuário copiado(s).` }
        : { tom: "danger", texto: "O navegador não deixou copiar." },
    );
  };

  return (
    <>
      <div className="dp-viewbar">
        <div className="dp-busca">
          <Search size={14} />
          <input
            type="search"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="nº do usuário, nº do cartão ou local…"
            aria-label="Buscar cartão"
          />
        </div>
        {aba !== "historico" ? (
          <>
            <select value={ordem} onChange={(e) => setOrdem(e.target.value)} aria-label="Ordenar por">
              {ORDENS.map((o) => (
                <option key={o.k} value={o.k}>
                  {o.rotulo}
                </option>
              ))}
            </select>
            <button type="button" className="dp-btn" onClick={copiarDaAba}>
              Copiar nº dos usuários
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="dp-btn"
          onClick={() => {
            setRecarga((n) => n + 1);
            if (!gestao) setRecargaJanela((n) => n + 1);
          }}
          disabled={carregando || lendoJanela}
        >
          <RefreshCw size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
          Recarregar
        </button>
        {recado ? <span className={`dp-pill ${recado.tom}`}>{recado.texto}</span> : null}
      </div>

      {gestao ? (
        <div className="gd-hint">
          Só os cartões <b>bloqueados</b> pelo INOVE. <b>Desbloqueou, o cartão volta para a aba Bloqueio.</b> Quem
          bloqueou, desbloqueou ou marcou "não é fraude", e quando, fica no <b>Histórico</b> — clique numa linha para
          abrir o cartão. {baseAte ? `Base até ${paraBR(baseAte)}.` : ""}
        </div>
      ) : (
        <CamposDaRegra
          campos={campos}
          onCampo={(k, v) => setCampos((atual) => ({ ...atual, [k]: v }))}
          regra={regra}
          ate={ate}
          fimBase={fimDaBase}
          onAte={setAteEscolhido}
          onPadrao={() => {
            setCampos(Object.fromEntries(Object.entries(REGRA_PADRAO).map(([k, v]) => [k, String(v)])));
            setAteEscolhido("");
          }}
          lendo={lendoJanela}
          comparacao={comparacao}
          truncada={janelaPronta && janelaLida.truncada}
          baseParadaHa={baseParadaHa}
        />
      )}

      {gestao ? (
        <div className="gd-bq-kpis">
          <div className="gd-bq-kpi ok">
            <b>{contagem.bloqueado || 0}</b>
            <span>bloqueados</span>
          </div>
          <div className={`gd-bq-kpi${kpis.passandoBloqueado ? " al" : ""}`}>
            <b>{kpis.passandoBloqueado}</b>
            <span>bloqueados com rajada depois</span>
          </div>
        </div>
      ) : (
        <div className="gd-bq-kpis">
          <div className="gd-bq-kpi al">
            <b>{kpis.pendentes}</b>
            <span>a bloquear</span>
          </div>
          <div className="gd-bq-kpi al">
            <b>{kpis.ativos}</b>
            <span>ativos (últimos {DIAS_ATIVO} dias)</span>
          </div>
          <div className="gd-bq-kpi">
            <b>{brl(kpis.debitado)}</b>
            <span>debitado nas rajadas</span>
          </div>
          <div className="gd-bq-kpi">
            <b>{brl(kpis.saldo)}</b>
            <span>saldo a recuperar</span>
          </div>
        </div>
      )}

      {gestao ? (
      <div className="dp-viewbar" style={{ paddingTop: 4 }}>
        <button
          type="button"
          className={`dp-chip-f${aba === "bloqueado" ? " on" : ""}`}
          onClick={() => {
            setAba("bloqueado");
            setSelecionados([]);
          }}
        >
          Bloqueados <span className="n">{contagem.bloqueado || 0}</span>
        </button>
        <button
          type="button"
          className={`dp-chip-f${aba === "historico" ? " on" : ""}`}
          onClick={() => {
            setAba("historico");
            setSelecionados([]);
          }}
          title="Quem bloqueou, desbloqueou ou descartou cada cartão, e quando"
        >
          Histórico <span className="n">{historico.filter((h) => txt(h.quem) !== "deteccao").length}</span>
        </button>
      </div>
      ) : null}

      {erro || (!gestao && erroJanela) ? (
        <div className="dp-resumo">
          <span className="dp-pill danger">{erro || erroJanela}</span>
        </div>
      ) : null}

      {aba === "historico" ? (
        <HistoricoBloqueio
          key={`historico-${recarga}`}
          historico={historico}
          cartoes={cartoes}
          termo={termo}
          carregando={carregando}
          onAbrir={setAberto}
        />
      ) : (
      <TabelaDP
        key={`${aba}-${recarga}`}
        chave={`guard_bloqueio_${aba}`}
        colunas={colunas}
        linhas={visiveis}
        carregando={carregando || (!gestao && !janelaPronta && !erroJanela)}
        mensagemCarregando={gestao ? "Carregando os cartões…" : "Lendo as passagens e aplicando a regra…"}
        idLinha={(c) => txt(c.cru_id)}
        aoClicarLinha={(c) => setAberto(txt(c.cru_id))}
        selecionavel={aba === "pendente"}
        aoSelecionar={(ids) => setSelecionados(ids)}
        classeLinha={(c) => (diasAtras(c.ultima_rajada, refDias) <= DIAS_ATIVO && aba === "pendente" ? "row-p1" : "")}
        nomeCsv={`bloqueio_${aba}_${isoDataLocal(new Date())}`}
        vazio={aba === "pendente" ? "Nada a bloquear com esta regra. 👍" : "Nenhum cartão nesta situação."}
        pinPadrao={1}
        acoes={
          aba === "pendente" ? (
            <button
              type="button"
              className="dp-btn primary"
              disabled={!marcados.length}
              onClick={() => setAcao({ tipo: "bloquear", cartoes: marcados })}
            >
              {marcados.length ? `Bloquear ${marcados.length} selecionado(s)` : "Bloquear selecionados"}
            </button>
          ) : null
        }
      />
      )}

      {cartaoAberto ? (
        <CartaoAberto
          cartao={cartaoAberto}
          baseAte={gestao ? baseAte : ate}
          regra={gestao ? REGRA_PADRAO : regra}
          podeAnotar={cartaoAberto._naFila !== false}
          onFechar={() => setAberto("")}
          onAcao={(tipo, lista) => setAcao({ tipo, cartoes: lista })}
        />
      ) : null}
      {acao ? <JanelaAcao acao={acao} onFechar={() => setAcao(null)} onConfirmar={confirmarAcao} /> : null}
    </>
  );
}
