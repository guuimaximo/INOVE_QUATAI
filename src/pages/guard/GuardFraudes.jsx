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
//   · fraude em endereços diferentes → o bloco quebra na troca de endereço;
//   · débito sem GPS → sem ping não há endereço, logo não há bloco.
//
// 🔒 SEGURANÇA DESTA TELA
//   · `numero_cartao` não é lido por esta tela (16/09/2026: a aba de bloqueados
//     deixou de ler o cadastro da bilhetagem; ela mostra o ciclo da fila de bloqueio).
//   · nenhum `console.log` de dado.
//   · A ÚNICA GRAVAÇÃO é a TRIAGEM (status, analisado_em, analisado_por,
//     observacao). O gateway recusa qualquer outra coluna desta tabela: cartão,
//     local, valor e horário são a prova da detecção e só entram pelo bot.
//     Isso precisa ser trava do GATEWAY, e não só do banco — o gateway fala com
//     a base pela service key, que ignora `grant update (coluna)`.
// ============================================================================
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search, X } from "lucide-react";
import { AuthContext } from "../../context/AuthContext";
import { useAccessGovernance } from "../../context/AccessContext";
import { canUserAccessPath } from "../../utils/access";
import { atualizarDP360, lerDP360, lerTudoDP360 } from "../../services/dp360Api";
import TabelaDP from "../dp360/TabelaDP";
import MapaPassagens from "./MapaPassagens";
import FraudeBloqueio from "./FraudeBloqueio";
import { REGRA_PADRAO } from "./regraBloqueio";
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
    // cada linha é UM caso (um bloco de passagens do cartão no mesmo local); o dia é o dele
    titulo: "Dia do caso",
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

/* ─────────────────────────── visão POR CARTÃO ───────────────────────────
 * Pedido do dono (16/09/2026): "nessa tela você não consegue consolidar os
 * cartões?". A grade por caso repete o mesmo cartão em várias linhas (uma por
 * bloco); a visão por cartão junta os casos QUE PASSARAM NOS FILTROS numa linha
 * só. Clicar abre o mesmo pop-up, no caso mais recente do cartão.
 *
 * Status do cartão: "bloqueio pedido" vence ("sem fraude" só se todos forem), e o
 * que veio DEPOIS do último pedido aparece junto — em 16/09, 50 dos 82 cartões
 * pedidos em 19/08 continuaram passando. */
function statusDoGrupo(casosDoCartao) {
  const st = new Set(casosDoCartao.map((l) => txt(l.status).toLowerCase() || ST_NOVO));
  if (st.has(ST_BLOQUEIO)) return ST_BLOQUEIO;
  if (st.size === 1 && st.has(ST_SEM_FRAUDE)) return ST_SEM_FRAUDE;
  return st.has(ST_SEM_FRAUDE) ? "misto" : ST_NOVO;
}

function agruparPorCartao(linhas) {
  const grupos = new Map();
  for (const l of linhas) {
    const k = txt(l.cru_id);
    if (!k) continue;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(l);
  }
  const saida = [];
  for (const [cru, casos] of grupos) {
    const dias = [...new Set(casos.map((l) => txt(l.data_ref).slice(0, 10)).filter(Boolean))].sort();
    const locais = new Map();
    for (const l of casos) {
      const loc = txt(l.local_fraude);
      if (loc) locais.set(loc, (locais.get(loc) || 0) + 1);
    }
    const locaisOrdem = [...locais.entries()].sort((a, b) => b[1] - a[1]);
    const recente = casos.reduce((a, b) => (txt(b.data_ref) > txt(a.data_ref) ? b : a));
    const status = statusDoGrupo(casos);
    const pedidos = casos.filter((l) => txt(l.status).toLowerCase() === ST_BLOQUEIO);
    const ultimoPedido = pedidos.reduce((m, l) => (txt(l.data_ref) > m ? txt(l.data_ref) : m), "");
    saida.push({
      cru_id: cru,
      id_usuario: txt(recente.id_usuario),
      casos: casos.length,
      diasComCaso: dias.length,
      primeiro: dias[0] || "",
      ultimo: dias[dias.length - 1] || "",
      maiorBloco: Math.max(...casos.map((l) => l.passagens || 0)),
      passagens: casos.reduce((soma, l) => soma + (l.passagens || 0), 0),
      veiculos: new Set(casos.map((l) => txt(l.vei_placa)).filter(Boolean)).size,
      local: locaisOrdem[0]?.[0] || "",
      outrosLocais: Math.max(0, locaisOrdem.length - 1),
      debitado: casos.reduce((soma, l) => soma + (numero(l.valor_total_debitado) || 0), 0),
      saldo: numero(recente.saldo),
      status,
      depoisDoPedido: ultimoPedido
        ? casos.filter((l) => txt(l.status).toLowerCase() !== ST_BLOQUEIO && txt(l.data_ref) > ultimoPedido).length
        : 0,
      recente,
    });
  }
  // repetição primeiro: é ela que separa fraude de catraca travada
  return saida.sort(
    (a, b) => b.diasComCaso - a.diasComCaso || b.maiorBloco - a.maiorBloco || b.debitado - a.debitado,
  );
}

