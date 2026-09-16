// ============================================================================
// INOVE GUARD · FRAUDES · BLOQUEIO — o que bloquear hoje
//
// Porte da tela de bloqueio do PROGRAMA_FRAUDES (painel/painel_bloqueio.template.html),
// a que a bilhetagem abre de manhã. Pedido do dono (16/09/2026): "a tela de bloqueio +3
// dias".
//
// A REGRA NÃO MORA AQUI. Quem decide que um cartão entra na fila é o bot
// (PROGRAMA_FRAUDES/fraudes/regra.py → fila.py), e a fila chega pronta em
// `fraude_bloqueio_cartao`, uma linha por CARTÃO:
//     rajada = 5 ou mais passagens efetivas (girou a catraca) dentro de 10 minutos
//     fraude = rajada em 3+ dias, seguidos ou não, nos últimos 15 dias da base
//              (era "3 dias seguidos" até 16/09/2026)
// A tela refaz a janela deslizante só para DESENHAR a evidência (quais passagens formam
// a pior janela de cada dia).
//
// O CICLO DO CARTÃO são quatro situações — pendente (a bloquear), bloqueado,
// desbloqueado e descartado. Cada mudança grava a situação na fila E uma linha em
// `fraude_bloqueio_historico` (de → para, quem, motivo): é o que responde "quando
// bloqueamos este cartão?", que a base da bilhetagem não sabe dizer.
//
// O BLOQUEIO DE VERDADE É FEITO NO SISTEMA DA BILHETAGEM. Esta tela registra a decisão,
// guarda a prova e entrega o CÓDIGO pronto para copiar — e o código é o `id_usuario`,
// não o `cru_id` (confirmado pelo nome nas levas de fevereiro e julho).
//
// 🔒 Quem grava é o gateway `dp360-api` (só Administrador), e só as colunas de fluxo.
//    O nome de quem bloqueou é o do login do INOVE, escrito pelo servidor.
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { atualizarDP360, inserirDP360, lerDP360, lerTudoDP360 } from "../../services/dp360Api";
import TabelaDP from "../dp360/TabelaDP";
import MapaPassagens from "./MapaPassagens";

const TAB = "fraude_bloqueio_cartao";
const HIST = "fraude_bloqueio_historico";
const GIROS = "fraude_cartao_giros";

// Só para desenhar a evidência — a mesma régua de fraudes/regra.py.
const MIN_PASSAGENS = 5;
const JANELA_SEG = 10 * 60;
// A regra (16/09/2026): rajada em 3+ dias, SEGUIDOS OU NÃO, nos últimos 15 dias da
// base. Antes eram 3 dias seguidos — quem usava qui/sex, parava no fim de semana e
// voltava na segunda escapava. Quem sai da janela ainda pendente sai da fila (o
// robô registra no histórico como `saiu_da_janela`).
const DIAS_COM_RAJADA = 3;
const JANELA_DIAS = 15;
// "ativo" = rajada nos últimos N dias DA BASE (não de hoje: a base tem defasagem)
const DIAS_ATIVO = 10;

const SITUACOES = [
  { k: "pendente", rotulo: "A bloquear" },
  { k: "bloqueado", rotulo: "Bloqueados" },
  { k: "desbloqueado", rotulo: "Desbloqueados" },
  { k: "descartado", rotulo: "Descartados" },
];
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
function isoDataLocal(d) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}
// "2026-09-01 07:12:33" → segundos (relógio local, só para diferença entre passagens)
const segundos = (ts) => Date.parse(txt(ts).replace(" ", "T")) / 1000;

/** Dias entre a rajada e o ÚLTIMO DIA DA BASE — medir contra hoje faria o cartão mais
 *  recente parecer parado só porque a carga ainda não chegou. */
function diasAtras(dia, baseAte) {
  const d = txt(dia).slice(0, 10);
  if (!d) return 999;
  const ref = baseAte ? Date.parse(`${baseAte}T12:00:00`) : Date.now();
  return Math.round((ref - Date.parse(`${d}T12:00:00`)) / 86400000);
}

// passagem efetiva = girou a catraca (a origem manda 1/"1"/true)
const girou = (g) => g?.giro_efetuado === true || String(g?.giro_efetuado) === "1";

/**
 * AS RAJADAS DO CARTÃO, dia a dia — a evidência que sustenta o pedido.
 * Cada bloco (mesmo cartão, mesmo endereço) com 5+ passagens efetivas vira rajada se a
 * pior janela de 10 min (dois ponteiros sobre a lista ordenada) tiver 5+ passagens.
 */
