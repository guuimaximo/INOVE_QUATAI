// ============================================================================
// INOVE GUARD · FRAUDES — cartão usado em sequência no mesmo endereço
//
// ⚠ ESTA TELA NÃO CALCULA A REGRA. A regra roda na ORIGEM (SQL diário) e chega
// pronta em três tabelas, liberadas SOMENTE LEITURA no gateway `dp360-api`:
//
//   fraude_cartao_sequencial → 1 linha por CASO   (chave: id_evento_final)
//   fraude_cartao_giros      → 1 linha por PASSAGEM do caso (liga por id_evento_final)
//   fraude_cartao_bloqueado  → cartão restrito que continuou sendo usado
//
// COMO O CASO NASCE (na origem, não aqui):
//   · empresa 046; dia fechado 00:00 → 00:00;
//   · o débito é localizado pelo GPS do ônibus — ping mais próximo em ±180 s
//     (a defasagem sobra na coluna `defasagem_telemetria_seg`);
//   · BLOCO = débitos consecutivos do MESMO cartão no MESMO endereço. Só a troca
//     de endereço quebra o bloco — o tempo NUNCA quebra;
//   · gatilho: 3+ débitos em 60 min;
//   · deduplicação por `r95_id`.
//
// O QUE SE CONSIDERA FRAUDE (a triagem que esta tela ajuda a fazer):
//   · só passagem efetiva (`giro_efetuado = 1`) — leitura que não girou a
//     catraca não é embarque;
//   · é a CONTAGEM que prova, não a velocidade: numa fila normal as pessoas
//     embarcam a cada 4-8 s, então "rápido" sozinho não diz nada — N passagens
//     em X minutos, sim;
//   · repetição em dias distintos (um caso isolado pode ser catraca travada);
//   · caso recente — bloquear cartão parado não devolve nada.
//
// O QUE A REGRA NÃO PEGA (mostrado na tela, como no relatório):
//   · cartão bloqueado em uso → detecção SEPARADA (aba "Cartões bloqueados");
//   · fraude em endereços diferentes → o bloco quebra na troca de endereço;
//   · débito sem GPS → sem ping não há endereço, logo não há bloco.
//
// 🔒 SEGURANÇA DESTA TELA
//   · `numero_cartao` NUNCA aparece inteiro — só `••••1234`. A máscara está no
//     `valor` da coluna também, e não só no `render`, senão o CSV vazaria o
//     número completo.
//   · nenhum `console.log` de dado.
//   · A ÚNICA GRAVAÇÃO é a TRIAGEM (status, analisado_em, analisado_por,
//     observacao). O gateway recusa qualquer outra coluna desta tabela: cartão,
//     local, valor e horário são a prova da detecção e só entram pelo bot.
//     Isso precisa ser trava do GATEWAY, e não só do banco — o gateway fala com
//     a base pela service key, que ignora `grant update (coluna)`.
// ============================================================================
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search, X } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AuthContext } from "../../context/AuthContext";
import { useAccessGovernance } from "../../context/AccessContext";
import { canUserAccessPath } from "../../utils/access";
import { atualizarDP360, lerDP360, lerTudoDP360 } from "../../services/dp360Api";
import TabelaDP from "../dp360/TabelaDP";
import "../dp360/dp360.css";
import "./guard.css";

/* ────────────────────────────── constantes da tela ───────────────────────── */

// TRIAGEM — o vocabulário NÃO é meu: é o do painel que já roda
// (PROGRAMA_FRAUDES/painel/painel_fraude.template.html:975-976 e a coluna
// `status default 'novo'` em sql/02_supabase_tabela.sql). Inventar um "analisado"
// aqui faria a mesma ocorrência ter dois vocabulários e quebraria o painel.
const ST_NOVO = "novo";
const ST_BLOQUEIO = "bloqueio";
const ST_SEM_FRAUDE = "sem_fraude";

// Os mesmos cortes do relatório que o dono gerou.
const OPCOES_PASSAGENS = [5, 6, 8, 10];
const OPCOES_JANELA = [10, 15, 20, 30];
const OPCOES_RECENCIA = [
  { dias: 0, rotulo: "tudo" },
  { dias: 15, rotulo: "15 d" },
  { dias: 30, rotulo: "30 d" },
  { dias: 60, rotulo: "60 d" },
];

// Padrão deliberadamente FROUXO (5+ passagens, bloco de até 30 min, 30 dias):
// a tela abre mostrando caso, e quem aperta o filtro é o analista. Abrir vazia
// parece tela quebrada.
const PADRAO_PASSAGENS = 5;
const PADRAO_JANELA = 30;
const PADRAO_RECENCIA = 30;

// Teto de paginação do gateway (1000 linhas/página). Sem folga a leitura seria
// truncada em silêncio e sumiriam casos sem ninguém perceber.
const LINHAS_POR_PAGINA = 1000;
const TETO_PAGINAS_CASOS = 6;
const TETO_PAGINAS_BLOQUEADOS = 3;
const LIMITE_GIROS = 500;
const LIMITE_HISTORICO = 300;

// PISO DE PASSAGENS NO SERVIDOR — e a armadilha que ele evita.
//
// No lake essas colunas sao TEXTO, nao numero (o PostgREST devolve "10", com
// aspas). Entao `usos_dentro_da_janela=gte.5` vira comparacao de TEXTO, e em
// texto '10' < '5': o filtro jogaria fora justamente os casos de 10+ passagens,
// que sao os piores. Medido na base: `gte.5` devolve 3.010 linhas e o corte por
// EXCLUSAO devolve 3.277 — as 267 que sumiriam sao as de 10+.
//
// Por isso o piso vai como "nao esta entre 0..4", que e exato em texto. So o
// PISO (a opcao mais frouxa) vai ao servidor; 6+, 8+ e 10+ continuam no cliente,
// sobre estas linhas — assim o contador de cada chip continua certo, que e o que
// impede a tela de abrir vazia sem explicar por que.
const PISO_PASSAGENS = OPCOES_PASSAGENS[0];
const FILTRO_PISO_PASSAGENS = `not.in.(${Array.from({ length: PISO_PASSAGENS }, (_, i) => i).join(",")})`;

// Teto do que a grade DESENHA. Filtro frouxo em "tudo" da ~3,3 mil linhas, e
// pintar tudo isso trava a rolagem por nada: ninguem audita 3 mil casos de uma
// vez. O rodape diz quantos ficaram de fora para o numero nao mentir.
const MAX_LINHAS_GRADE = 400;

// SÓ as colunas que EXISTEM. Coluna inexistente devolve HTTP 400 no gateway e
// derruba a tela inteira — nunca pedir `*` nem chutar nome.
const COLUNAS_CASO = [
  "id_evento_final",
  "data_ref",
  "cru_id",
  "id_usuario",
  "id_tipo_cartao",
  "id_empresa",
  "vei_placa",
  "local_fraude",
  "latitude",
  "longitude",
  "link_maps",
  "usos_consecutivos_neste_local",
  "usos_dentro_da_janela",
  "primeira_transacao",
  "ultima_utilizacao_da_sequencia",
  "duracao_total_min",
  "qtd_veiculos",
  "menor_intervalo_seg",
  "qtd_sem_giro",
  "defasagem_telemetria_seg",
  "valor_total_debitado",
  "saldo",
  "status",
].join(",");

const COLUNAS_GIRO = [
  "id_evento",
  "id_evento_final",
  "data_ref",
  "cru_id",
  "ordem",
  "giro_dthora",
  "gap_anterior_seg",
  "vei_placa",
  "valor",
  "giro_efetuado",
  "saldo",
  "local_fraude",
  "latitude",
  "longitude",
  "link_maps",
  "defasagem_telemetria_seg",
].join(",");