const ROTULO_STATUS_GRUPO = {
  [ST_BLOQUEIO]: "bloqueio pedido",
  [ST_SEM_FRAUDE]: "sem fraude",
  misto: "triagem parcial",
  [ST_NOVO]: "sem triagem",
};
const TOM_STATUS_GRUPO = { [ST_BLOQUEIO]: "danger", [ST_SEM_FRAUDE]: "ok", misto: "warn", [ST_NOVO]: "mute" };

const COLS_CARTOES = [
  {
    id: "id_usuario",
    titulo: "Usuário",
    largura: 104,
    classe: "dp-mono",
    valor: (g) => g.id_usuario,
    render: (g) => <b>{g.id_usuario || "—"}</b>,
  },
  { id: "cru_id", titulo: "Cartão (CRU)", largura: 110, classe: "dp-mono", valor: (g) => g.cru_id },
  {
    id: "diasComCaso",
    titulo: "Dias c/ caso",
    largura: 104,
    alinhar: "right",
    valor: (g) => g.diasComCaso,
    render: (g) =>
      g.diasComCaso > 1 ? (
        <span className="dp-pill danger">{g.diasComCaso} dias</span>
      ) : (
        <span className="dp-faint">1 dia</span>
      ),
  },
  { id: "casos", titulo: "Casos", largura: 70, alinhar: "right", classe: "dp-num", valor: (g) => g.casos },
  {
    id: "periodo",
    titulo: "Primeiro → último",
    largura: 170,
    classe: "dp-mono",
    valor: (g) => g.ultimo,
    render: (g) => (
      <span>
        {paraBR(g.primeiro).slice(0, 5)} → {paraBR(g.ultimo)}
      </span>
    ),
  },
  {
    id: "maiorBloco",
    titulo: "Maior bloco",
    largura: 100,
    alinhar: "right",
    valor: (g) => g.maiorBloco,
    render: (g) => <span className={`dp-pill ${pilulaPassagens(g.maiorBloco)}`}>{g.maiorBloco}</span>,
  },
  { id: "passagens", titulo: "Passagens", largura: 90, alinhar: "right", classe: "dp-num", valor: (g) => g.passagens },
  { id: "veiculos", titulo: "Veíc.", largura: 64, alinhar: "right", classe: "dp-num", valor: (g) => g.veiculos },
  {
    id: "local",
    titulo: "Local mais frequente",
    largura: 280,
    valor: (g) => g.local,
    render: (g) => (
      <span title={g.local}>
        {g.local || "—"}
        {g.outrosLocais > 0 ? <span className="dp-faint"> +{g.outrosLocais}</span> : null}
      </span>
    ),
  },
  {
    id: "debitado",
    titulo: "Debitado",
    largura: 104,
    alinhar: "right",
    classe: "dp-num",
    valor: (g) => g.debitado,
    render: (g) => moeda(g.debitado),
  },
  {
    id: "saldo",
    titulo: "Saldo",
    largura: 100,
    alinhar: "right",
    classe: "dp-num",
    valor: (g) => g.saldo,
    render: (g) => moeda(g.saldo),
  },
  {
    id: "status",
    titulo: "Status",
    largura: 190,
    valor: (g) => ROTULO_STATUS_GRUPO[g.status] || g.status,
    render: (g) => (
      <span>
        <span className={`dp-pill ${TOM_STATUS_GRUPO[g.status] || "mute"}`}>
          {ROTULO_STATUS_GRUPO[g.status] || g.status}
        </span>
        {g.depoisDoPedido > 0 ? (
          <span className="dp-pill danger" style={{ marginLeft: 4 }} title="Casos depois do último pedido de bloqueio">
            +{g.depoisDoPedido} depois
          </span>
        ) : null}
      </span>
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

/* ─────────────────────────────────── a tela ──────────────────────────────── */

export default function GuardFraudes() {
  const { user } = useContext(AuthContext);
  const { profileMap } = useAccessGovernance();
  const podeAcessar = canUserAccessPath(user, "/guard-fraudes", profileMap);

  // a tela de BLOQUEIO abre primeiro: é a que a bilhetagem usa no dia a dia (16/09/2026)
  const [aba, setAba] = useState("bloqueio");

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [casos, setCasos] = useState([]);
  const [truncado, setTruncado] = useState(false);
  const [recarga, setRecarga] = useState(0);


  // filtros (todos client-side, menos a recência — essa vira filtro no servidor)
  const [minPassagens, setMinPassagens] = useState(PADRAO_PASSAGENS);
  const [janela, setJanela] = useState(PADRAO_JANELA);
  const [recencia, setRecencia] = useState(PADRAO_RECENCIA);
  const [semTeto, setSemTeto] = useState(false);
  const [semPedidos, setSemPedidos] = useState(false);
  const [soRepetidos, setSoRepetidos] = useState(false);
  const [termo, setTermo] = useState("");
  // uma linha por cartão (padrão) ou uma por caso
  const [porCartao, setPorCartao] = useState(true);

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

  // trocar de aba fecha o pop-up do caso
  useEffect(() => {
    setCaso(null);
  }, [aba]);

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
  const diaDoCaso = caso ? txt(caso.data_ref).slice(0, 10) : "";

  /* A LISTA DE DIAS ROLA ATÉ O DIA ABERTO (16/09/2026). Ela é o cartão inteiro, do dia
     mais novo para o mais antigo; quem clicava num caso de 22/08 via a lista começando
     em 12/09 e achava que o pop-up tinha aberto no dia errado ("pq quando você abre o
     último dia é dia 12"). Rola só a lista, não a página. */
  const listaDiasRef = useRef(null);
  useEffect(() => {
    const lista = listaDiasRef.current;
    const el = lista?.querySelector(".gd-dia.on");
    if (!lista || !el) return;
    const caixa = lista.getBoundingClientRect();
    const item = el.getBoundingClientRect();
    if (item.top < caixa.top || item.bottom > caixa.bottom) {
      lista.scrollTop += item.top - caixa.top - 8;
    }
  }, [diaSel, carregandoGiros, cartaoAberto]);

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
  const cartoesAgrupados = useMemo(() => agruparPorCartao(filtrados), [filtrados]);
  const linhasDaVisao = porCartao ? cartoesAgrupados : filtrados;
  const visiveis = useMemo(
    () =>
      semTeto || linhasDaVisao.length <= MAX_LINHAS_GRADE
        ? linhasDaVisao
        : linhasDaVisao.slice(0, MAX_LINHAS_GRADE),
    [linhasDaVisao, semTeto],
  );
  const ocultos = linhasDaVisao.length - visiveis.length;

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
            className={`dp-tab${aba === "bloqueio" ? " is-active" : ""}`}
            onClick={() => setAba("bloqueio")}
            title="O que bloquear hoje — cartões com rajada em vários dias; a regra se ajusta nos campos da própria aba"
          >
            Bloqueio
          </button>
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

      {/* ═════════ BLOQUEIO — só o que precisa bloquear, pela regra dos campos da aba ═════════ */}
      {aba === "bloqueio" && <FraudeBloqueio modo="fila" />}

      {/* ══════════════════════════════ CASOS ══════════════════════════════ */}
      {aba === "casos" && (
        <>
          <div className="dp-viewbar">
            <div className="gd-fgroup">
              <span className="gd-flabel">Ver</span>
              <button
                type="button"
                className={`dp-chip-f${porCartao ? " on" : ""}`}
                onClick={() => setPorCartao(true)}
                title="Uma linha por cartão, juntando os casos que passaram nos filtros"
              >
                por cartão<span className="n">{cartoesAgrupados.length}</span>
              </button>
              <button
                type="button"
                className={`dp-chip-f${!porCartao ? " on" : ""}`}
                onClick={() => setPorCartao(false)}
                title="Uma linha por caso (bloco de passagens)"
              >
                por caso<span className="n">{filtrados.length}</span>
              </button>
            </div>

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
                    desenhando {MAX_LINHAS_GRADE} de {linhasDaVisao.length} — mostrar todas
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
            key={porCartao ? "cartao" : "caso"}
            chave={porCartao ? "guard_casos_cartao" : "guard_casos"}
            colunas={porCartao ? COLS_CARTOES : COLS_CASOS}
            linhas={visiveis}
            carregando={carregando}
            mensagemCarregando="Carregando casos do INOVE Guard…"
            idLinha={(l) => (porCartao ? l.cru_id : txt(l.id_evento_final))}
            classeLinha={(l) => {
              const n = porCartao ? l.maiorBloco : l.passagens;
              return n >= 10 ? "row-p1" : n >= 8 ? "row-p2" : "";
            }}
            aoClicarLinha={(l) => setCaso(porCartao ? l.recente : l)}
            nomeCsv={`inove_guard_fraudes_${porCartao ? "cartoes" : "casos"}_${isoDataLocal(new Date())}`}
            vazio={
              casos.length
                ? "Nenhum caso com estes filtros — afrouxe as passagens ou a janela."
                : "Nenhum caso no período. 👍"
            }
            pinPadrao={2}
          />

        </>
      )}

          {/* ── POP-UP DO CARTÃO: usos por dia + mapa + passagens ──────────
              Vive fora da grade de propósito. Enquanto era painel embaixo da
              tabela, abrir um caso empurrava a lista para fora da tela e a
              pessoa perdia o lugar onde estava. */}
          {caso && aba === "casos" && (
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
                      você abriu o caso de <b>{paraBR(caso.data_ref)}</b> · a lista de dias é o cartão
                      inteiro, do mais novo para o mais antigo.
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
                      <div className="gd-dias" ref={listaDiasRef}>
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
                            <span className="d">
                              {paraBR(d.dia)}
                              {d.dia === diaDoCaso ? <span className="gd-dia-clicado">caso aberto</span> : null}
                            </span>
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

      {/* ═══════════════════════ CARTÕES BLOQUEADOS ════════════════════════
          O ciclo de quem JÁ SAIU da fila (16/09/2026, dono: "os bloqueados têm que ficar
          em outra aba"): bloqueados, desbloqueados, "não é fraude" e o histórico. A aba
          Bloqueio mostra só o que precisa bloquear. */}
      {aba === "bloqueados" && <FraudeBloqueio modo="gestao" />}

      {/* ════════════════════════ COMO A REGRA FUNCIONA ════════════════════ */}
      {aba === "regra" && (
        <div className="gd-cards">
          <div className="gd-card">
            <h4>Bloqueio (a primeira aba)</h4>
            <ul>
              <li>
                <b>Rajada</b> = {REGRA_PADRAO.passagens}+ passagens que giraram a catraca em até{" "}
                {REGRA_PADRAO.minutos} min, dentro do mesmo bloco. A janela é deslizante: vale a pior
                janela do bloco.
              </li>
              <li>
                <b>Fraude</b> = rajada em {REGRA_PADRAO.diasComRajada}+ dias, seguidos ou não, nos
                últimos {REGRA_PADRAO.dias} dias da base (a base chega com uns 3 dias de atraso).
              </li>
              <li>
                Os quatro números são <b>campos</b> no topo da aba, junto com a data final da janela. A
                lista é recalculada na hora das passagens; "Voltar ao padrão" devolve a regra acima.
              </li>
              <li>
                O <b>robô de fraudes</b> (06:30) continua usando o padrão: ele põe na fila quem entra e
                tira o pendente que saiu da janela.
              </li>
              <li>
                <b>Desbloqueou, o cartão volta para esta aba</b>, marcado "desbloqueado" com o dia; se já
                não bater a regra, o robô o tira na rodada seguinte.
              </li>
              <li>
                Cartão que só aparece com a regra da tela entra marcado "só nesta regra"; bloquear ou
                descartar grava o cartão com a decisão e a regra usada fica no histórico.
              </li>
            </ul>
          </div>

          <div className="gd-card">
            <h4>Cartões bloqueados</h4>
            <ul>
              <li>Só os cartões que nós bloqueamos pelo INOVE.</li>
              <li>Desbloquear devolve o cartão para a aba Bloqueio — ele não fica guardado aqui.</li>
              <li>
                "Rajada depois?" avisa o bloqueado que ainda passou depois do dia do bloqueio — sinal de
                que a bilhetagem não aplicou.
              </li>
              <li>
                O Histórico mostra quem bloqueou, desbloqueou ou marcou "não é fraude", e quando; clicar
                na linha abre o cartão (o "não é fraude" volta para a fila por ali).
              </li>
            </ul>
          </div>

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
                A aba <b>Casos</b> apresenta e filtra os blocos que a origem já calculou; o único registro
                dela é o "Pedir bloqueio" (status do caso), que não põe o cartão na fila.
              </li>
              <li>
                As abas <b>Bloqueio</b> e <b>Cartões bloqueados</b> gravam a decisão sobre o cartão e o
                histórico — nunca a prova (passagens, valor, local).
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
