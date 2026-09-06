import { useCallback, useEffect, useMemo, useState } from "react";
import AbaShell from "./AbaShell";
import TabelaDP from "../TabelaDP";
import { lerDP360, lerTudoDP360 } from "../../../services/dp360Api";

/* ═══════════════════════════════════════════════════════════════════════════
   Refeição (Passo 1 do DP360)

   Fonte única desta aba: a tabela `ponto_intervalo` — snapshot da view
   `vw_ponto_intervalo_motorista_diario` (Athena). A REGRA de negócio é da view;
   a tela só a exibe. Nada é gravado nesta fase.

   Aparência: a da FERRAMENTA (Sistemas/PONTO/app/ui, `viewP1`) — barra de
   filtros enxuta, tabela densa de 13px com cabeçalho grudado e a LINHA pintada
   pelo status. Quem usa passa o dia lendo linha: a cor da linha é informação.

   Régua (constantes espelhadas da view e de ferramenta/simulador.py — mexeu
   aqui, confira lá):
     · 27 min  → piso do que conta como refeição
     · 360 min → jornada (medida pelo Citatti) que dispensa intervalo
     · 10 min  → tolerância entre o cartão e a sugestão, comparando SÓ o início
     · 30 min  → janela fixa que a importação grava
   ═══════════════════════════════════════════════════════════════════════════ */

const MIN_ALMOCO = 27;
const JORNADA_EXIGE_ALMOCO = 360;
const TOLERANCIA_TRANSNET_MIN = 10;
const IMPORTACAO_JANELA_MIN = 30;

// Teto de linhas por chamada aceito pelo gateway (supabase/functions/dp360-api).
const PASSO_DATAS = 5000;

/* ─────────────────────────── formatação ─────────────────────────── */

const num = (valor) => {
  const n = parseFloat(valor);
  return Number.isNaN(n) ? null : n;
};

// A view entrega `data_ref` em ISO. No app antigo isso vazava cru para a tela.
function fmtData(valor) {
  const iso = String(valor ?? "").slice(0, 10);
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!partes) return valor ? String(valor) : "—";
  return `${partes[3]}/${partes[2]}/${partes[1]}`;
}