const COLUNAS_BLOQUEADO = [
  "cru_id",
  "id_usuario",
  "numero_cartao",
  "cru_status",
  "restrito_desde",
  "motivo_restricao",
  "tipo_restricao",
  "giros_apos_restricao",
  "dias_com_uso",
  "valor_apos_restricao",
  "primeiro_uso_apos",
  "ultimo_uso_apos",
  "atualizado_em",
].join(",");

/* ────────────────────────────── utilidades puras ─────────────────────────── */

const txt = (valor) => String(valor ?? "").trim();

const numero = (valor) => {
  const s = txt(valor).replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// CLAUDE.md: NUNCA `new Date().toISOString()` para uma data local — depois das
// 21h BRT devolve o dia seguinte e a janela de "casos recentes" abre errada.
function isoDataLocal(data) {
  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, "0"),
    String(data.getDate()).padStart(2, "0"),
  ].join("-");
}

function isoDiasAtras(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return isoDataLocal(d);
}

// '2026-09-05' → '05/09/2026'. Fatia de STRING de propósito: passar por `Date`
// reintroduz o bug de fuso (a data volta um dia).
function paraBR(iso) {
  const s = txt(iso).slice(0, 10);
  if (s.length < 10) return s || "—";
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
}

// '2026-09-05T07:12:33' / '2026-09-05 07:12:33' → '07:12:33', sem `Date`.
function horaDe(ts) {
  const m = /(\d{2}:\d{2}(?::\d{2})?)/.exec(txt(ts));
  return m ? m[1] : "";
}

function dataHoraBR(ts) {
  const s = txt(ts);
  if (!s) return "—";
  const hora = horaDe(s);
  return `${paraBR(s)}${hora ? ` ${hora}` : ""}`;
}

function moeda(valor) {
  const n = numero(valor);
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function inteiro(valor) {
  const n = numero(valor);
  return n == null ? "—" : String(Math.round(n));
}

/**
 * 🔒 O número do cartão NUNCA sai inteiro desta tela.
 * Devolve `••••1234`; cartão curto demais para ter "4 últimos" vira só `••••`.
 */
function mascararCartao(valor) {
  const so = txt(valor).replace(/\D/g, "");
  if (!so) return "—";
  if (so.length <= 4) return "••••";
  return `••••${so.slice(-4)}`;
}

// `giro_efetuado` chega como 1/0, "1"/"0" ou true/false conforme a origem.
const girou = (linha) => {
  const v = linha?.giro_efetuado;
  if (v === true) return true;
  const n = numero(v);
  return n != null ? n === 1 : txt(v).toLowerCase() === "true";
};

/* ──────────────────────────── colunas das grades ─────────────────────────── */

// Quantas passagens o caso tem: a contagem da janela é a que a origem usou no
// gatilho; sem ela, cai no total do bloco.
const passagensDoCaso = (linha) =>
  numero(linha?.usos_dentro_da_janela) ?? numero(linha?.usos_consecutivos_neste_local) ?? 0;

function pilulaPassagens(n) {
  if (n >= 10) return "danger";
  if (n >= 8) return "warn";
  return "accent";
}

const COLS_CASOS = [
  {
    id: "data_ref",
    titulo: "Dia",
    largura: 96,
    classe: "dp-mono",
    valor: (l) => txt(l.data_ref).slice(0, 10),
    render: (l) => paraBR(l.data_ref),
  },
  { id: "cru_id", titulo: "Cartão (CRU)", largura: 118, classe: "dp-mono" },
  { id: "id_usuario", titulo: "Usuário", largura: 104, classe: "dp-mono" },
  { id: "local_fraude", titulo: "Local do bloco", largura: 250 },
  { id: "vei_placa", titulo: "Placa", largura: 92, classe: "dp-mono" },
  {
    id: "qtd_veiculos",
    titulo: "Veíc.",
    largura: 64,
    alinhar: "right",
    classe: "dp-num",
    valor: (l) => numero(l.qtd_veiculos),
  },
  {
    id: "passagens",
    titulo: "Passagens",
    largura: 100,
    alinhar: "right",
    valor: (l) => l.passagens,
    render: (l) => <span className={`dp-pill ${pilulaPassagens(l.passagens)}`}>{l.passagens}</span>,
  },
  {
    id: "usos_consecutivos_neste_local",
    titulo: "No bloco",
    largura: 86,
    alinhar: "right",
    classe: "dp-num",
    valor: (l) => numero(l.usos_consecutivos_neste_local),
  },
  {
    id: "duracao_total_min",
    titulo: "Duração (min)",
    largura: 104,
    alinhar: "right",
    classe: "dp-num",
    valor: (l) => numero(l.duracao_total_min),
  },
  {
    id: "menor_intervalo_seg",
    titulo: "Menor int. (s)",
    largura: 100,
    alinhar: "right",
    classe: "dp-num",
    valor: (l) => numero(l.menor_intervalo_seg),
  },
  {
    id: "qtd_sem_giro",
    titulo: "Sem giro",
    largura: 84,
    alinhar: "right",
    valor: (l) => numero(l.qtd_sem_giro) ?? 0,
    // Leitura que não girou a catraca não é embarque — vira ressalva na triagem,
    // não prova.
    render: (l) => {
      const n = numero(l.qtd_sem_giro) ?? 0;
      return n > 0 ? (
        <span className="dp-pill warn" title="Leituras que não giraram a catraca — não são embarque">
          {n}
        </span>
      ) : (
        <span className="dp-faint">0</span>
      );
    },
  },
  {
    id: "diasDoCartao",
    titulo: "Dias c/ caso",
    largura: 100,
    alinhar: "right",
    valor: (l) => l.diasDoCartao,
    // Repetição em dias distintos é o que separa fraude de catraca travada.
    render: (l) =>
      l.diasDoCartao > 1 ? (
        <span className="dp-pill danger" title="Este cartão aparece em mais de um dia no período lido">
          {l.diasDoCartao} dias
        </span>
      ) : (
        <span className="dp-faint">1 dia</span>
      ),
  },
  {
    id: "valor_total_debitado",
    titulo: "Debitado",
    largura: 104,
    alinhar: "right",
    classe: "dp-num",
    valor: (l) => numero(l.valor_total_debitado),
    render: (l) => moeda(l.valor_total_debitado),
  },
  {
    id: "saldo",
    titulo: "Saldo",
    largura: 100,
    alinhar: "right",
    classe: "dp-num",
    valor: (l) => numero(l.saldo),
    render: (l) => moeda(l.saldo),
  },
  {
    id: "status",
    titulo: "Status",
    largura: 130,
    valor: (l) => txt(l.status),
    render: (l) =>
      txt(l.status) ? (
        <span className="dp-pill mute">{txt(l.status)}</span>
      ) : (
        <span className="dp-faint">—</span>
      ),
  },
];

const COLS_GIROS = [
  {
    id: "ordem",
    titulo: "#",
    largura: 52,
    alinhar: "right",
    classe: "dp-num",
    valor: (l) => numero(l.ordem),
  },
  {
    id: "giro_dthora",
    titulo: "Hora",
    largura: 96,
    classe: "dp-mono",
    valor: (l) => txt(l.giro_dthora),
    render: (l) => horaDe(l.giro_dthora) || "—",
  },
  {
    id: "gap_anterior_seg",
    titulo: "Gap (s)",
    largura: 84,
    alinhar: "right",
    classe: "dp-num",
    valor: (l) => numero(l.gap_anterior_seg),
    render: (l) => inteiro(l.gap_anterior_seg),
  },
  {
    id: "giro_efetuado",
    titulo: "Girou?",
    largura: 92,
    valor: (l) => (girou(l) ? 1 : 0),
    render: (l) =>
      girou(l) ? (
        <span className="dp-pill ok">passagem</span>
      ) : (
        <span className="dp-pill mute" title="Leu, mas a catraca não girou — não é embarque">
          sem giro
        </span>
      ),
  },
  { id: "vei_placa", titulo: "Placa", largura: 92, classe: "dp-mono" },
  {
    id: "valor",
    titulo: "Valor",
    largura: 96,
    alinhar: "right",
    classe: "dp-num",
    valor: (l) => numero(l.valor),
    render: (l) => moeda(l.valor),
  },
  {
    id: "saldo",
    titulo: "Saldo",
    largura: 96,
    alinhar: "right",
    classe: "dp-num",
    valor: (l) => numero(l.saldo),
    render: (l) => moeda(l.saldo),
  },
  { id: "local_fraude", titulo: "Local", largura: 230 },
  {
    id: "defasagem_telemetria_seg",
    titulo: "GPS ±s",
    largura: 86,
    alinhar: "right",
    classe: "dp-num",
    valor: (l) => numero(l.defasagem_telemetria_seg),
    render: (l) => inteiro(l.defasagem_telemetria_seg),
  },
  {
    id: "link_maps",
    titulo: "Maps",
    largura: 74,
    ordenavel: false,
    valor: (l) => txt(l.link_maps),
    render: (l) =>
      txt(l.link_maps) ? (
        <a
          href={l.link_maps}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()} // o clique da linha é "mostrar no mapa"
          title="Abrir no Google Maps"
        >
          abrir
        </a>
      ) : (
        <span className="dp-faint">—</span>
      ),
  },
];