function rajadasDoCartao(giros) {
  const porBloco = new Map();
  for (const g of giros || []) {
    const k = txt(g.id_evento_final);
    if (!porBloco.has(k)) porBloco.set(k, []);
    porBloco.get(k).push(g);
  }
  const blocos = [];
  for (const [id, linhas] of porBloco) {
    const passagens = linhas.filter(girou).sort((a, b) => txt(a.giro_dthora).localeCompare(txt(b.giro_dthora)));
    if (passagens.length < MIN_PASSAGENS) continue;
    const t = passagens.map((g) => segundos(g.giro_dthora));
    let melhor = 0;
    let ini = 0;
    let faixa = [0, 0];
    for (let f = 0; f < t.length; f += 1) {
      while (t[f] - t[ini] >= JANELA_SEG) ini += 1;
      if (f - ini + 1 > melhor) {
        melhor = f - ini + 1;
        faixa = [ini, f];
      }
    }
    if (melhor < MIN_PASSAGENS) continue;
    blocos.push({
      id,
      dia: txt(passagens[0].data_ref).slice(0, 10),
      local: txt(passagens[0].local_fraude),
      pico: melhor,
      dur: Math.round(t[faixa[1]] - t[faixa[0]]),
      valor: passagens.reduce((soma, g) => soma + num(g.valor), 0),
      passagens: passagens.map((g, i) => ({
        ...g,
        _n: i + 1,
        _gap: i ? Math.round(t[i] - t[i - 1]) : null,
        _janela: i >= faixa[0] && i <= faixa[1],
        _id: `${id}#${i + 1}`,
      })),
    });
  }
  return blocos.sort((a, b) => b.dia.localeCompare(a.dia) || b.pico - a.pico);
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
        <span className="gd-cod">{cartoes.length === 1 ? txt(cartoes[0].id_usuario) : `${cartoes.length} códigos`}</span>
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
              <span className="dp-faint">— cartão {txt(c.cru_id)}</span>
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
            "Registra o bloqueio aqui e o cartão sai da fila. O bloqueio em si é feito no sistema da bilhetagem — use o código abaixo."}
          {tipo === "desbloquear" && (
            <>
              Registra a liberação aqui. <b>O desbloqueio também precisa ser feito no sistema da bilhetagem</b> — use
              o código abaixo.
            </>
          )}
          {tipo === "descartar" && "O cartão sai da fila sem pedido de bloqueio. Fica registrado quem descartou e por quê."}
          {tipo === "reabrir" && "O cartão volta para \"A bloquear\"."}
          {tipo === "anotar" && `Cartão ${txt(cartoes[0]?.cru_id)} · código ${txt(cartoes[0]?.id_usuario)}`}
        </div>

        {tipo === "bloquear" && (
          <CaixaCodigos cartoes={cartoes} titulo={um ? "Código para bloquear" : "Códigos para bloquear"} />
        )}
        {tipo === "desbloquear" && <CaixaCodigos cartoes={cartoes} titulo="Código para desbloquear" />}

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

/** Os dias da janela da regra, do mais antigo ao último dia da base (ISO). */
function diasDaJanela(baseAte, n = JANELA_DIAS) {
  if (!baseAte) return [];
  const fim = Date.parse(`${baseAte}T12:00:00`);
  return Array.from({ length: n }, (_, i) => isoDataLocal(new Date(fim - (n - 1 - i) * 86400000)));
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
    if (para === "pendente") return "entrou na fila";
    if (para === "saiu_da_janela") return "saiu da lista";
    return ROTULO_SITUACAO[para] || para;
  }
  if (de && de === para) return "anotou";
  return (
    {
      bloqueado: de === "desbloqueado" ? "bloqueou de novo" : "bloqueou",
      desbloqueado: "desbloqueou",
      descartado: "marcou como não é fraude",
      pendente: "voltou para a fila",
    }[para] || para
  );
}
const TOM_ACAO = { bloqueado: "ok", desbloqueado: "warn", descartado: "mute", pendente: "danger", saiu_da_janela: "mute" };
const tomDoHistorico = (h) => (txt(h.de) && txt(h.de) === txt(h.para) ? "mute" : TOM_ACAO[txt(h.para)] || "mute");
// "tela" sobra só se o servidor não achou o nome do login
const quemFez = (h) => {
  const q = txt(h.quem);
  if (q === "deteccao") return "regra automática";
  if (!q || q === "tela") return "INOVE (sem nome)";
  return q;
};