// Minutos → "7h32" (jornada é sempre lida em horas pelo DP).
function fmtMin(valor) {
  const n = num(valor);
  if (n == null || n <= 0) return "—";
  const total = Math.round(n);
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, "0")}`;
}

const fmtDur = (valor) => {
  const n = num(valor);
  return n == null ? "—" : `${Math.round(n)} min`;
};

const fmtHora = (valor) => {
  const texto = String(valor ?? "").trim();
  return texto || "—";
};

const semAcento = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/* ─────────────────────── regra dos 27 minutos ───────────────────────
   Mesma de ferramenta/simulador.py::almoco_da_refeicao e de app.js::almocoRef.
   O CITATTI é a fonte principal. Abaixo de 27 min ele não pegou a refeição,
   pegou uma parada curta — aí vale o SST, que costuma trazer a janela certa
   (às vezes horas depois). Se nenhuma das duas alcança o piso, mostra o Citatti
   mesmo curto: vale o que a pessoa fez. */
function almocoRef(linha) {
  const citatti = num(linha.sugestao_duracao_min);
  const sst = num(linha.sugestao_sst_duracao_min);

  if (citatti != null && citatti >= MIN_ALMOCO) {
    return {
      ini: linha.sugestao_inicio,
      fim: linha.sugestao_fim,
      min: citatti,
      origem: "Citatti",
    };
  }
  if (sst != null && sst >= MIN_ALMOCO) {
    return {
      ini: linha.sugestao_sst_inicio,
      fim: linha.sugestao_sst_fim,
      min: sst,
      origem: "SST",
      detalhe:
        citatti == null
          ? "Sem Citatti nesse dia — usando SST"
          : `Citatti deu ${Math.round(citatti)} min (< ${MIN_ALMOCO}) — usando SST`,
    };
  }
  if (citatti != null) {
    return {
      ini: linha.sugestao_inicio,
      fim: linha.sugestao_fim,
      min: citatti,
      origem: "Citatti",
      detalhe: `Abaixo de ${MIN_ALMOCO} min e o SST também não alcança — vale o que ele fez`,
    };
  }
  return { ini: "", fim: "", min: null, origem: "" };
}

/* ─────────────────────────── status ───────────────────────────
   `status_almoco` vem da view. "DIVERGENTE" chega como
   "DIVERGENTE (transnet x sugestao)" — o casamento é por SUBSTRING. */
function chaveStatus(status) {
  const texto = String(status ?? "");
  if (texto.includes("DIVERGENTE")) return "DIV";
  return { SUGESTAO: "SUG", ABAIXO_27MIN: "AB", OK: "OK" }[texto] || "OUT";
}

// [rótulo curto, variante da pílula, classe da LINHA]
const ESTILO_STATUS = {
  OK: ["OK", "ok", "row-ok"],
  SUG: ["Sugestão", "warn", "row-sug"],
  DIV: ["Divergente", "warn", "row-sug"],
  AB: ["Abaixo 27min", "danger", "row-sem"],
  OUT: ["", "mute", ""],
};

function PilulaStatus({ status }) {
  const [rotulo, variante] = ESTILO_STATUS[chaveStatus(status)];
  return (
    <span className={`dp-pill ${variante}`} title={String(status ?? "") || "sem status"}>
      {rotulo || String(status ?? "") || "—"}
    </span>
  );
}

const classeLinha = (linha) => ESTILO_STATUS[chaveStatus(linha.status_almoco)][2];

/* ─────────────────────────── jornada ───────────────────────────
   A jornada do Passo 1 é a do CITATTI (operação), não a do ponto: o ponto é
   justamente o que está sendo auditado. O total do ponto entra só quando não
   há Citatti no dia — e aí aparece em cinza, para não ser lido como régua. */
function CelulaJornada({ linha }) {
  const citatti = num(linha.jornada_citatti_min);
  if (citatti != null) return <span className="dp-num">{fmtMin(citatti)}</span>;
  const ponto = num(linha.jornada_total_min);
  if (ponto == null) return <span className="dp-faint">—</span>;
  return (
    <span className="dp-faint dp-num" title="Sem Citatti nesse dia — jornada pelo ponto">
      {fmtMin(ponto)}
    </span>
  );
}

/* ─────────────────────────── colunas ───────────────────────────
   Formato do TabelaDP: `valor` é o que ORDENA e o que sai no CSV; `render` só
   desenha. Coluna calculada (realizado, importação, programado) SEM `valor`
   ordenaria pelo JSX — por isso todas trazem o par. Onde o `id` já é o campo da
   linha (`fonte`, `sugestao_origem`…) o `valor` fica de fora de propósito: a
   grade cai em `linha[id]`, que é exatamente o valor certo.

   Duas escolhas de `valor` que fogem do que aparece na tela:
     · HORA vai como texto cru ("12:34") — o `chaveOrd` da grade já entende hora,
       e é o mesmo que a pessoa lê; só o "—" do vazio é coisa do `render`.
     · DURAÇÃO vai como NÚMERO. "45 min" não casa com nenhum formato do
       `chaveOrd`, cairia no localeCompare e poria "100 min" antes de "45 min". */

const valorHora = (valor) => String(valor ?? "").trim();

const valorMin = (valor) => {
  const n = num(valor);
  return n == null ? "" : Math.round(n);
};

// Mesma régua da CelulaJornada: o Citatti manda, o ponto entra só na falta dele.
function valorJornada(linha) {
  const n = num(linha.jornada_citatti_min) ?? num(linha.jornada_total_min);
  return n == null || n <= 0 ? "" : fmtMin(n);
}

// Ordena/exporta o rótulo curto da pílula — é o que está na tela. O status cru
// ("DIVERGENTE (transnet x sugestao)") continua no title da pílula.
const valorStatus = (linha) => {
  const bruto = String(linha.status_almoco ?? "");
  return ESTILO_STATUS[chaveStatus(bruto)][0] || bruto;
};

const COL_CRACHA = {
  id: "cracha",
  rotulo: "Crachá",
  classe: "dp-mono dp-num",
  largura: 92,
  render: (r) => r.cracha || "—",
};
const COL_NOME = {
  id: "nm_funcionario",
  rotulo: "Nome",
  largura: 230,
  estilo: { fontWeight: 600 },
  render: (r) => r.nm_funcionario || "—",
};
const COL_DATA = {
  id: "data_ref",
  rotulo: "Data",
  classe: "dp-mono dp-num",
  largura: 104,
  valor: (r) => fmtData(r.data_ref),
};
const COL_JORNADA = {
  id: "jornada",
  rotulo: "Jornada",
  largura: 96,
  valor: valorJornada,
  render: (r) => <CelulaJornada linha={r} />,
};
const COL_STATUS = {
  id: "status_almoco",
  rotulo: "Status",
  largura: 132,
  valor: valorStatus,
  render: (r) => <PilulaStatus status={r.status_almoco} />,
};

// TODOS · Sugestão · Divergente — o "Realizado" aqui já é o da regra dos 27 min.
const COLUNAS_PADRAO = [
  COL_CRACHA,
  COL_NOME,
  COL_DATA,
  COL_JORNADA,
  { id: "fonte", rotulo: "Fonte", largura: 120, render: (r) => r.fonte || "—" },
  {
    id: "rea_ini",
    rotulo: "Realizado início",
    classe: "dp-mono dp-num",
    largura: 132,
    valor: (r) => valorHora(almocoRef(r).ini),
    render: (r) => fmtHora(almocoRef(r).ini),
  },
  {
    id: "rea_fim",
    rotulo: "Realizado fim",
    classe: "dp-mono dp-num",
    largura: 132,
    valor: (r) => valorHora(almocoRef(r).fim),
    render: (r) => fmtHora(almocoRef(r).fim),
  },
  {
    id: "rea_dur",
    rotulo: "Duração intervalo",
    classe: "dp-mono dp-num",
    largura: 144,
    valor: (r) => valorMin(almocoRef(r).min),
    render: (r) => fmtDur(almocoRef(r).min),
  },
  {
    id: "imp_ini",
    rotulo: "Importação início",
    classe: "dp-mono dp-num",
    largura: 132,
    valor: (r) => valorHora(r.importacao_inicio),
    render: (r) => fmtHora(r.importacao_inicio),
  },
  {
    id: "imp_fim",
    rotulo: "Importação fim",
    classe: "dp-mono dp-num",
    largura: 132,
    valor: (r) => valorHora(r.importacao_fim),
    render: (r) => fmtHora(r.importacao_fim),
  },
  {
    id: "imp_dur",
    rotulo: "Duração importação",
    classe: "dp-mono dp-num",
    largura: 144,
    valor: (r) => valorMin(r.importacao_duracao_min),
    render: (r) => fmtDur(r.importacao_duracao_min),
  },
  {
    id: "prog_ini",
    rotulo: "Programado início",
    classe: "dp-mono dp-num",
    largura: 132,
    valor: (r) => valorHora(r.programado_inicio),
    render: (r) => fmtHora(r.programado_inicio),
  },
  {
    id: "prog_fim",
    rotulo: "Programado fim",
    classe: "dp-mono dp-num",
    largura: 132,
    valor: (r) => valorHora(r.programado_fim),
    render: (r) => fmtHora(r.programado_fim),
  },
  {
    id: "prog_dur",
    rotulo: "Duração programado",
    classe: "dp-mono dp-num",
    largura: 144,
    valor: (r) => valorMin(r.programado_duracao_min),
    render: (r) => fmtDur(r.programado_duracao_min),
  },
  COL_STATUS,
];

// Abaixo 27min — aqui o "Realizado" é o valor CRU do Citatti (`sugestao_*`),
// sem a troca pelo SST: é exatamente esse número curto que está em discussão.
const COLUNAS_ABAIXO = [
  COL_CRACHA,
  COL_NOME,
  COL_DATA,
  COL_JORNADA,
  {
    id: "sug_ini",
    rotulo: "Realizado início",
    classe: "dp-mono dp-num",
    largura: 132,
    valor: (r) => valorHora(r.sugestao_inicio),
    render: (r) => fmtHora(r.sugestao_inicio),
  },
  {
    id: "sug_fim",
    rotulo: "Realizado fim",
    classe: "dp-mono dp-num",
    largura: 132,
    valor: (r) => valorHora(r.sugestao_fim),
    render: (r) => fmtHora(r.sugestao_fim),
  },
  {
    id: "sug_dur",
    rotulo: "Duração intervalo",
    classe: "dp-mono dp-num",
    largura: 144,
    valor: (r) => valorMin(r.sugestao_duracao_min),
    render: (r) => fmtDur(r.sugestao_duracao_min),
  },
  { id: "sugestao_origem", rotulo: "Origem", largura: 120, render: (r) => r.sugestao_origem || "—" },
  COL_STATUS,
];

// OK — não há o que conferir: grade reduzida, só para confirmar o motivo.
const COLUNAS_OK = [
  COL_CRACHA,
  COL_NOME,
  COL_DATA,
  COL_JORNADA,
  { id: "jornada_origem", rotulo: "Origem jornada", largura: 160, render: (r) => r.jornada_origem || "—" },
  COL_STATUS,
];

const colunasDoFiltro = (filtro) =>
  filtro === "AB" ? COLUNAS_ABAIXO : filtro === "OK" ? COLUNAS_OK : COLUNAS_PADRAO;

/* Uma chave de preferência POR CONJUNTO de colunas (`tbl_p1_sug`, `tbl_p1_ab`,
   `tbl_p1_red`, como na ferramenta original). Chave única para os três faria a
   coluna escondida no "Abaixo 27min" sumir também no padrão — e o `sortKey` de
   uma grade apontaria para uma coluna que não existe na outra. */
const chaveTabelaDoFiltro = (filtro) =>
  filtro === "AB" ? "p1_ab" : filtro === "OK" ? "p1_red" : "p1_sug";

const FILTROS = [
  ["TODOS", "Todos"],
  ["SUG", "Sugestão"],
  ["AB", "Abaixo 27min"],
  ["DIV", "Divergente"],
  ["OK", "OK"],
];

/* ─────────────────────────── leitura ───────────────────────────
   As datas mudam pouco e custam uma varredura da coluna inteira; ficam em
   cache de módulo (o app antigo fazia igual com IVDATAS). O botão Recarregar
   limpa o cache. */
let cacheDatas = null;

async function buscarDatas() {
  if (cacheDatas) return cacheDatas;
  const vistas = new Set();
  for (let pagina = 0; pagina < 12; pagina += 1) {
    const bloco = await lerDP360("ponto_intervalo", {
      colunas: "data_ref",
      ordem: "data_ref.desc",
      limite: PASSO_DATAS,
      offset: pagina * PASSO_DATAS,
    });
    bloco.forEach((linha) => {
      const dia = String(linha.data_ref ?? "").slice(0, 10);
      if (dia) vistas.add(dia);
    });
    if (bloco.length < PASSO_DATAS) break;
  }
  cacheDatas = Array.from(vistas).sort().reverse();
  return cacheDatas;
}

const buscarLinhas = (data) =>
  lerTudoDP360("ponto_intervalo", {
    filtros: { data_ref: `eq.${data}` },
    ordem: "cracha.asc",
  });

/* ─────────────────────── painel de detalhe ─────────────────────── */

const ESTILO_ROTULO = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

function BlocoIntervalo({ titulo, inicio, fim, duracao, nota, destaque }) {
  const temJanela = String(inicio ?? "").trim() || String(fim ?? "").trim();
  return (
    <div
      className="dp-card"
      style={
        destaque
          ? { borderColor: "var(--dp-accent)", background: "var(--dp-accent-soft)" }
          : { background: "var(--dp-surface-2)" }
      }
    >
      <div className="dp-muted" style={ESTILO_ROTULO}>
        {titulo}
      </div>
      <div className="dp-mono dp-num" style={{ marginTop: 6, fontSize: 14, fontWeight: 600 }}>
        {temJanela ? `${fmtHora(inicio)} – ${fmtHora(fim)}` : "—"}
      </div>
      <div className="dp-muted dp-num" style={{ marginTop: 2, fontSize: 12 }}>
        {fmtDur(duracao)}
      </div>
      {nota && (
        <div className="dp-faint" style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.5 }}>
          {nota}
        </div>
      )}
    </div>
  );
}

function PainelDetalhe({ linha, aoFechar }) {
  const aplicado = almocoRef(linha);
  const diferenca = num(linha.diferenca_transnet_min);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(15, 20, 32, 0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
        padding: 20,
      }}
      onClick={aoFechar}
      role="presentation"
    >
      <div
        className="dp-card"
        style={{ width: 880, maxWidth: "95vw", padding: 20 }}
        onClick={(evento) => evento.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Detalhe da refeição"
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 650 }}>{linha.nm_funcionario || "—"}</div>
            <div className="dp-muted" style={{ marginTop: 3, fontSize: 12.5 }}>
              Crachá {linha.cracha || "—"} · {fmtData(linha.data_ref)} · Jornada{" "}
              <CelulaJornada linha={linha} />
            </div>
            <div style={{ marginTop: 8 }}>
              <PilulaStatus status={linha.status_almoco} />
            </div>
          </div>
          <button type="button" className="dp-btn" onClick={aoFechar} aria-label="Fechar detalhe">
            ✕
          </button>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          }}
        >
          {/* O batido no ponto é o que gera o "Divergente" — e no app antigo ele
              não aparecia em tela nenhuma. Mostrar aqui é melhoria proposital. */}
          <BlocoIntervalo
            titulo="Batido no ponto (Transnet)"
            inicio={linha.transnet_almoco_inicio}
            fim={linha.transnet_almoco_fim}
            duracao={linha.transnet_almoco_duracao_min}
            nota="Da 2ª e 3ª batida do cartão. É contra ele que a sugestão é comparada."
          />
          <BlocoIntervalo
            titulo="Sugestão Citatti"
            inicio={linha.sugestao_inicio}
            fim={linha.sugestao_fim}
            duracao={linha.sugestao_duracao_min}
            nota={linha.sugestao_origem ? `Origem: ${linha.sugestao_origem}` : null}
          />
          <BlocoIntervalo
            titulo="Sugestão SST"
            inicio={linha.sugestao_sst_inicio}
            fim={linha.sugestao_sst_fim}
            duracao={linha.sugestao_sst_duracao_min}
            nota={`Entra no lugar do Citatti quando ele fica abaixo de ${MIN_ALMOCO} min.`}
          />
          <BlocoIntervalo
            titulo="Programado (escala)"
            inicio={linha.programado_inicio}
            fim={linha.programado_fim}
            duracao={linha.programado_duracao_min}
          />
          <BlocoIntervalo
            titulo="Importação"
            inicio={linha.importacao_inicio}
            fim={linha.importacao_fim}
            duracao={linha.importacao_duracao_min}
            nota={`Janela fixa de ${IMPORTACAO_JANELA_MIN} min a partir do início da sugestão.`}
          />
          <BlocoIntervalo
            destaque
            titulo={`Realizado (regra dos ${MIN_ALMOCO} min)`}
            inicio={aplicado.ini}
            fim={aplicado.fim}
            duracao={aplicado.min}
            nota={
              aplicado.origem
                ? `Origem aplicada: ${aplicado.origem}${aplicado.detalhe ? ` · ${aplicado.detalhe}` : ""}`
                : "Sem intervalo utilizável nas duas fontes."
            }
          />
        </div>

        <div
          style={{
            marginTop: 10,
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          }}
        >
          <div className="dp-card">
            <div className="dp-muted" style={ESTILO_ROTULO}>
              Diferença cartão × sugestão
            </div>
            <div className="dp-mono dp-num" style={{ marginTop: 6, fontSize: 14, fontWeight: 600 }}>
              {diferenca == null ? "—" : `${Math.round(diferenca)} min`}
            </div>
            <div className="dp-faint" style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.5 }}>
              Compara só o INÍCIO. Acima de {TOLERANCIA_TRANSNET_MIN} min vira Divergente.
            </div>
          </div>
          <div className="dp-card">
            <div className="dp-muted" style={ESTILO_ROTULO}>
              Fonte
            </div>
            <div style={{ marginTop: 6, fontSize: 14, fontWeight: 600 }}>{linha.fonte || "—"}</div>
            <div className="dp-faint" style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.5 }}>
              Quem decidiu o veredito do dia, conforme a view do ponto.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── legenda ─────────────────────────── */

function Legenda() {
  const item = (titulo, texto) => (
    <li key={titulo} style={{ lineHeight: 1.6 }}>
      <span style={{ fontWeight: 650 }}>{titulo}</span> <span className="dp-muted">{texto}</span>
    </li>
  );
  return (
    <div className="dp-card" style={{ margin: "0 20px 20px", background: "var(--dp-surface-2)" }}>
      <div className="dp-muted" style={ESTILO_ROTULO}>
        Como a régua funciona
      </div>
      <ul
        style={{
          margin: "10px 0 0",
          padding: 0,
          listStyle: "none",
          display: "grid",
          gap: 6,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          fontSize: 12.5,
        }}
      >
        {item(
          `Refeição mínima: ${MIN_ALMOCO} min.`,
          "Abaixo disso o Citatti pegou uma parada, não o almoço — cai para o SST; se o SST também não alcança, vale o que a pessoa fez.",
        )}
        {item(
          `Dispensa de intervalo: ${JORNADA_EXIGE_ALMOCO} min (6h).`,
          "Jornada menor que isso, medida pelo Citatti, já entra como OK — não precisa de refeição.",
        )}
        {item(
          `Tolerância cartão × sugestão: ${TOLERANCIA_TRANSNET_MIN} min.`,
          "Compara SÓ o início do intervalo. Passou disso, o dia vira Divergente.",
        )}
        {item(
          `Importação: janela fixa de ${IMPORTACAO_JANELA_MIN} min.`,
          "O arquivo grava sempre 30 min a partir do início sugerido, não a duração realizada.",
        )}
      </ul>
      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
        <PilulaStatus status="OK" />
        <PilulaStatus status="SUGESTAO" />
        <PilulaStatus status="DIVERGENTE (transnet x sugestao)" />
        <PilulaStatus status="ABAIXO_27MIN" />
      </div>
    </div>
  );
}

/* ─────────────────────────── tela ─────────────────────────── */

export default function Refeicao() {
  const [datas, setDatas] = useState([]);
  const [data, setData] = useState("");
  const [linhas, setLinhas] = useState([]);
  const [carregandoDatas, setCarregandoDatas] = useState(true);
  const [carregandoLinhas, setCarregandoLinhas] = useState(false);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("TODOS");
  const [busca, setBusca] = useState("");
  const [detalhe, setDetalhe] = useState(null);
  const [recarga, setRecarga] = useState(0);

  // 1) datas disponíveis (default = mais recente)
  useEffect(() => {
    let ativo = true;
    setCarregandoDatas(true);
    setErro("");
    buscarDatas()
      .then((lista) => {
        if (!ativo) return;
        setDatas(lista);
        setData((atual) => (atual && lista.includes(atual) ? atual : lista[0] || ""));
      })
      .catch((falha) => {
        if (ativo) setErro(falha.message || "Falha ao consultar as datas do intervalo.");
      })
      .finally(() => {
        if (ativo) setCarregandoDatas(false);
      });
    return () => {
      ativo = false;
    };
  }, [recarga]);

  // 2) linhas do dia escolhido
  useEffect(() => {
    if (!data) {
      setLinhas([]);
      return undefined;
    }
    let ativo = true;
    setCarregandoLinhas(true);
    setErro("");
    buscarLinhas(data)
      .then((lista) => {
        if (ativo) setLinhas(lista);
      })
      .catch((falha) => {
        if (!ativo) return;
        setLinhas([]);
        setErro(falha.message || "Falha ao consultar o intervalo desse dia.");
      })
      .finally(() => {
        if (ativo) setCarregandoLinhas(false);
      });
    return () => {
      ativo = false;
    };
  }, [data, recarga]);

  // Esc fecha o detalhe.
  useEffect(() => {
    if (!detalhe) return undefined;
    const aoTeclar = (evento) => {
      if (evento.key === "Escape") setDetalhe(null);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [detalhe]);

  const recarregar = useCallback(() => {
    cacheDatas = null;
    setDetalhe(null);
    setRecarga((n) => n + 1);
  }, []);

  // Contagens dos chips: sempre sobre o dia inteiro, não sobre a busca — é assim
  // que o DP lê "quantos ficaram para importar hoje".
  const contagens = useMemo(() => {
    const conta = { TODOS: linhas.length, SUG: 0, AB: 0, DIV: 0, OK: 0 };
    linhas.forEach((linha) => {
      const chave = chaveStatus(linha.status_almoco);
      if (conta[chave] !== undefined) conta[chave] += 1;
    });
    return conta;
  }, [linhas]);

  const visiveis = useMemo(() => {
    const termos = semAcento(busca).split(/\s+/).filter(Boolean);
    return linhas.filter((linha) => {
      if (filtro !== "TODOS" && chaveStatus(linha.status_almoco) !== filtro) return false;
      if (!termos.length) return true;
      const alvo = semAcento(`${linha.nm_funcionario ?? ""} ${linha.cracha ?? ""}`);
      return termos.every((termo) => alvo.includes(termo));
    });
  }, [linhas, filtro, busca]);

  const colunas = colunasDoFiltro(filtro);

  return (
    <AbaShell
      resumo="Confere o intervalo de cada motorista contra a operação e prepara o que precisa ser importado. Somente leitura — nada é gravado nesta tela."
      carregando={carregandoDatas}
      erro={erro}
      filtros={
        !datas.length ? null : (
        <>
          <select
            value={data}
            onChange={(evento) => {
              setData(evento.target.value);
              setDetalhe(null);
            }}
            aria-label="Data do intervalo"
          >
            {datas.map((dia) => (
              <option key={dia} value={dia}>
                {fmtData(dia)}
              </option>
            ))}
          </select>

          <input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por nome ou crachá"
            style={{ width: 250 }}
          />

          <button type="button" className="dp-btn" onClick={recarregar}>
            ↻ Recarregar
          </button>

          <span className="dp-muted dp-num" style={{ marginLeft: "auto", fontSize: 12 }}>
            {visiveis.length} de {linhas.length} linha{linhas.length === 1 ? "" : "s"} do dia
          </span>
        </>
        )
      }
    >
      {!datas.length ? (
        <div className="dp-resumo">
          Nenhuma data disponível em <code>ponto_intervalo</code>.
        </div>
      ) : (
        <>
          {/* chips de filtro + o que sobrou para importar */}
          <div className="dp-viewbar" style={{ paddingTop: 4 }}>
            {FILTROS.map(([chave, rotulo]) => (
              <button
                key={chave}
                type="button"
                className={`dp-chip-f${filtro === chave ? " on" : ""}`}
                onClick={() => setFiltro(chave)}
              >
                {rotulo} <span className="n">{contagens[chave] ?? 0}</span>
              </button>
            ))}

            {/* TODO(DP360 fase 5): "Gerar importação" monta o arquivo de batidas
                (`ponto2_sugerido`/`ponto3_sugerido`) e quem sobe isso no Transnet é o
                robô — não existe nesta fase, que é só de leitura. Quando entrar:
                registrar o log em `ponto_importacoes` e disparar o workflow com escopo
                explícito; nunca gravar direto no cartão a partir da tela. */}
            <button
              type="button"
              className="dp-btn primary"
              disabled
              title="Depende do robô que sobe as batidas no Transnet — ainda não portado para o INOVE."
              style={{ marginLeft: "auto" }}
            >
              ⬇ Gerar importação
            </button>

            {contagens.SUG ? (
              <span className="dp-pill warn">{contagens.SUG} para importar</span>
            ) : (
              <span className="dp-faint" style={{ fontSize: 12 }}>
                Nada para importar nesse dia
              </span>
            )}
          </div>

          {/* grade — ordenar/⚙/fixar/CSV vêm da grade compartilhada. A chave muda
              com o conjunto de colunas, senão a preferência de um filtro estraga
              a do outro. */}
          <TabelaDP
            chave={chaveTabelaDoFiltro(filtro)}
            colunas={colunas}
            linhas={visiveis}
            classeLinha={classeLinha}
            aoClicarLinha={(linha) => setDetalhe(linha)}
            idLinha={(linha) => `${linha.cracha}|${linha.data_ref}`}
            nomeCsv={`refeicao_${data}`}
            vazio="Nada nesse dia com esse filtro."
            carregando={carregandoLinhas}
            mensagemCarregando={`Carregando o intervalo de ${fmtData(data)}…`}
          />

          <Legenda />
        </>
      )}

      {detalhe && <PainelDetalhe linha={detalhe} aoFechar={() => setDetalhe(null)} />}
    </AbaShell>
  );
}