const COLS_BLOQUEADOS = [
  { id: "cru_id", titulo: "Cartão (CRU)", largura: 118, classe: "dp-mono" },
  {
    id: "numero_cartao",
    titulo: "Número",
    largura: 104,
    classe: "dp-mono",
    // 🔒 A MÁSCARA ESTÁ NO `valor`, não só no `render`: o `valor` é o que a
    // TabelaDP ordena E EXPORTA no CSV. Mascarar só na exibição vazaria o
    // número inteiro no arquivo baixado.
    valor: (l) => mascararCartao(l.numero_cartao),
  },
  { id: "id_usuario", titulo: "Usuário", largura: 104, classe: "dp-mono" },
  { id: "cru_status", titulo: "Situação", largura: 120 },
  { id: "tipo_restricao", titulo: "Tipo", largura: 130 },
  { id: "motivo_restricao", titulo: "Motivo", largura: 220 },
  {
    id: "restrito_desde",
    titulo: "Restrito desde",
    largura: 116,
    classe: "dp-mono",
    valor: (l) => txt(l.restrito_desde),
    render: (l) => (txt(l.restrito_desde) ? paraBR(l.restrito_desde) : "—"),
  },
  {
    id: "giros_apos_restricao",
    titulo: "Giros após",
    largura: 96,
    alinhar: "right",
    valor: (l) => numero(l.giros_apos_restricao) ?? 0,
    render: (l) => {
      const n = numero(l.giros_apos_restricao) ?? 0;
      return n > 0 ? <span className="dp-pill danger">{n}</span> : <span className="dp-faint">0</span>;
    },
  },
  {
    id: "dias_com_uso",
    titulo: "Dias c/ uso",
    largura: 96,
    alinhar: "right",
    classe: "dp-num",
    valor: (l) => numero(l.dias_com_uso),
  },
  {
    id: "valor_apos_restricao",
    titulo: "Valor após",
    largura: 108,
    alinhar: "right",
    classe: "dp-num",
    valor: (l) => numero(l.valor_apos_restricao),
    render: (l) => moeda(l.valor_apos_restricao),
  },
  {
    id: "primeiro_uso_apos",
    titulo: "1º uso após",
    largura: 140,
    classe: "dp-mono",
    valor: (l) => txt(l.primeiro_uso_apos),
    render: (l) => dataHoraBR(l.primeiro_uso_apos),
  },
  {
    id: "ultimo_uso_apos",
    titulo: "Último uso após",
    largura: 140,
    classe: "dp-mono",
    valor: (l) => txt(l.ultimo_uso_apos),
    render: (l) => dataHoraBR(l.ultimo_uso_apos),
  },
  {
    id: "atualizado_em",
    titulo: "Atualizado",
    largura: 140,
    classe: "dp-mono",
    valor: (l) => txt(l.atualizado_em),
    render: (l) => dataHoraBR(l.atualizado_em),
  },
];

/* ───────────────────────────── mapa das passagens ────────────────────────── */

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

const COR_PASSAGEM = "#c53434"; // débito que girou a catraca
const COR_SEM_GIRO = "#9aa4b4"; // leu e não girou

const pinoNumerado = (rotulo, cor, foco) =>
  L.divIcon({
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div class="gd-pin${foco ? " foco" : ""}" style="background:${cor}">${esc(rotulo)}</div>`,
  });

/**
 * Mapa SIMPLES das passagens de um caso — de propósito.
 *
 * NÃO é o `MapaBatidas` do DP360: aquele desenha cercas de terminal/garagem e
 * uma régua pessoa↔ônibus, regras do PONTO que não têm nada a ver com fraude de
 * cartão. Aqui só interessa ONDE o bloco aconteceu.
 *
 * Como o BLOCO é, por definição, o mesmo endereço, os pontos costumam cair
 * praticamente em cima uns dos outros — por isso o `maxZoom` do enquadramento é
 * alto e o pino traz o número da ORDEM.
 */
function MapaPassagens({ pontos, foco, altura = 300 }) {
  const elRef = useRef(null);
  const dadosRef = useRef([]);
  const mapaRef = useRef(null);
  const marcadoresRef = useRef([]);
  dadosRef.current = pontos;

  // O efeito não pode depender do ARRAY (o pai recria a lista a cada render e o
  // Leaflet piscaria o mapa inteiro): depende da assinatura dos dados.
  const chave = useMemo(() => JSON.stringify(pontos), [pontos]);

  useEffect(() => {
    const el = elRef.current;
    const pts = dadosRef.current;
    if (!el || !pts.length) return undefined;

    el.innerHTML = "";
    const map = L.map(el, { zoomControl: true });
    map.setView([pts[0].lat, pts[0].lon], 17);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const bounds = [];
    marcadoresRef.current = pts.map((p) => {
      const cor = p.efetiva ? COR_PASSAGEM : COR_SEM_GIRO;
      const marcador = L.marker([p.lat, p.lon], { icon: pinoNumerado(p.rotulo, cor, false) })
        .addTo(map)
        .bindTooltip(
          [
            `<b>#${esc(p.rotulo)} · ${esc(p.hora || "—")}</b>`,
            p.efetiva ? "passagem (girou)" : "leitura sem giro",
            p.placa ? `Veículo ${esc(p.placa)}` : "",
            p.valor ? `Débito ${esc(p.valor)}` : "",
            p.local ? esc(p.local) : "",
          ]
            .filter(Boolean)
            .join("<br>"),
          { direction: "top", className: "gd-tip", offset: [0, -14] },
        );
      bounds.push([p.lat, p.lon]);
      return { marcador, ponto: p };
    });

    try {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
    } catch {
      /* bounds degenerado (um ponto só): fica o setView acima */
    }

    // O painel nasce animando e o Leaflet mede o container errado — sem isto o
    // mapa aparece cortado ou cinza.
    const t = setTimeout(() => map.invalidateSize(), 120);
    let obs = null;
    if (typeof ResizeObserver !== "undefined") {
      obs = new ResizeObserver(() => map.invalidateSize());
      obs.observe(el);
    }
    mapaRef.current = map;

    return () => {
      clearTimeout(t);
      if (obs) obs.disconnect();
      marcadoresRef.current = [];
      mapaRef.current = null;
      // Sem o remove() o Leaflet marca o container e a reabertura monta um mapa
      // quebrado ("Map container is already initialized").
      map.remove();
    };
  }, [chave, altura]);

  // Foco em efeito SEPARADO: trocar a passagem selecionada não pode remontar o
  // mapa (perderia o zoom que a pessoa acabou de dar).
  useEffect(() => {
    const map = mapaRef.current;
    if (!map) return;
    marcadoresRef.current.forEach(({ marcador, ponto }) => {
      const ativo = ponto.id === foco;
      marcador.setIcon(pinoNumerado(ponto.rotulo, ponto.efetiva ? COR_PASSAGEM : COR_SEM_GIRO, ativo));
      if (ativo) {
        marcador.openTooltip();
        map.panTo([ponto.lat, ponto.lon], { animate: true });
      }
    });
  }, [foco, chave]);

  if (!pontos.length) {
    return (
      <div className="gd-map">
        <div className="gd-map-off" style={{ height: altura }}>
          Nenhuma passagem deste caso tem GPS — sem ping não há ponto para mostrar.
        </div>
      </div>
    );
  }

  return (
    <div className="gd-map">
      <div className="gd-map-leg">
        <span>o número do pino é a ordem da passagem no bloco</span>
        <span>· vermelho = girou a catraca · cinza = leu sem girar</span>
        <span>· o bloco é sempre o MESMO endereço, então os pinos ficam sobrepostos</span>
      </div>
      <div ref={elRef} className="gd-map-box" style={{ height: altura }} />
    </div>
  );
}