/** Uma rajada na lista da esquerda. */
function ItemRajada({ b, on, fora, onClick }) {
  return (
    <button
      type="button"
      className={`gd-bqm-item${on ? " on" : ""}${fora ? " fora" : ""}`}
      title={fora ? `Fora dos últimos ${JANELA_DIAS} dias — não conta para a regra` : undefined}
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
 * embaixo, as rajadas e o histórico à esquerda e o dia aberto (mapa + passagens) à
 * direita, ocupando o resto da altura.
 */
function CartaoAberto({ cartao, baseAte, onFechar, onAcao }) {
  const [giros, setGiros] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [erro, setErro] = useState("");
  const [blocoAberto, setBlocoAberto] = useState("");
  const [foco, setFoco] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const cru = txt(cartao.cru_id);

  useEffect(() => {
    let vivo = true;
    setGiros(null);
    setErro("");
    Promise.all([
      lerTudoDP360(GIROS, { filtros: { cru_id: `eq.${cru}` }, ordem: "giro_dthora.asc" }),
      lerDP360(HIST, { filtros: { cru_id: `eq.${cru}` }, ordem: "em.desc", limite: 50 }).catch(() => []),
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

  const blocos = useMemo(() => rajadasDoCartao(giros || []), [giros]);
  const janela = useMemo(() => diasDaJanela(baseAte), [baseAte]);
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

  return (
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
            <div className="gd-bqm-linha">
              <span className="gd-bqm-rot">Código</span>
              <span className="gd-cod">{txt(cartao.id_usuario) || "—"}</span>
              <button
                type="button"
                className="dp-btn gd-bqm-mini"
                onClick={async () => {
                  if (await copiar(txt(cartao.id_usuario))) {
                    setCopiado(true);
                    setTimeout(() => setCopiado(false), 1500);
                  }
                }}
              >
                {copiado ? "copiado ✓" : "copiar"}
              </button>
              <span className={`dp-pill ${TOM_SITUACAO[s]}`}>{ROTULO_SITUACAO[s]}</span>
            </div>
            <div className="sub" title={local || undefined}>
              cartão <span className="dp-mono">{cru}</span> · {txt(cartao.tipo_cartao) || "tipo não informado"}
              {local ? ` · ${local}` : ""}
            </div>
          </div>
          <div className="gd-det-acoes">
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
            <button type="button" className="dp-btn" onClick={() => onAcao("anotar", [cartao])}>
              Anotar
            </button>
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
              {diasComRajada} <small>de {JANELA_DIAS}</small>
            </b>
            <em>a regra pede {DIAS_COM_RAJADA}</em>
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
            <em>nas rajadas dos {JANELA_DIAS} dias</em>
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
              <b>Últimos {JANELA_DIAS} dias da base</b>
              <span className="dp-faint">
                {paraBR(inicioJanela)} a {paraBR(baseAte)} · o número é o pico de passagens do dia · clique para ver
              </span>
            </div>
            <div className="gd-bqm-faixa">
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
            {dentro.length ? <div className="gd-bqm-grupo">Nos últimos {JANELA_DIAS} dias · {dentro.length}</div> : null}
            {dentro.map((b) => (
              <ItemRajada key={b.id} b={b} on={aberto?.id === b.id} onClick={() => abrir(b.id)} />
            ))}
            {antes.length ? (
              <div className="gd-bqm-grupo">Antes da janela · {antes.length} — não contam para a regra</div>
            ) : null}
            {antes.map((b) => (
              <ItemRajada key={b.id} b={b} on={aberto?.id === b.id} fora onClick={() => abrir(b.id)} />
            ))}

            <div className="gd-bqm-sec" style={{ marginTop: 10 }}>
              Histórico
            </div>
            <div className="gd-bqm-hist">
              {historico.length ? (
                historico.map((h) => (
                  <div key={h.id} className={`t-${tomDoHistorico(h)}`}>
                    <div>
                      <b>{acaoDoHistorico(h)}</b> <span className="dp-faint">· {quemFez(h)}</span>
                    </div>
                    <div className="dp-mono dp-faint">{quandoBR(h.em)}</div>
                    {txt(h.motivo) && txt(h.quem) !== "deteccao" ? <div>{h.motivo}</div> : null}
                  </div>
                ))
              ) : (
                <div className="dp-faint">Sem registro ainda.</div>
              )}
            </div>
          </aside>

          <section className="gd-bqm-dia">
            {aberto ? (
              <>
                <div className="gd-bqm-dia-tit">
                  <div>
                    <b>
                      {maiuscula(DIA_SEMANA_LONGO[semanaDe(aberto.dia)])}, {paraBR(aberto.dia)}
                    </b>{" "}
                    {naJanela(aberto.dia) ? null : <span className="dp-pill mute">fora dos {JANELA_DIAS} dias</span>}
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
                            title={g._janela ? "dentro da pior janela de 10 minutos" : ""}
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
                  <span className="gd-bqm-marca" /> pior janela de 10 minutos do dia · o número do pino é a ordem da
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
      .filter((h) => comRegra || txt(h.quem) !== "deteccao")
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
        titulo: "Código",
        largura: 100,
        classe: "dp-mono",
        valor: (h) => txt(h.id_usuario),
        render: (h) => <b className="gd-cod-lin">{txt(h.id_usuario) || "—"}</b>,
      },
      { id: "cru_id", titulo: "Cartão", largura: 90, classe: "dp-mono", valor: (h) => txt(h.cru_id) },
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
          <b>{conta((h) => txt(h.para) === "bloqueado" && txt(h.de) !== "bloqueado")}</b>
          <span>bloqueios</span>
        </div>
        <div className="gd-bq-kpi">
          <b>{conta((h) => txt(h.para) === "desbloqueado" && txt(h.de) !== "desbloqueado")}</b>
          <span>desbloqueios</span>
        </div>
        <div className="gd-bq-kpi">
          <b>{conta((h) => txt(h.para) === "descartado" && txt(h.de) !== "descartado")}</b>
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

/* ──────────────────────────────── a aba ──────────────────────────────────── */

export default function FraudeBloqueio() {
  const [cartoes, setCartoes] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [aba, setAba] = useState("pendente");
  const [termo, setTermo] = useState("");
  const [ordem, setOrdem] = useState("dias_com_rajada");
  const [selecionados, setSelecionados] = useState([]);
  const [aberto, setAberto] = useState("");
  const [acao, setAcao] = useState(null);
  const [recado, setRecado] = useState(null);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro("");
    Promise.all([
      lerTudoDP360(TAB, { ordem: "cru_id.asc" }),
      // o histórico não pode derrubar a fila: sem ele, só a aba Histórico fica vazia
      lerTudoDP360(HIST, { ordem: "id.desc" }).catch(() => []),
    ])
      .then(([linhas, hist]) => {
        if (!vivo) return;
        setCartoes(linhas || []);
        setHistorico(hist || []);
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
  }, [recarga]);

  const baseAte = useMemo(
    () => cartoes.map((c) => txt(c.base_ate).slice(0, 10)).filter(Boolean).sort().pop() || "",
    [cartoes],
  );
  // a base parada é informação de operação: a fila não anda se a detecção não roda
  const baseParadaHa = baseAte ? diasAtras(isoDataLocal(new Date()), baseAte) * -1 : 0;

  const contagem = useMemo(() => {
    const c = {};
    SITUACOES.forEach((s) => {
      c[s.k] = 0;
    });
    cartoes.forEach((x) => {
      c[situacaoDe(x)] = (c[situacaoDe(x)] || 0) + 1;
    });
    return c;
  }, [cartoes]);

  const kpis = useMemo(() => {
    const p = cartoes.filter((c) => situacaoDe(c) === "pendente");
    const soma = (l, k) => l.reduce((s, x) => s + num(x[k]), 0);
    return {
      pendentes: p.length,
      ativos: p.filter((c) => diasAtras(c.ultima_rajada, baseAte) <= DIAS_ATIVO).length,
      debitado: soma(p, "valor_debitado"),
      saldo: soma(p, "saldo"),
    };
  }, [cartoes, baseAte]);

  // cru_id → a última linha de histórico feita por GENTE (lista já vem da mais nova)
  const ultimoPorPessoa = useMemo(() => {
    const m = new Map();
    for (const h of historico) {
      if (txt(h.quem) === "deteccao" || m.has(txt(h.cru_id))) continue;
      m.set(txt(h.cru_id), h);
    }
    return m;
  }, [historico]);

  const visiveis = useMemo(() => {
    const t = termo.trim().toLowerCase();
    return cartoes
      .filter((c) => situacaoDe(c) === aba)
      .filter((c) =>
        !t || [c.id_usuario, c.cru_id, c.local_fraude, c.tipo_cartao].some((v) => txt(v).toLowerCase().includes(t)),
      )
      .sort((a, b) =>
        ordem === "ultima_rajada"
          ? txt(b.ultima_rajada).localeCompare(txt(a.ultima_rajada))
          : num(b[ordem]) - num(a[ordem]),
      );
  }, [cartoes, aba, termo, ordem]);

  const colunas = useMemo(() => {
    const base = [
      {
        id: "id_usuario",
        titulo: "Código",
        largura: 100,
        classe: "dp-mono",
        valor: (c) => txt(c.id_usuario),
        render: (c) => <b className="gd-cod-lin">{txt(c.id_usuario)}</b>,
      },
      { id: "cru_id", titulo: "Cartão", largura: 90, classe: "dp-mono", valor: (c) => txt(c.cru_id) },
      { id: "tipo_cartao", titulo: "Tipo", largura: 150, valor: (c) => txt(c.tipo_cartao) },
      {
        id: "dias_com_rajada",
        titulo: "Dias c/ rajada",
        largura: 96,
        classe: "dp-num",
        valor: (c) => num(c.dias_com_rajada),
        render: (c) =>
          num(c.dias_com_rajada) > DIAS_COM_RAJADA ? (
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
            <span className="dp-faint">({diasAtras(c.ultima_rajada, baseAte)}d)</span>
          </span>
        ),
      },
    ];
    if (aba === "bloqueado") {
      base.push(
        { id: "bloqueado_em", titulo: "Bloqueado em", largura: 140, valor: (c) => quandoBR(c.bloqueado_em) },
        { id: "bloqueado_por", titulo: "Por", largura: 150, valor: (c) => txt(c.bloqueado_por) },
      );
    }
    if (aba === "desbloqueado") {
      base.push(
        { id: "desbloqueado_em", titulo: "Desbloqueado em", largura: 140, valor: (c) => quandoBR(c.desbloqueado_em) },
        { id: "desbloqueado_por", titulo: "Por", largura: 150, valor: (c) => txt(c.desbloqueado_por) },
        { id: "motivo_desbloqueio", titulo: "Motivo", largura: 240, valor: (c) => txt(c.motivo_desbloqueio) },
      );
    }
    if (aba === "descartado") {
      base.push(
        { id: "descartado_em", titulo: "Descartado em", largura: 140, valor: (c) => quandoBR(c.descartado_em) },
        {
          id: "descartado_por",
          titulo: "Por",
          largura: 150,
          valor: (c) => {
            const h = ultimoPorPessoa.get(txt(c.cru_id));
            return h && txt(h.para) === "descartado" ? quemFez(h) : "";
          },
        },
      );
    }
    if (aba !== "pendente") {
      base.push({ id: "observacao", titulo: "Observação", largura: 220, valor: (c) => txt(c.observacao) });
    }
    return base;
  }, [aba, baseAte, ultimoPorPessoa]);

  const cartaoAberto = cartoes.find((c) => txt(c.cru_id) === aberto) || null;
  const marcados = visiveis.filter((c) => selecionados.includes(txt(c.cru_id)));

  /* GRAVA: a situação na fila e uma linha de histórico por cartão. O histórico vai depois
     de todos os cartões: se um falhar no meio, o que já mudou fica registrado com a
     mensagem do erro, e a tela relê a fila para mostrar o estado real. */
  const aplicar = useCallback(async (lista, situacao, campos, motivo, rotulo) => {
    // o "de" do histórico é lido ANTES de gravar — depois disso a linha já diz "para"
    const antes = new Map(lista.map((c) => [txt(c.cru_id), situacaoDe(c)]));
    const feitos = [];
    try {
      for (const c of lista) {
        await atualizarDP360(TAB, { cru_id: `eq.${txt(c.cru_id)}` }, { situacao, ...campos }, rotulo);
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
          obs || "bloqueado",
          "Bloqueio de cartão (fraude)",
        );
      } else if (tipo === "desbloquear") {
        const texto = motivo + (obs ? ` — ${obs}` : "");
        await aplicar(
          lista,
          "desbloqueado",
          { desbloqueado_em: agora, desbloqueado_por: "tela", motivo_desbloqueio: texto },
          texto,
          "Desbloqueio de cartão (fraude)",
        );
      } else if (tipo === "descartar") {
        await aplicar(
          lista,
          "descartado",
          { descartado_em: agora, observacao: obs || null },
          obs || "sem motivo informado",
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
            : `${lista.length} cartão(ões) → ${ROTULO_SITUACAO[
                { bloquear: "bloqueado", desbloquear: "desbloqueado", descartar: "descartado", reabrir: "pendente" }[tipo]
              ]}.`,
      });
      setAcao(null);
      if (tipo !== "anotar") setAberto("");
      setSelecionados([]);
    },
    [acao, aplicar],
  );

  const copiarDaAba = async () => {
    if (!visiveis.length) return setRecado({ tom: "warn", texto: "Nada para copiar nesta aba." });
    const ok = await copiar(visiveis.map((c) => txt(c.id_usuario)).join("\n"));
    setRecado(
      ok
        ? { tom: "ok", texto: `${visiveis.length} código(s) copiado(s).` }
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
            placeholder="código, cartão ou local…"
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
              Copiar códigos da aba
            </button>
          </>
        ) : null}
        <button type="button" className="dp-btn" onClick={() => setRecarga((n) => n + 1)} disabled={carregando}>
          <RefreshCw size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
          Recarregar
        </button>
        {recado ? <span className={`dp-pill ${recado.tom}`}>{recado.texto}</span> : null}
      </div>

      <div className="gd-hint">
        Fraude = <b>{MIN_PASSAGENS} ou mais passagens dentro de 10 minutos</b>, em <b>{DIAS_COM_RAJADA} dias ou mais</b>{" "}
        (seguidos ou não) nos <b>últimos {JANELA_DIAS} dias da base</b> · só passagem que girou a catraca ·{" "}
        {baseAte ? `base até ${paraBR(baseAte)}` : "base sem data"}
        {baseParadaHa > 3 ? (
          <span className="dp-pill warn" style={{ marginLeft: 8 }}>
            a detecção está {baseParadaHa} dias atrás — a fila só anda quando o robô de fraudes roda
          </span>
        ) : null}
      </div>

      <div className="gd-bq-kpis">
        <div className="gd-bq-kpi al">
          <b>{kpis.pendentes}</b>
          <span>a bloquear</span>
        </div>
        <div className="gd-bq-kpi al">
          <b>{kpis.ativos}</b>
          <span>ativos ({DIAS_ATIVO} dias da base)</span>
        </div>
        <div className="gd-bq-kpi">
          <b>{brl(kpis.debitado)}</b>
          <span>debitado nas rajadas</span>
        </div>
        <div className="gd-bq-kpi">
          <b>{brl(kpis.saldo)}</b>
          <span>saldo a recuperar</span>
        </div>
        <div className="gd-bq-kpi ok">
          <b>{contagem.bloqueado || 0}</b>
          <span>já bloqueados</span>
        </div>
        <div className="gd-bq-kpi">
          <b>{contagem.desbloqueado || 0}</b>
          <span>desbloqueados</span>
        </div>
      </div>

      <div className="dp-viewbar" style={{ paddingTop: 4 }}>
        {SITUACOES.map((s) => (
          <button
            key={s.k}
            type="button"
            className={`dp-chip-f${aba === s.k ? " on" : ""}`}
            onClick={() => {
              setAba(s.k);
              setSelecionados([]);
            }}
          >
            {s.rotulo} <span className="n">{contagem[s.k] || 0}</span>
          </button>
        ))}
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

      {erro ? (
        <div className="dp-resumo">
          <span className="dp-pill danger">{erro}</span>
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
        carregando={carregando}
        mensagemCarregando="Carregando a fila de bloqueio…"
        idLinha={(c) => txt(c.cru_id)}
        aoClicarLinha={(c) => setAberto(txt(c.cru_id))}
        selecionavel={aba === "pendente"}
        aoSelecionar={(ids) => setSelecionados(ids)}
        classeLinha={(c) => (diasAtras(c.ultima_rajada, baseAte) <= DIAS_ATIVO && aba === "pendente" ? "row-p1" : "")}
        nomeCsv={`bloqueio_${aba}_${isoDataLocal(new Date())}`}
        vazio={aba === "pendente" ? "Nada a bloquear. Fila limpa. 👍" : "Nenhum cartão aqui."}
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
          baseAte={baseAte}
          onFechar={() => setAberto("")}
          onAcao={(tipo, lista) => setAcao({ tipo, cartoes: lista })}
        />
      ) : null}
      {acao ? <JanelaAcao acao={acao} onFechar={() => setAcao(null)} onConfirmar={confirmarAcao} /> : null}
    </>
  );
}
