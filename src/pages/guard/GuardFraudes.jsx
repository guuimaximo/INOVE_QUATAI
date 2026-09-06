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
//   · NENHUMA GRAVAÇÃO nesta fase: os botões de ação nascem desabilitados e a
//     chamada está em TODO no fim do arquivo.
// ============================================================================
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AuthContext } from "../../context/AuthContext";
import { useAccessGovernance } from "../../context/AccessContext";
import { canUserAccessPath } from "../../utils/access";
import { lerDP360, lerTudoDP360 } from "../../services/dp360Api";
import TabelaDP from "../dp360/TabelaDP";
import "../dp360/dp360.css";
import "./guard.css";

/* ────────────────────────────── constantes da tela ───────────────────────── */

const AVISO_FASE = "Gravação liberada na próxima fase";

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
const TETO_PAGINAS_CASOS = 20;
const TETO_PAGINAS_BLOQUEADOS = 10;
const LIMITE_GIROS = 500;

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
  const [semPedidos, setSemPedidos] = useState(false);
  const [soRepetidos, setSoRepetidos] = useState(false);
  const [termo, setTermo] = useState("");

  // caso aberto → passagens → passagem em foco no mapa
  const [caso, setCaso] = useState(null);
  const [giros, setGiros] = useState([]);
  const [carregandoGiros, setCarregandoGiros] = useState(false);
  const [erroGiros, setErroGiros] = useState("");
  const [foco, setFoco] = useState(null);

  /* ── casos ── */
  useEffect(() => {
    if (!podeAcessar) return undefined;
    let vivo = true;
    setCarregando(true);
    setErro("");
    setCaso(null);
    setGiros([]);
    setFoco(null);

    (async () => {
      try {
        const filtros = recencia > 0 ? { data_ref: `gte.${isoDiasAtras(recencia)}` } : undefined;
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
        const linhas = await lerTudoDP360(
          "fraude_cartao_bloqueado",
          { colunas: COLUNAS_BLOQUEADO, ordem: "giros_apos_restricao.desc,cru_id" },
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

  /* ── passagens do caso aberto ── */
  useEffect(() => {
    if (!caso) {
      setGiros([]);
      return undefined;
    }
    let vivo = true;
    setCarregandoGiros(true);
    setErroGiros("");
    setFoco(null);

    (async () => {
      try {
        const linhas = await lerDP360("fraude_cartao_giros", {
          colunas: COLUNAS_GIRO,
          filtros: { id_evento_final: `eq.${txt(caso.id_evento_final)}` },
          ordem: "ordem,giro_dthora",
          limite: LIMITE_GIROS,
        });
        if (vivo) setGiros(linhas);
      } catch (falha) {
        if (vivo) setErroGiros(falha?.message || "Não foi possível ler as passagens deste caso.");
      } finally {
        if (vivo) setCarregandoGiros(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [caso]);

  const recarregar = useCallback(() => setRecarga((n) => n + 1), []);

  /* ── filtros ── */

  // Um caso "já pedido" é um caso com `status` gravado (pedido de bloqueio,
  // analisado, etc.). Sem status = ainda não passou por ninguém.
  const jaPedido = useCallback((l) => txt(l.status) !== "", []);

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

  const visiveis = useMemo(
    () => base.filter((l) => l.passagens >= minPassagens && cabeNaJanela(l, janela)),
    [base, minPassagens, janela, cabeNaJanela],
  );

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
    () => visiveis.reduce((soma, l) => soma + (numero(l.valor_total_debitado) || 0), 0),
    [visiveis],
  );

  /* ── passagens: pontos do mapa ── */

  // A identidade da passagem NÃO pode depender do índice: a TabelaDP chama
  // `idLinha(linha)` com um argumento só, e o mapa casa o foco por esse id — com
  // índice, os dois lados discordariam assim que a grade fosse reordenada.
  const idDoGiro = useCallback(
    (g) => txt(g?.id_evento) || `${txt(g?.id_evento_final)}#${txt(g?.ordem)}`,
    [],
  );

  const pontos = useMemo(
    () =>
      giros
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
    [giros, idDoGiro],
  );

  const semGps = giros.length - pontos.length;
  const efetivas = useMemo(() => giros.filter(girou).length, [giros]);

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
              <b className="dp-num">{visiveis.length}</b> caso(s) ·{" "}
              <b className="dp-num">{new Set(visiveis.map((l) => txt(l.cru_id))).size}</b> cartão(ões)
              distinto(s) · debitado <b className="dp-num">{moeda(totalDebitado)}</b>{" "}
              <span className="dp-faint">
                · regra calculada na origem (3+ débitos em 60 min, mesmo endereço) — esta tela só
                apresenta e filtra · somente leitura.
              </span>
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
            cada 4-8 s.
          </div>

          <TabelaDP
            chave="guard_casos"
            colunas={COLS_CASOS}
            linhas={visiveis}
            carregando={carregando}
            mensagemCarregando="Carregando casos do INOVE Guard…"
            idLinha={(l) => txt(l.id_evento_final)}
            classeLinha={(l) => (l.passagens >= 10 ? "row-p1" : l.passagens >= 8 ? "row-p2" : "")}
            aoClicarLinha={(l) => setCaso((atual) => (atual?.id_evento_final === l.id_evento_final ? null : l))}
            nomeCsv={`inove_guard_fraudes_${isoDataLocal(new Date())}`}
            vazio={
              casos.length
                ? "Nenhum caso com estes filtros — afrouxe as passagens ou a janela."
                : "Nenhum caso no período. 👍"
            }
            pinPadrao={2}
          />

          {/* ── caso aberto: passagens + mapa ── */}
          {caso && (
            <div className="gd-detalhe">
              <div className="gd-det-head">
                <div>
                  <b>
                    Cartão <span className="dp-mono">{txt(caso.cru_id) || "—"}</span> ·{" "}
                    {paraBR(caso.data_ref)}
                  </b>
                  <div className="sub">
                    {txt(caso.local_fraude) || "local não informado"} · placa{" "}
                    <span className="dp-mono">{txt(caso.vei_placa) || "—"}</span> ·{" "}
                    <b className="dp-num">{caso.passagens}</b> passagem(ns) em{" "}
                    <b className="dp-num">{inteiro(caso.duracao_total_min)}</b> min · menor intervalo{" "}
                    <b className="dp-num">{inteiro(caso.menor_intervalo_seg)}</b> s · debitado{" "}
                    <b>{moeda(caso.valor_total_debitado)}</b> · saldo {moeda(caso.saldo)}
                    <br />
                    de {dataHoraBR(caso.primeira_transacao)} até{" "}
                    {dataHoraBR(caso.ultima_utilizacao_da_sequencia)} ·{" "}
                    {inteiro(caso.qtd_veiculos)} veículo(s) · GPS ±
                    {inteiro(caso.defasagem_telemetria_seg)} s
                    {txt(caso.status) ? ` · status: ${txt(caso.status)}` : ""}
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
                  {/* Nasce DESABILITADO: nesta fase a tela não grava nada. */}
                  <button type="button" className="dp-btn" disabled title={AVISO_FASE}>
                    Marcar analisado
                  </button>
                  <button type="button" className="dp-btn" disabled title={AVISO_FASE}>
                    Pedir bloqueio
                  </button>
                  <button type="button" className="dp-btn" onClick={() => setCaso(null)}>
                    Fechar
                  </button>
                </div>
              </div>

              <div className="gd-det-corpo">
                <div className="gd-secao">
                  Passagens do caso — clique numa linha para mostrar no mapa
                  {giros.length > 0 && (
                    <span className="dp-faint" style={{ textTransform: "none", fontWeight: 400 }}>
                      {" "}
                      · {efetivas} efetiva(s) de {giros.length}
                      {semGps > 0 ? ` · ${semGps} sem GPS` : ""}
                    </span>
                  )}
                </div>

                {erroGiros ? (
                  <div className="dp-resumo">
                    <span className="dp-pill danger">{erroGiros}</span>
                  </div>
                ) : (
                  <TabelaDP
                    chave="guard_giros"
                    colunas={COLS_GIROS}
                    linhas={giros}
                    carregando={carregandoGiros}
                    mensagemCarregando="Carregando as passagens deste caso…"
                    idLinha={idDoGiro}
                    classeLinha={(g) => (idDoGiro(g) === foco ? "gd-foco" : "")}
                    aoClicarLinha={(g) => setFoco(idDoGiro(g))}
                    nomeCsv={`inove_guard_passagens_${txt(caso.id_evento_final)}`}
                    vazio="Nenhuma passagem gravada para este caso."
                    pinPadrao={2}
                  />
                )}

                <div className="gd-secao">Onde aconteceu</div>
                <MapaPassagens pontos={pontos} foco={foco} altura={300} />
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

// ============================================================================
// TODO(fase de gravação) — as duas ações do painel do caso.
//
// Hoje os botões "Marcar analisado" e "Pedir bloqueio" nascem DESABILITADOS: a
// tabela `fraude_cartao_sequencial` está no gateway com `{ ler: true }` e nada
// mais, então nenhuma gravação passa — nem por engano.
//
// Quando liberar, o alvo são as colunas que a própria tabela já tem:
//     status, analisado_em, analisado_por, observacao
//
// A chamada ficaria assim (o gateway precisa ganhar `escrever: ["upsert"]` e
// `conflito: "id_evento_final"` em supabase/functions/dp360-api/index.ts):
//
// async function marcarAnalisado(caso, novoStatus, observacao) {
//   await upsertDP360("fraude_cartao_sequencial", {
//     id_evento_final: caso.id_evento_final,
//     status: novoStatus,                 // ex.: "analisado" | "bloqueio pedido"
//     analisado_em: new Date().toISOString(),   // timestamp COM fuso: aqui é instante,
//                                              // não data local — o toISOString é correto
//     analisado_por: user?.nome || user?.login,
//     observacao,
//   });
// }
//
// ANTES DE LIGAR ISTO, DEFINIR:
//  1. O VOCABULÁRIO de `status`. Hoje a tela só sabe "tem status = já passou por
//     alguém"; o filtro "excluir já pedidos" depende disso. Com valores livres,
//     um "OK" digitado à mão esconde o caso da lista sem querer.
//  2. QUEM pode pedir bloqueio. Bloquear cartão é ação sobre um passageiro: erro
//     tira o transporte de alguém que não fez nada.
//  3. Se "pedir bloqueio" apenas MARCA aqui ou também dispara algo na origem.
//     Enquanto for só marcação, deixar isso explícito no botão.
// ============================================================================