/* ─────────────────────────────────── a tela ──────────────────────────────── */

export default function GuardFraudes() {
  const { user } = useContext(AuthContext);
  const { profileMap } = useAccessGovernance();
  const podeAcessar = canUserAccessPath(user, "/guard-fraudes", profileMap);

  const [aba, setAba] = useState("casos");

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [casos, setCasos] = useState([]);
  const [truncado, setTruncado] = useState(false);
  const [recarga, setRecarga] = useState(0);

  const [bloqueados, setBloqueados] = useState([]);
  const [carregandoBloq, setCarregandoBloq] = useState(false);
  const [erroBloq, setErroBloq] = useState("");

  // filtros (todos client-side, menos a recência — essa vira filtro no servidor)
  const [minPassagens, setMinPassagens] = useState(PADRAO_PASSAGENS);
  const [janela, setJanela] = useState(PADRAO_JANELA);
  const [recencia, setRecencia] = useState(PADRAO_RECENCIA);
  const [semTeto, setSemTeto] = useState(false);
  const [semPedidos, setSemPedidos] = useState(false);
  const [soRepetidos, setSoRepetidos] = useState(false);
  const [termo, setTermo] = useState("");

  // caso aberto → passagens → passagem em foco no mapa
  // Pop-up do CARTAO. `caso` e a linha clicada (serve de ancora e de dia
  // inicial), mas o que o pop-up carrega e a vida do CARTAO: um caso isolado nao
  // diz nada, e a repeticao em dias diferentes e o proprio sinal de fraude.
  const [caso, setCaso] = useState(null);
  const [giros, setGiros] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [carregandoGiros, setCarregandoGiros] = useState(false);
  const [erroGiros, setErroGiros] = useState("");
  const [foco, setFoco] = useState(null);
  const [diaSel, setDiaSel] = useState("");
  // Passagem que NÃO girou a catraca é ruído para quem analisa cartão: o débito
  // sem giro tem causa própria (catraca travada, leitura dupla) e não é o que se
  // manda bloquear. Fica de fora por padrão, com o contador dizendo quantas são.
  const [soGiros, setSoGiros] = useState(true);
  const [triando, setTriando] = useState("");
  const [recadoTriagem, setRecadoTriagem] = useState(null);
  const [recargaCartao, setRecargaCartao] = useState(0);

  /* ── casos ── */
  useEffect(() => {
    if (!podeAcessar) return undefined;
    let vivo = true;
    setCarregando(true);
    setErro("");
    setSemTeto(false);
    setCaso(null);
    setGiros([]);
    setFoco(null);

    (async () => {
      try {
        // O piso das passagens vai junto do periodo: sozinho, o periodo de 15 d
        // trazia 1.159 linhas para mostrar 79. Com o piso sao 253.
        const filtros = { usos_dentro_da_janela: FILTRO_PISO_PASSAGENS };
        if (recencia > 0) filtros.data_ref = `gte.${isoDiasAtras(recencia)}`;
        const linhas = await lerTudoDP360(
          "fraude_cartao_sequencial",
          { colunas: COLUNAS_CASO, filtros, ordem: "data_ref.desc,id_evento_final" },
          TETO_PAGINAS_CASOS,
        );
        if (!vivo) return;

        // Repetição em dias distintos: quantos DIAS diferentes cada cartão tem
        // caso, dentro do período lido. É agrupamento do que já veio pronto —
        // a regra continua sendo a da origem.
        const diasPorCartao = new Map();
        for (const l of linhas) {
          const cartao = txt(l.cru_id);
          const dia = txt(l.data_ref).slice(0, 10);
          if (!cartao || !dia) continue;
          if (!diasPorCartao.has(cartao)) diasPorCartao.set(cartao, new Set());
          diasPorCartao.get(cartao).add(dia);
        }

        setTruncado(linhas.length >= TETO_PAGINAS_CASOS * LINHAS_POR_PAGINA);
        setCasos(
          linhas.map((l) => ({
            ...l,
            passagens: passagensDoCaso(l),
            duracaoMin: numero(l.duracao_total_min),
            diasDoCartao: diasPorCartao.get(txt(l.cru_id))?.size || 1,
          })),
        );
      } catch (falha) {
        if (vivo) setErro(falha?.message || "Não foi possível ler a base do INOVE Guard.");
      } finally {
        if (vivo) setCarregando(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [podeAcessar, recencia, recarga]);

  /* ── cartões bloqueados (só quando a aba é aberta) ── */
  useEffect(() => {
    if (!podeAcessar || aba !== "bloqueados") return undefined;
    let vivo = true;
    setCarregandoBloq(true);
    setErroBloq("");

    (async () => {
      try {
        // `fraude_cartao_bloqueado` NAO e uma lista de casos: sao 126.897 linhas,
        // o cadastro inteiro de cartoes com a situacao de restricao. O caso e o
        // cartao restrito que CONTINUOU girando a catraca — 31 linhas hoje. Sem
        // este filtro a aba baixava dez mil linhas para mostrar trinta.
        // `not.eq.0` e comparacao de texto de igualdade, entao e exata aqui
        // (diferente de gte./lte., ver FILTRO_PISO_PASSAGENS).
        const linhas = await lerTudoDP360(
          "fraude_cartao_bloqueado",
          {
            colunas: COLUNAS_BLOQUEADO,
            filtros: { giros_apos_restricao: "not.eq.0" },
            ordem: "giros_apos_restricao.desc,cru_id",
          },
          TETO_PAGINAS_BLOQUEADOS,
        );
        if (vivo) setBloqueados(linhas);
      } catch (falha) {
        if (vivo) setErroBloq(falha?.message || "Não foi possível ler os cartões bloqueados.");
      } finally {
        if (vivo) setCarregandoBloq(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [podeAcessar, aba, recarga]);

  /* ── o que o pop-up carrega: passagens e casos DO CARTAO ── */
  // Depende do CARTAO, nao da linha: clicar em outro caso do mesmo cartao nao
  // rebusca nada. Sao duas leituras pequenas (medido: 31 passagens e 8 casos num
  // cartao com historico), por isso vao juntas quando o pop-up abre.
  const cartaoAberto = caso ? txt(caso.cru_id) : "";

  useEffect(() => {
    if (!cartaoAberto) {
      setGiros([]);
      setHistorico([]);
      return undefined;
    }
    let vivo = true;
    setCarregandoGiros(true);
    setErroGiros("");
    setFoco(null);

    (async () => {
      try {
        const [passagens, casosDoCartao] = await Promise.all([
          lerDP360("fraude_cartao_giros", {
            colunas: COLUNAS_GIRO,
            filtros: { cru_id: `eq.${cartaoAberto}` },
            ordem: "giro_dthora,ordem",
            limite: LIMITE_GIROS,
          }),
          lerDP360("fraude_cartao_sequencial", {
            colunas: COLUNAS_CASO,
            filtros: { cru_id: `eq.${cartaoAberto}` },
            ordem: "data_ref.desc",
            limite: LIMITE_HISTORICO,
          }),
        ]);
        if (!vivo) return;
        setGiros(passagens);
        setHistorico(casosDoCartao);
      } catch (falha) {
        if (vivo) setErroGiros(falha?.message || "Não foi possível ler o histórico deste cartão.");
      } finally {
        if (vivo) setCarregandoGiros(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [cartaoAberto, recargaCartao]);

  // Abre no dia da linha clicada — e o dia que a pessoa estava olhando.
  useEffect(() => {
    setDiaSel(caso ? txt(caso.data_ref).slice(0, 10) : "");
    setFoco(null);
    setRecadoTriagem(null);
  }, [caso]);

  // Esc fecha, como qualquer pop-up. Sem isto o unico jeito de sair e achar o X.
  useEffect(() => {
    if (!caso) return undefined;
    const aoTeclar = (e) => {
      if (e.key === "Escape") setCaso(null);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [caso]);

  const recarregar = useCallback(() => setRecarga((n) => n + 1), []);

  /* ── filtros ── */

  // Um caso "já pedido" é um caso que alguém JÁ TRIOU. O default da tabela é
  // `novo` (não é nulo, não é vazio): medido na base, os 15.307 casos têm status
  // preenchido. Testar "status !== ''" marcava todo mundo como já pedido e o
  // chip escondia a lista inteira.
  const jaPedido = useCallback((l) => {
    const st = txt(l.status).toLowerCase();
    return st !== "" && st !== ST_NOVO;
  }, []);

  // Base comum dos dois eixos de filtro (busca + status + repetição), para que
  // os contadores dos chips mostrem o efeito de MUDAR AQUELE eixo, não o total.
  const base = useMemo(() => {
    const q = termo.trim().toLowerCase();
    return casos.filter((l) => {
      if (semPedidos && jaPedido(l)) return false;
      if (soRepetidos && l.diasDoCartao < 2) return false;
      if (!q) return true;
      return (
        txt(l.cru_id).toLowerCase().includes(q) ||
        txt(l.id_usuario).toLowerCase().includes(q) ||
        txt(l.vei_placa).toLowerCase().includes(q) ||
        txt(l.local_fraude).toLowerCase().includes(q)
      );
    });
  }, [casos, termo, semPedidos, soRepetidos, jaPedido]);

  const cabeNaJanela = useCallback(
    (l, minutos) => l.duracaoMin == null || l.duracaoMin <= minutos,
    [],
  );

  const filtrados = useMemo(
    () => base.filter((l) => l.passagens >= minPassagens && cabeNaJanela(l, janela)),
    [base, minPassagens, janela, cabeNaJanela],
  );

  // A grade desenha ate MAX_LINHAS_GRADE — mas o teto e LIFTAVEL, e isso nao e
  // detalhe: o CSV da TabelaDP exporta as linhas que estao em cena. Um teto que
  // a pessoa nao pudesse levantar faria o CSV sair capado sem avisar, numa tela
  // de auditoria. Com o botao, o numero na tela e o numero no arquivo.
  const visiveis = useMemo(
    () =>
      semTeto || filtrados.length <= MAX_LINHAS_GRADE
        ? filtrados
        : filtrados.slice(0, MAX_LINHAS_GRADE),
    [filtrados, semTeto],
  );
  const ocultos = filtrados.length - visiveis.length;

  // Contadores dos chips: quantos casos sobram em cada opção, mantendo o resto.
  const contaPassagens = useMemo(() => {
    const mapa = new Map();
    for (const n of OPCOES_PASSAGENS) {
      mapa.set(n, base.filter((l) => l.passagens >= n && cabeNaJanela(l, janela)).length);
    }
    return mapa;
  }, [base, janela, cabeNaJanela]);

  const contaJanela = useMemo(() => {
    const mapa = new Map();
    for (const m of OPCOES_JANELA) {
      mapa.set(m, base.filter((l) => l.passagens >= minPassagens && cabeNaJanela(l, m)).length);
    }
    return mapa;
  }, [base, minPassagens, cabeNaJanela]);

  const nPedidos = useMemo(() => casos.filter(jaPedido).length, [casos, jaPedido]);

  const totalDebitado = useMemo(
    () => filtrados.reduce((soma, l) => soma + (numero(l.valor_total_debitado) || 0), 0),
    [filtrados],
  );

  /* ── passagens: pontos do mapa ── */

  // A identidade da passagem NÃO pode depender do índice: a TabelaDP chama
  // `idLinha(linha)` com um argumento só, e o mapa casa o foco por esse id — com
  // índice, os dois lados discordariam assim que a grade fosse reordenada.
  const idDoGiro = useCallback(
    (g) => txt(g?.id_evento) || `${txt(g?.id_evento_final)}#${txt(g?.ordem)}`,
    [],
  );

  // O dia escolhido manda no mapa e na tabela de passagens. Sem dia (o cartao
  // aberto pelo botao "ver tudo"), mostra a vida inteira do cartao.
  const girosBase = useMemo(() => (soGiros ? giros.filter(girou) : giros), [giros, soGiros]);
  const semGiroOcultas = giros.length - girosBase.length;

  const girosDoDia = useMemo(
    () =>
      diaSel ? girosBase.filter((g) => txt(g.data_ref).slice(0, 10) === diaSel) : girosBase,
    [girosBase, diaSel],
  );

  // USOS DIARIOS. Cuidado com o que isto e: `fraude_cartao_giros` guarda as
  // passagens DOS BLOCOS DETECTADOS, nao todo uso do cartao. Entao a coluna diz
  // "passagens em bloco", nao "viagens do dia" — chamar de uso total do cartao
  // seria inventar um numero que a base nao tem.
  const usosPorDia = useMemo(() => {
    const mapa = new Map();
    const pega = (dia) => {
      if (!mapa.has(dia))
        mapa.set(dia, {
          dia,
          passagens: 0,
          doCaso: 0,
          efetivas: 0,
          valor: 0,
          locais: new Set(),
          blocos: new Set(),
        });
      return mapa.get(dia);
    };
    for (const g of girosBase) {
      const dia = txt(g.data_ref).slice(0, 10);
      if (!dia) continue;
      const d = pega(dia);
      d.passagens += 1;
      if (girou(g)) d.efetivas += 1;
      d.valor += numero(g.valor) || 0;
      if (txt(g.local_fraude)) d.locais.add(txt(g.local_fraude));
      if (txt(g.id_evento_final)) d.blocos.add(txt(g.id_evento_final));
    }
    for (const c of historico) {
      const dia = txt(c.data_ref).slice(0, 10);
      if (!dia) continue;
      const d = pega(dia);
      d.doCaso += passagensDoCaso(c);
      if (txt(c.id_evento_final)) d.blocos.add(txt(c.id_evento_final));
      if (txt(c.local_fraude)) d.locais.add(txt(c.local_fraude));
    }
    return [...mapa.values()].sort((a, b) => (a.dia < b.dia ? 1 : a.dia > b.dia ? -1 : 0));
  }, [girosBase, historico]);

  const resumoCartao = useMemo(() => {
    const debitado = historico.reduce((soma, c) => soma + (numero(c.valor_total_debitado) || 0), 0);
    const pior = historico.reduce((max, c) => Math.max(max, passagensDoCaso(c)), 0);
    return { casos: historico.length, dias: usosPorDia.length, debitado, pior };
  }, [historico, usosPorDia]);

  /* ── TRIAGEM (grava) ───────────────────────────────────────────────────
     Marca o CARTÃO, não o bloco clicado: quem bloqueia é a bilhetagem, e ela
     bloqueia o cartão. É a mesma decisão do painel que já roda
     (painel_fraude: "No escopo 'cartao' marca TODAS as ocorrências do cartão
     no período"). Só as 4 colunas de triagem são tocadas — o gateway recusa
     qualquer outra, porque cartão, local, valor e horário são a prova da
     detecção e só entram pelo bot. */

  // Os dias que este pop-up carregou — é o alcance do que vamos marcar, e é o
  // que a confirmação promete. `data_ref` é TEXTO no formato ISO, então `gte.`
  // compara certo (largura fixa: ordem de texto = ordem de data). Não vale para
  // as colunas numéricas desta base, ver FILTRO_PISO_PASSAGENS.
  const diasDoCartao = useMemo(() => {
    const lista = historico.map((h) => txt(h.data_ref).slice(0, 10)).filter(Boolean).sort();
    return { de: lista[0] || "", ate: lista[lista.length - 1] || "", n: historico.length };
  }, [historico]);

  const statusCartao = useMemo(() => {
    const st = new Set(historico.map((h) => txt(h.status).toLowerCase()).filter(Boolean));
    if (st.has(ST_BLOQUEIO)) return ST_BLOQUEIO;
    if (st.size === 1 && st.has(ST_SEM_FRAUDE)) return ST_SEM_FRAUDE;
    return st.has(ST_SEM_FRAUDE) ? "misto" : ST_NOVO;
  }, [historico]);

  const triar = useCallback(
    async (novoStatus, rotulo) => {
      if (!cartaoAberto || !diasDoCartao.de) return;
      const quem = txt(user?.nome) || txt(user?.email) || "INOVE";
      const aviso =
        `${rotulo.toUpperCase()} o cartão ${cartaoAberto}.\n\n` +
        `Marca as ${diasDoCartao.n} ocorrência(s) deste cartão, de ` +
        `${paraBR(diasDoCartao.de)} a ${paraBR(diasDoCartao.ate)}.\n` +
        `Grava status="${novoStatus}", analisado_por="${quem}" e a data de agora.\n\n` +
        `Isto NÃO bloqueia o cartão: quem bloqueia é a bilhetagem. O que sai daqui ` +
        `é o pedido, e é o mesmo campo que o painel de fraudes lê.`;
      if (!window.confirm(aviso)) return;
      const obs = window.prompt("Observação (opcional) — fica junto do pedido:", "");
      if (obs === null) return; // Cancelar no prompt cancela a ação inteira

      setTriando(novoStatus);
      setRecadoTriagem(null);
      try {
        await atualizarDP360(
          "fraude_cartao_sequencial",
          { cru_id: `eq.${cartaoAberto}`, data_ref: `gte.${diasDoCartao.de}` },
          {
            status: novoStatus,
            // instante, não data local: aqui o toISOString é o certo, e é o que
            // o painel de fraudes grava nesta mesma coluna.
            analisado_em: new Date().toISOString(),
            analisado_por: quem,
            observacao: obs.trim() || null,
          },
        );
        setRecadoTriagem({ tipo: "ok", texto: `${rotulo} gravado em ${diasDoCartao.n} ocorrência(s).` });
        setRecargaCartao((n) => n + 1); // relê o cartão
        recarregar(); // e a lista de trás, para o chip "excluir já pedidos" bater
      } catch (falha) {
        setRecadoTriagem({ tipo: "erro", texto: falha?.message || "Não foi possível gravar a triagem." });
      } finally {
        setTriando("");
      }
    },
    [cartaoAberto, diasDoCartao, user, recarregar],
  );

  const pontos = useMemo(
    () =>
      girosDoDia
        .map((g, i) => ({
          id: idDoGiro(g),
          rotulo: txt(g.ordem) || String(i + 1),
          lat: numero(g.latitude),
          lon: numero(g.longitude),
          hora: horaDe(g.giro_dthora),
          placa: txt(g.vei_placa),
          valor: numero(g.valor) != null ? moeda(g.valor) : "",
          local: txt(g.local_fraude),
          efetiva: girou(g),
        }))
        .filter((p) => p.lat != null && p.lon != null),
    [girosDoDia, idDoGiro],
  );

  const semGps = girosDoDia.length - pontos.length;
  const efetivas = useMemo(() => girosDoDia.filter(girou).length, [girosDoDia]);

  /* ── acesso ── */
  if (!podeAcessar) {
    return (
      <div className="dp360 -m-4 sm:-m-6">
        <div className="dp-topbar">
          <div className="dp-brand">
            <div className="dp-brand-mark">IG</div>
            <div>
              <div className="dp-brand-title">INOVE Guard · Fraudes</div>
              <div className="dp-brand-sub">acesso restrito</div>
            </div>
          </div>
        </div>
        <div className="dp-viewbar">
          <div className="dp-vazio" style={{ flex: 1 }}>
            Sem acesso ao INOVE Guard. Peça ao administrador para liberar
            <span className="dp-mono"> /guard-fraudes </span>
            no seu perfil do INOVE.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dp360 -m-4 sm:-m-6">
      <div className="dp-topbar">
        <div className="dp-brand">
          <div className="dp-brand-mark">IG</div>
          <div>
            <div className="dp-brand-title">INOVE Guard · Fraudes</div>
            <div className="dp-brand-sub">
              cartão usado em sequência no mesmo endereço · {user?.nome || "Usuário"}
            </div>
          </div>
        </div>

        <nav className="dp-tabs" aria-label="Abas do INOVE Guard">
          <button
            type="button"
            className={`dp-tab${aba === "casos" ? " is-active" : ""}`}
            onClick={() => setAba("casos")}
          >
            Casos
          </button>
          <button
            type="button"
            className={`dp-tab${aba === "bloqueados" ? " is-active" : ""}`}
            onClick={() => setAba("bloqueados")}
          >
            Cartões bloqueados
          </button>
          <button
            type="button"
            className={`dp-tab${aba === "regra" ? " is-active" : ""}`}
            onClick={() => setAba("regra")}
          >
            Como a regra funciona
          </button>
        </nav>
      </div>

      {/* ══════════════════════════════ CASOS ══════════════════════════════ */}
      {aba === "casos" && (
        <>
          <div className="dp-viewbar">
            <div className="dp-busca">
              <Search size={14} />
              <input
                type="search"
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="cartão, usuário, placa ou local…"
              />
            </div>

            <div className="gd-fgroup">
              <span className="gd-flabel">Passagens</span>
              {OPCOES_PASSAGENS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`dp-chip-f${minPassagens === n ? " on" : ""}`}
                  onClick={() => setMinPassagens(n)}
                  title={`Casos com ${n} ou mais passagens`}
                >
                  {n}+<span className="n">{contaPassagens.get(n) ?? 0}</span>
                </button>
              ))}
            </div>

            <div className="gd-fgroup">
              <span className="gd-flabel">Janela</span>
              {OPCOES_JANELA.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`dp-chip-f${janela === m ? " on" : ""}`}
                  onClick={() => setJanela(m)}
                  title={`Blocos que se fecharam em até ${m} minutos`}
                >
                  {m} min<span className="n">{contaJanela.get(m) ?? 0}</span>
                </button>
              ))}
            </div>

            <div className="gd-fgroup">
              <span className="gd-flabel">Caso nos últimos</span>
              {OPCOES_RECENCIA.map((o) => (
                <button
                  key={o.dias}
                  type="button"
                  className={`dp-chip-f${recencia === o.dias ? " on" : ""}`}
                  onClick={() => setRecencia(o.dias)}
                  title="Bloquear cartão parado não devolve nada — a triagem começa pelo recente"
                >
                  {o.rotulo}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={`dp-chip-f${semPedidos ? " on" : ""}`}
              onClick={() => setSemPedidos((v) => !v)}
              title="Esconde os casos que já têm status gravado (já pedidos / já analisados)"
            >
              excluir já pedidos<span className="n">{nPedidos}</span>
            </button>

            <button
              type="button"
              className={`dp-chip-f${soRepetidos ? " on" : ""}`}
              onClick={() => setSoRepetidos((v) => !v)}
              title="Repetição em dias distintos: um caso isolado pode ser catraca travada"
            >
              repete em 2+ dias
            </button>

            <button type="button" className="dp-btn" onClick={recarregar}>
              <RefreshCw size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              Atualizar
            </button>
          </div>

          {erro && (
            <div className="dp-resumo">
              <span className="dp-pill danger">{erro}</span>
            </div>
          )}

          {!erro && (
            <div className="dp-resumo">
              <b className="dp-num">{filtrados.length}</b> caso(s) ·{" "}
              <b className="dp-num">{new Set(filtrados.map((l) => txt(l.cru_id))).size}</b> cartão(ões)
              distinto(s) · debitado <b className="dp-num">{moeda(totalDebitado)}</b>{" "}
              <span className="dp-faint">
                · regra calculada na origem (3+ débitos em 60 min, mesmo endereço) — esta tela só
                apresenta e filtra · somente leitura.
              </span>
              {ocultos > 0 && (
                <>
                  {" "}
                  <button
                    type="button"
                    className="dp-pill warn gd-pill-btn"
                    onClick={() => setSemTeto(true)}
                    title="Desenhar todas as linhas (e levar todas para o CSV)"
                  >
                    desenhando {MAX_LINHAS_GRADE} de {filtrados.length} — mostrar todas
                  </button>
                </>
              )}
              {truncado && (
                <>
                  {" "}
                  <span className="dp-pill danger" title="A leitura bateu no teto de paginação">
                    leitura truncada — aperte o filtro de período
                  </span>
                </>
              )}
            </div>
          )}

          <div className="gd-hint">
            <b>Passagens</b> = <span className="dp-mono">usos_dentro_da_janela</span> (a contagem que
            a origem usou no gatilho; sem ela, o total do bloco). <b>Janela</b> ={" "}
            <span className="dp-mono">duracao_total_min</span> — o bloco inteiro fechou em até X
            minutos. É a CONTAGEM que prova, não a velocidade: numa fila normal as pessoas embarcam a
            cada 4-8 s. A tela lê do servidor só os casos de <b>{PISO_PASSAGENS}+ passagens</b> — os
            cortes maiores afinam essa mesma lista, sem ir ao banco de novo.
          </div>

          <TabelaDP
            chave="guard_casos"
            colunas={COLS_CASOS}
            linhas={visiveis}
            carregando={carregando}
            mensagemCarregando="Carregando casos do INOVE Guard…"
            idLinha={(l) => txt(l.id_evento_final)}
            classeLinha={(l) => (l.passagens >= 10 ? "row-p1" : l.passagens >= 8 ? "row-p2" : "")}
            aoClicarLinha={(l) => setCaso(l)}
            nomeCsv={`inove_guard_fraudes_${isoDataLocal(new Date())}`}
            vazio={
              casos.length
                ? "Nenhum caso com estes filtros — afrouxe as passagens ou a janela."
                : "Nenhum caso no período. 👍"
            }
            pinPadrao={2}
          />

          {/* ── POP-UP DO CARTÃO: usos por dia + mapa + passagens ──────────
              Vive fora da grade de propósito. Enquanto era painel embaixo da
              tabela, abrir um caso empurrava a lista para fora da tela e a
              pessoa perdia o lugar onde estava. */}
          {caso && (
            <div
              className="gd-modal"
              role="dialog"
              aria-modal="true"
              aria-label={`Cartão ${cartaoAberto}`}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setCaso(null);
              }}
            >
              <div className="gd-modal-box">
                <div className="gd-modal-head">
                  <div>
                    <b>
                      Cartão <span className="dp-mono">{cartaoAberto || "—"}</span>
                    </b>
                    <div className="sub">
                      usuário <span className="dp-mono">{txt(caso.id_usuario) || "—"}</span> ·{" "}
                      <b className="dp-num">{resumoCartao.casos}</b> caso(s) em{" "}
                      <b className="dp-num">{resumoCartao.dias}</b> dia(s) · pior bloco com{" "}
                      <b className="dp-num">{resumoCartao.pior}</b> passagens · debitado{" "}
                      <b>{moeda(resumoCartao.debitado)}</b>
                      {" · "}
                      <span
                        className={`dp-pill ${
                          statusCartao === ST_BLOQUEIO
                            ? "danger"
                            : statusCartao === ST_SEM_FRAUDE
                              ? "ok"
                              : statusCartao === "misto"
                                ? "warn"
                                : "mute"
                        }`}
                      >
                        {statusCartao === ST_BLOQUEIO
                          ? "bloqueio pedido"
                          : statusCartao === ST_SEM_FRAUDE
                            ? "sem fraude"
                            : statusCartao === "misto"
                              ? "triagem parcial"
                              : "sem triagem"}
                      </span>
                      <br />
                      histórico do cartão inteiro — não só o dia que você clicou.
                    </div>
                  </div>

                  <div className="gd-det-acoes">
                    {txt(caso.link_maps) && (
                      <a
                        className="dp-btn"
                        href={caso.link_maps}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir o endereço do bloco no Google Maps"
                      >
                        Maps
                      </a>
                    )}
                    {statusCartao !== ST_NOVO && (
                      <button
                        type="button"
                        className="dp-btn"
                        disabled={!!triando || !diasDoCartao.de}
                        onClick={() => triar(ST_NOVO, "Voltar para novo")}
                        title="Desfaz a triagem: o cartão volta para a fila de análise"
                      >
                        ↩ Voltar para novo
                      </button>
                    )}
                    <button
                      type="button"
                      className="dp-btn"
                      disabled={!!triando || !diasDoCartao.de}
                      onClick={() => triar(ST_SEM_FRAUDE, "Sem fraude")}
                      title="Analisado e descartado: não é fraude"
                    >
                      ✓ Sem fraude
                    </button>
                    <button
                      type="button"
                      className="dp-btn"
                      style={{ color: "var(--dp-danger-ink)" }}
                      disabled={!!triando || !diasDoCartao.de}
                      onClick={() => triar(ST_BLOQUEIO, "Pedir bloqueio")}
                      title="Marca o cartão para a bilhetagem bloquear — não bloqueia sozinho"
                    >
                      🚫 Pedir bloqueio
                    </button>
                    <button
                      type="button"
                      className="dp-btn"
                      onClick={() => setCaso(null)}
                      aria-label="Fechar"
                      title="Fechar (Esc)"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {(erroGiros || recadoTriagem || triando) && (
                  <div className="gd-modal-erro">
                    {erroGiros && <span className="dp-pill danger">{erroGiros}</span>}
                    {triando && <span className="dp-pill accent">gravando…</span>}
                    {recadoTriagem && (
                      <span className={`dp-pill ${recadoTriagem.tipo === "ok" ? "ok" : "danger"}`}>
                        {recadoTriagem.texto}
                      </span>
                    )}
                  </div>
                )}

                <div className="gd-modal-corpo">
                  <div className="gd-modal-dias">
                    <div className="gd-secao">
                      Usos por dia
                      <span className="dp-faint" style={{ textTransform: "none", fontWeight: 400 }}>
                        {" "}
                        · {soGiros ? "só quem girou a catraca" : "todas as passagens"}
                      </span>
                      {(semGiroOcultas > 0 || !soGiros) && (
                        <>
                          {" "}
                          <button
                            type="button"
                            className="dp-pill mute gd-pill-btn"
                            onClick={() => setSoGiros((v) => !v)}
                            title="Passagem sem giro é débito que não girou a catraca — causa própria, não é o que se manda bloquear"
                          >
                            {soGiros ? `+${semGiroOcultas} sem giro` : "esconder sem giro"}
                          </button>
                        </>
                      )}
                      {giros.length >= LIMITE_GIROS && (
                        <>
                          {" "}
                          <span className="dp-pill danger" title="Leitura das passagens truncada">
                            só as {LIMITE_GIROS} primeiras
                          </span>
                        </>
                      )}
                    </div>

                    {carregandoGiros ? (
                      <div className="dp-vazio">Carregando o histórico do cartão…</div>
                    ) : (
                      <div className="gd-dias">
                        <button
                          type="button"
                          className={`gd-dia${diaSel === "" ? " on" : ""}`}
                          onClick={() => {
                            setDiaSel("");
                            setFoco(null);
                          }}
                        >
                          <span className="d">todos os dias</span>
                          <span className="n">
                            <b className="dp-num">{girosBase.length}</b> passagem(ns)
                          </span>
                        </button>

                        {usosPorDia.map((d) => (
                          <button
                            key={d.dia}
                            type="button"
                            className={`gd-dia${d.dia === diaSel ? " on" : ""}`}
                            onClick={() => {
                              setDiaSel(d.dia);
                              setFoco(null);
                            }}
                          >
                            <span className="d">{paraBR(d.dia)}</span>
                            <span className="n">
                              <b className="dp-num">{d.passagens || d.doCaso}</b> passagem(ns)
                              {d.blocos.size > 1 ? ` · ${d.blocos.size} blocos` : ""}
                              {d.passagens && d.efetivas !== d.passagens
                                ? ` · ${d.passagens - d.efetivas} sem giro`
                                : ""}
                            </span>
                            <span className="v">{moeda(d.valor)}</span>
                            <span className="l" title={[...d.locais].join(" · ")}>
                              {[...d.locais][0] || "—"}
                              {d.locais.size > 1 ? ` +${d.locais.size - 1}` : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="gd-modal-mapa">
                    <div className="gd-secao">
                      Onde aconteceu
                      <span className="dp-faint" style={{ textTransform: "none", fontWeight: 400 }}>
                        {" "}
                        · {diaSel ? paraBR(diaSel) : "todos os dias"}
                        {girosDoDia.length > 0
                          ? ` · ${efetivas} efetiva(s) de ${girosDoDia.length}`
                          : ""}
                        {semGps > 0 ? ` · ${semGps} sem GPS` : ""}
                      </span>
                    </div>

                    <MapaPassagens pontos={pontos} foco={foco} altura={360} />

                    <div className="gd-secao">Passagens — clique numa linha para focar no mapa</div>
                    <TabelaDP
                      chave="guard_giros"
                      colunas={COLS_GIROS}
                      linhas={girosDoDia}
                      carregando={carregandoGiros}
                      mensagemCarregando="Carregando as passagens…"
                      idLinha={idDoGiro}
                      classeLinha={(g) => (idDoGiro(g) === foco ? "gd-foco" : "")}
                      aoClicarLinha={(g) => setFoco(idDoGiro(g))}
                      nomeCsv={`inove_guard_passagens_${cartaoAberto}${diaSel ? `_${diaSel}` : ""}`}
                      vazio="Nenhuma passagem gravada."
                      pinPadrao={2}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════ CARTÕES BLOQUEADOS ════════════════════════ */}
      {aba === "bloqueados" && (
        <>
          <div className="dp-viewbar">
            <div className="dp-vazio" style={{ flex: 1, border: 0, padding: 0 }}>
              Detecção <b>separada</b>: cartão com restrição ativa que continuou girando a catraca.
              Não passa pela regra de sequência — por isso não aparece na aba Casos.
            </div>
            <button type="button" className="dp-btn" onClick={recarregar}>
              <RefreshCw size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              Atualizar
            </button>
          </div>

          {erroBloq && (
            <div className="dp-resumo">
              <span className="dp-pill danger">{erroBloq}</span>
            </div>
          )}

          {!erroBloq && (
            <div className="dp-resumo">
              <b className="dp-num">{bloqueados.length}</b> cartão(ões) restrito(s) com uso ·{" "}
              <span className="dp-faint">
                🔒 o número do cartão aparece mascarado (<span className="dp-mono">••••1234</span>),
                inclusive no CSV.
              </span>
            </div>
          )}

          <TabelaDP
            chave="guard_bloqueados"
            colunas={COLS_BLOQUEADOS}
            linhas={bloqueados}
            carregando={carregandoBloq}
            mensagemCarregando="Carregando cartões bloqueados…"
            idLinha={(l) => txt(l.cru_id)}
            classeLinha={(l) => ((numero(l.giros_apos_restricao) || 0) > 0 ? "row-p1" : "")}
            nomeCsv={`inove_guard_bloqueados_${isoDataLocal(new Date())}`}
            vazio="Nenhum cartão bloqueado com uso registrado. 👍"
            pinPadrao={2}
          />
        </>
      )}

      {/* ════════════════════════ COMO A REGRA FUNCIONA ════════════════════ */}
      {aba === "regra" && (
        <div className="gd-cards">
          <div className="gd-card">
            <h4>Captura (na origem, SQL diário)</h4>
            <ul>
              <li>Empresa 046, dia fechado 00:00 → 00:00.</li>
              <li>O débito é localizado pelo GPS do ônibus — ping mais próximo em ±180 s.</li>
              <li>
                <b>Bloco</b> = débitos consecutivos do mesmo cartão no <b>mesmo endereço</b>. Só a
                troca de endereço quebra o bloco — o tempo nunca quebra.
              </li>
              <li>Gatilho: 3+ débitos em 60 min.</li>
              <li>
                Deduplicação por <span className="dp-mono">r95_id</span>.
              </li>
            </ul>
          </div>

          <div className="gd-card">
            <h4>Triagem (o que se considera fraude)</h4>
            <ul>
              <li>
                Só passagem efetiva (<span className="dp-mono">giro_efetuado = 1</span>) — leitura
                que não girou a catraca não é embarque.
              </li>
              <li>
                É a <b>contagem</b> que prova, não a velocidade: numa fila normal as pessoas embarcam
                a cada 4-8 s. N passagens em X minutos.
              </li>
              <li>Repetição em dias distintos — um caso isolado pode ser catraca travada.</li>
              <li>Caso recente: bloquear cartão parado não devolve nada.</li>
            </ul>
          </div>

          <div className="gd-card gd-limites">
            <h4>O que a regra NÃO pega</h4>
            <ul>
              <li>
                <b>Cartão bloqueado em uso</b> — detecção separada, na aba "Cartões bloqueados".
              </li>
              <li>
                <b>Fraude em endereços diferentes</b> — a troca de endereço quebra o bloco, então a
                sequência nunca se forma.
              </li>
              <li>
                <b>Débito sem GPS</b> — sem ping não há endereço, logo não há bloco.
              </li>
            </ul>
          </div>

          <div className="gd-card">
            <h4>O que esta tela faz</h4>
            <ul>
              <li>
                Apresenta e filtra o que a origem já calculou. <b>Não recalcula a regra</b> e{" "}
                <b>não grava nada</b> nesta fase.
              </li>
              <li>
                O número do cartão nunca é exibido inteiro — só{" "}
                <span className="dp-mono">••••1234</span>.
              </li>
              <li>
                Leitura só pelo gateway <span className="dp-mono">dp360-api</span>, que exige sessão
                do INOVE e perfil Administrador.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
