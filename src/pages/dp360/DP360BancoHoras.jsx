// DP360 · Banco de Horas — porte da tela `viewBancoHoras` da ferramenta original
// (Sistemas/PONTO/app/ui/app.js) sobre o gateway `dp360-api`.
//
// ⚠ DADO DE FOLHA. Esta e a unica tela do INOVE que le a tabela `banco_horas`:
// hora extra e VALOR EM R$ por colaborador. Consequencias, que valem para qualquer
// manutencao futura aqui:
//   1. SOMENTE LEITURA. A tabela entrou na allowlist do gateway sem `escrever`
//      (supabase/functions/dp360-api/index.ts) — nao ha, e nao deve haver, gravacao.
//   2. NENHUM `console.log`/`console.error` com linha, nome, valor ou cracha. Log de
//      navegador vaza em screenshot, sessao compartilhada e ferramenta de suporte.
//   3. Sem exportacao (CSV/download) nesta fase — a decisao foi conscientemente
//      adiada. TODO: se um dia liberar, exigir registro de quem exportou.
//   4. Acesso e exclusivo de Administrador em DOIS pontos: `canUserAccessPageKey`
//      barra qualquer chave `dp360_*` para nao-admin, e o gateway confere de novo no
//      servidor. O gate da tela nao substitui o do servidor.
//
// O QUE A TELA MOSTRA (e o porque de nao ser so um SELECT bonito):
// o saldo do banco de horas nao existe pronto no datalake — e o APURADO no ponto
// menos o PAGO na folha, acumulado mes a mes. A coluna `saldo_acumulado_h` ja traz
// esse acumulado corrido, entao a competencia MAIS RECENTE ja responde "quem deve e
// quem tem a receber" sem varrer a base inteira.
//
// COMPETENCIA EM ABERTO: o ponto fecha o mes antes de a folha pagar, entao o mes
// corrente aparece com apurado cheio e pago zero — passivo fantasma. A regra do
// original (`_bh_abertas` no main.py) e por PROPORCAO, sobre a unidade inteira:
// mes fechado paga ~95% do que apurou, mes aberto fica perto de zero; o corte em 20%
// separa os dois com folga. Aqui isso vira um aviso em cima da tabela.
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, RefreshCw, Search, X } from "lucide-react";
import { AuthContext } from "../../context/AuthContext";
import { useAccessGovernance } from "../../context/AccessContext";
import { canUserAccessPath } from "../../utils/access";
import { lerDP360, lerTudoDP360 } from "../../services/dp360Api";
import "./dp360.css";

const TABELA = "banco_horas";

// Colunas EXATAS que existem na tabela. Pedir uma coluna inexistente devolve HTTP 400
// no gateway e derruba a tela inteira — nao acrescente nada sem conferir no banco.
// `celular` existe e NAO entra: dado pessoal que esta tela nao precisa.
const COLUNAS_LISTA = [
  "cracha", "colaborador", "funcao", "situacao", "competencia",
  "he_apurada_h", "he_paga_h", "debito_h", "banco_pago_h",
  "he_pago_rs", "banco_pago_rs", "movimento_h", "saldo_acumulado_h",
].join(",");

const COLUNAS_EXTRATO = [
  "cracha", "colaborador", "funcao", "situacao",
  "admissao", "desligamento", "afastado_desde", "afastado_ate", "competencia",
  "he_apurada_h", "he_paga_h", "debito_h", "banco_pago_h",
  "he_pago_rs", "banco_pago_rs", "movimento_h", "saldo_acumulado_h",
].join(",");

// Mesmas opcoes do original: o padrao e "ativos e afastados", que e o passivo em
// aberto — o saldo de quem saiu ja foi acertado na rescisao.
const SITUACOES = [
  { id: "abertos", label: "Ativos e afastados", valores: ["ativo", "afastado"] },
  { id: "ativo", label: "Só ativos", valores: ["ativo"] },
  { id: "afastado", label: "Só afastados", valores: ["afastado"] },
  { id: "inativo", label: "Só desligados", valores: ["inativo"] },
  { id: "todos", label: "Todas as situações", valores: null },
];

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/* ── numeros ─────────────────────────────────────────────────────────────────
   O importador grava numero como texto e as vezes com virgula decimal — o
   `_bh_num` do original faz exatamente esta troca antes de somar. Sem isso,
   "12,5" vira NaN e o saldo da pessoa some da conta.                          */
function num(valor) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const umaCasa = (v) => (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const emReais = (v) => (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 34.5 -> "34:30", com sinal. Conta em minutos inteiros de proposito: arredondar a
// fracao separadamente produz "34:60" quando o valor e 34,999.
function emHoras(v) {
  if (v == null) return "—";
  const total = Math.round(Math.abs(v) * 60);
  return `${v < 0 ? "−" : ""}${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// "2026-08" (ou "2026-08-01") -> "ago/26"
function rotuloComp(c) {
  const partes = String(c || "").slice(0, 7).split("-");
  if (partes.length !== 2) return c || "—";
  return `${MESES[Number(partes[1]) - 1] || partes[1]}/${partes[0].slice(2)}`;
}

function dataBR(valor) {
  const iso = String(valor || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

const chaveComp = (c) => String(c || "").slice(0, 7);
const normalizar = (v) => String(v ?? "").trim().toLocaleLowerCase("pt-BR");

// Zero exato quase nao existe em hora apurada; o original trata |x| < 1h como
// "quitado" para nao pintar de vermelho quem deve 4 minutos.
function classeSinal(v) {
  if (v >= 1) return "ok";
  if (v <= -1) return "danger";
  return "mute";
}
function corSinal(v) {
  if (v >= 1) return "var(--dp-ok-ink)";
  if (v <= -1) return "var(--dp-danger-ink)";
  return "var(--dp-muted)";
}

function linhaNormalizada(l) {
  return {
    cracha: String(l.cracha ?? "").trim(),
    nome: l.colaborador || "",
    funcao: l.funcao || "",
    situacao: String(l.situacao ?? "").trim(),
    competencia: chaveComp(l.competencia),
    apurada: num(l.he_apurada_h),
    paga: num(l.he_paga_h),
    debito: num(l.debito_h),
    bancoH: num(l.banco_pago_h),
    reais: num(l.he_pago_rs) + num(l.banco_pago_rs),
    movimento: num(l.movimento_h),
    acumulado: num(l.saldo_acumulado_h),
  };
}

/* Competencias em que a folha ainda nao rodou. Propriedade do MES, nao da pessoa —
   por isso a conta corre sobre TODAS as linhas carregadas, antes de qualquer filtro
   de situacao: um aprendiz que nunca fez hora extra tem todo mes com pago zero, e
   nem por isso o mes esta aberto. */
function competenciasAbertas(linhas) {
  const apurado = new Map();
  const pago = new Map();
  linhas.forEach((l) => {
    if (!l.competencia) return;
    apurado.set(l.competencia, (apurado.get(l.competencia) || 0) + l.apurada);
    pago.set(l.competencia, (pago.get(l.competencia) || 0) + l.paga + l.bancoH);
  });
  const abertas = new Set();
  apurado.forEach((a, c) => {
    if (a > 0 && (pago.get(c) || 0) < 0.2 * a) abertas.add(c);
  });
  return abertas;
}

// Lista de competencias do seletor a partir do primeiro e do ultimo mes da tabela.
// Duas leituras de 1 linha resolvem: o PostgREST nao faz DISTINCT, e varrer a base
// so para montar um <select> custaria ~16 idas ao gateway.
function faixaDeCompetencias(primeira, ultima) {
  const ini = chaveComp(primeira);
  const fim = chaveComp(ultima);
  if (!/^\d{4}-\d{2}$/.test(ini) || !/^\d{4}-\d{2}$/.test(fim)) {
    return [fim, ini].filter((c) => /^\d{4}-\d{2}$/.test(c));
  }
  const saida = [];
  let ano = Number(ini.slice(0, 4));
  let mes = Number(ini.slice(5, 7));
  const anoFim = Number(fim.slice(0, 4));
  const mesFim = Number(fim.slice(5, 7));
  // teto de seguranca: se a base vier com uma competencia maluca, nao trava a aba
  for (let i = 0; i < 600 && (ano < anoFim || (ano === anoFim && mes <= mesFim)); i += 1) {
    saida.push(`${ano}-${String(mes).padStart(2, "0")}`);
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  return saida.reverse();
}

// A competencia pode estar gravada como "2026-08" (texto) ou "2026-08-01" (data). O
// filtro por faixa funciona nos dois formatos; `eq.` so funcionaria no primeiro.
function filtroDaCompetencia(comp, formatoLongo) {
  if (!comp || comp === "todas") return undefined;
  if (formatoLongo) return { competencia: [`gte.${comp}-01`, `lte.${comp}-31`] };
  return { competencia: `eq.${comp}` };
}

export default function DP360BancoHoras() {
  const { user } = useContext(AuthContext);
  const { profileMap } = useAccessGovernance();
  const podeAcessar = canUserAccessPath(user, "/dp360-banco-horas", profileMap);

  const [competencias, setCompetencias] = useState([]);
  const [formatoLongo, setFormatoLongo] = useState(false);
  const [comp, setComp] = useState("");
  const [situacao, setSituacao] = useState("abertos");
  const [busca, setBusca] = useState("");

  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [recarga, setRecarga] = useState(0);

  const [pessoaSel, setPessoaSel] = useState(null);
  const [extrato, setExtrato] = useState({ carregando: false, erro: "", linhas: [], pessoa: null });

  /* ── passo 1: descobrir a faixa de competencias (2 leituras de 1 linha) ── */
  useEffect(() => {
    if (!podeAcessar) return undefined;
    let ativo = true;
    setCarregando(true);
    setErro("");
    Promise.all([
      lerDP360(TABELA, { colunas: "competencia", ordem: "competencia.asc", limite: 1 }),
      lerDP360(TABELA, { colunas: "competencia", ordem: "competencia.desc", limite: 1 }),
    ])
      .then(([inicio, fim]) => {
        if (!ativo) return;
        const primeira = inicio?.[0]?.competencia || "";
        const ultima = fim?.[0]?.competencia || "";
        setFormatoLongo(String(ultima).length > 7);
        const lista = faixaDeCompetencias(primeira, ultima);
        setCompetencias(lista);
        setComp((atual) => atual || lista[0] || "");
        if (!lista.length) setCarregando(false);
      })
      .catch((falha) => {
        if (!ativo) return;
        setErro(falha?.message || "Não foi possível consultar a base DP360.");
        setCarregando(false);
      });
    return () => { ativo = false; };
  }, [podeAcessar, recarga]);

  /* ── passo 2: carregar as linhas da competencia escolhida ──
     Uma competencia = ~1 pagina (uma linha por colaborador). "Todas" varre a base
     inteira, por isso e uma escolha explicita e nunca o padrao.               */
  useEffect(() => {
    if (!podeAcessar || !comp) return undefined;
    let ativo = true;
    setCarregando(true);
    setErro("");
    lerTudoDP360(TABELA, {
      colunas: COLUNAS_LISTA,
      filtros: filtroDaCompetencia(comp, formatoLongo),
      ordem: "competencia.asc,cracha.asc",
    })
      .then((dados) => { if (ativo) setLinhas(dados.map(linhaNormalizada)); })
      .catch((falha) => {
        if (!ativo) return;
        setLinhas([]);
        setErro(falha?.message || "Não foi possível consultar a base DP360.");
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [podeAcessar, comp, formatoLongo, recarga]);

  /* ── extrato da pessoa (o `get_banco_horas_pessoa` do original) ── */
  useEffect(() => {
    const cracha = pessoaSel?.cracha;
    if (!cracha) return undefined;
    // O gateway recusa valor de filtro com & ou # — cracha e numerico, mas se vier
    // sujo a tela avisa em vez de estourar um 400 sem explicacao.
    if (!/^[A-Za-z0-9._-]+$/.test(cracha)) {
      setExtrato({ carregando: false, erro: "Crachá em formato inesperado.", linhas: [], pessoa: null });
      return undefined;
    }
    let ativo = true;
    setExtrato({ carregando: true, erro: "", linhas: [], pessoa: null });
    lerDP360(TABELA, {
      colunas: COLUNAS_EXTRATO,
      filtros: { cracha: `eq.${cracha}` },
      ordem: "competencia.asc",
      limite: 500,
    })
      .then((dados) => {
        if (!ativo) return;
        const cru = dados[0] || null;
        setExtrato({
          carregando: false,
          erro: "",
          linhas: dados.map(linhaNormalizada),
          pessoa: cru && {
            nome: cru.colaborador || "",
            cracha: String(cru.cracha ?? "").trim(),
            funcao: cru.funcao || "",
            situacao: cru.situacao || "",
            admissao: dataBR(cru.admissao),
            desligamento: dataBR(cru.desligamento),
            afastadoDesde: dataBR(cru.afastado_desde),
            afastadoAte: dataBR(cru.afastado_ate),
          },
        });
      })
      .catch((falha) => {
        if (!ativo) return;
        setExtrato({
          carregando: false,
          erro: falha?.message || "Não foi possível carregar o extrato.",
          linhas: [],
          pessoa: null,
        });
      });
    return () => { ativo = false; };
  }, [pessoaSel]);

  const fecharExtrato = useCallback(() => {
    setPessoaSel(null);
    setExtrato({ carregando: false, erro: "", linhas: [], pessoa: null });
  }, []);

  useEffect(() => {
    if (!pessoaSel) return undefined;
    const aoTeclar = (e) => { if (e.key === "Escape") fecharExtrato(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [pessoaSel, fecharExtrato]);

  // abertas: sobre TODAS as linhas carregadas, antes do filtro de situacao
  const abertas = useMemo(() => competenciasAbertas(linhas), [linhas]);

  const filtradas = useMemo(() => {
    const alvo = SITUACOES.find((s) => s.id === situacao)?.valores || null;
    return linhas.filter((l) => !alvo || alvo.includes(normalizar(l.situacao)));
  }, [linhas, situacao]);

  // Em "todas as competências" a tabela vira uma linha por pessoa: soma os meses e
  // leva o `saldo_acumulado_h` da ULTIMA competencia (que ja e o saldo corrido).
  const agregadas = useMemo(() => {
    if (comp !== "todas") return filtradas;
    const porPessoa = new Map();
    filtradas.forEach((l) => {
      const atual = porPessoa.get(l.cracha);
      if (!atual) {
        porPessoa.set(l.cracha, { ...l, meses: 1, ultima: l.competencia });
        return;
      }
      atual.meses += 1;
      atual.apurada += l.apurada;
      atual.paga += l.paga;
      atual.debito += l.debito;
      atual.bancoH += l.bancoH;
      atual.reais += l.reais;
      atual.movimento += l.movimento;
      if (l.competencia >= atual.ultima) {
        atual.ultima = l.competencia;
        atual.acumulado = l.acumulado;
        atual.situacao = l.situacao;
        atual.nome = l.nome || atual.nome;
        atual.funcao = l.funcao || atual.funcao;
      }
    });
    return [...porPessoa.values()];
  }, [filtradas, comp]);

  const visiveis = useMemo(() => {
    const q = normalizar(busca);
    const base = q
      ? agregadas.filter((l) => normalizar(l.nome).includes(q)
        || normalizar(l.cracha).includes(q)
        || normalizar(l.funcao).includes(q))
      : agregadas;
    return [...base].sort((a, b) => b.acumulado - a.acumulado);
  }, [agregadas, busca]);

  const resumo = useMemo(() => {
    const receber = visiveis.filter((l) => l.acumulado >= 1).length;
    const devendo = visiveis.filter((l) => l.acumulado <= -1).length;
    return {
      pessoas: visiveis.length,
      receber,
      devendo,
      quitados: visiveis.length - receber - devendo,
      saldo: visiveis.reduce((soma, l) => soma + l.acumulado, 0),
      reais: visiveis.reduce((soma, l) => soma + l.reais, 0),
    };
  }, [visiveis]);

  // Linhas escondidas por situação fora do padrão (ativo/afastado/inativo): sem este
  // aviso, uma grafia nova no importador sumiria com gente da tela em silêncio.
  const foraDoPadrao = useMemo(() => {
    const conhecidas = new Set(["ativo", "afastado", "inativo"]);
    return linhas.filter((l) => !conhecidas.has(normalizar(l.situacao))).length;
  }, [linhas]);

  const avisoAbertas = useMemo(() => {
    const alvo = comp === "todas" ? [...abertas] : (abertas.has(comp) ? [comp] : []);
    return alvo.sort().map(rotuloComp).join(", ");
  }, [abertas, comp]);

  if (!podeAcessar) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto text-amber-700" size={30} />
        <h1 className="mt-3 text-xl font-black text-slate-900">Sem acesso ao Banco de Horas</h1>
        <p className="mt-2 text-sm text-slate-700">
          A tela mostra hora extra e valores de folha por colaborador: o acesso é exclusivo
          de Administrador do INOVE.
        </p>
      </div>
    );
  }

  const totalColunas = 12;

  return (
    <div className="dp360 -m-4 sm:-m-6">
      <div className="dp-topbar">
        <div className="dp-brand">
          <div className="dp-brand-mark">DP</div>
          <div>
            <div className="dp-brand-title">Banco de Horas</div>
            <div className="dp-brand-sub">DP360 · apurado no ponto menos o pago na folha</div>
          </div>
        </div>
        <nav className="dp-tabs" aria-label="Voltar para a DP360">
          <Link to="/dp360" className="dp-tab">← DP360</Link>
        </nav>
      </div>

      <div className="dp-viewbar">
        <label>
          <span className="dp-muted" style={{ marginRight: 6 }}>Competência</span>
          <select
            value={comp}
            onChange={(e) => setComp(e.target.value)}
            aria-label="Competência"
          >
            {competencias.map((c) => (
              <option key={c} value={c}>{rotuloComp(c)}</option>
            ))}
            <option value="todas">Todas (varre a base)</option>
          </select>
        </label>

        <label>
          <span className="dp-muted" style={{ marginRight: 6 }}>Situação</span>
          <select
            value={situacao}
            onChange={(e) => setSituacao(e.target.value)}
            aria-label="Situação"
          >
            {SITUACOES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>

        <span className="dp-busca">
          <Search size={14} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, crachá ou função"
            aria-label="Buscar colaborador"
          />
        </span>

        <button
          type="button"
          className="dp-btn"
          onClick={() => setRecarga((n) => n + 1)}
          disabled={carregando}
        >
          <RefreshCw size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
          Recarregar
        </button>
      </div>

      {erro ? (
        <div className="dp-resumo"><span className="dp-pill danger">{erro}</span></div>
      ) : (
        <div className="dp-resumo">
          <b>{resumo.pessoas}</b> colaborador(es) ·{" "}
          <b style={{ color: "var(--dp-ok-ink)" }}>{resumo.receber}</b> a receber ·{" "}
          <b style={{ color: "var(--dp-danger-ink)" }}>{resumo.devendo}</b> devendo ·{" "}
          <b>{resumo.quitados}</b> quitado(s) · saldo somado{" "}
          <b className="dp-num dp-mono" style={{ color: corSinal(resumo.saldo) }}>{emHoras(resumo.saldo)}</b>
          {" · pago "}
          <b className="dp-num dp-mono">R$ {emReais(resumo.reais)}</b>
          {". Clique numa linha para o extrato mês a mês."}
        </div>
      )}

      {!erro && avisoAbertas && (
        <div className="dp-resumo">
          <span className="dp-pill warn">⚠ {avisoAbertas} sem folha paga</span>{" "}
          <span className="dp-muted">
            a competência aparece com as horas apuradas e nada pago, o que infla o saldo.
            Para decisão, use um mês já fechado.
          </span>
        </div>
      )}

      {!erro && foraDoPadrao > 0 && situacao !== "todos" && (
        <div className="dp-resumo dp-faint">
          {foraDoPadrao} linha(s) com situação fora do padrão ficaram de fora — use
          “Todas as situações” para vê-las.
        </div>
      )}

      {carregando ? (
        <div className="dp-tabela-wrap"><div className="dp-vazio">Carregando o banco de horas…</div></div>
      ) : (
        <div className="dp-tabela-wrap">
          <table className="dp-tabela">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Crachá</th>
                <th>Função</th>
                <th>Situação</th>
                <th>Competência</th>
                <th>HE apurada</th>
                <th>HE paga</th>
                <th>Débito</th>
                <th>Banco pago</th>
                <th>Pago (R$)</th>
                <th>Movimento</th>
                <th>Saldo acumulado</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => (
                <tr
                  key={`${l.cracha}|${l.competencia}`}
                  onClick={() => setPessoaSel({ cracha: l.cracha, nome: l.nome })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setPessoaSel({ cracha: l.cracha, nome: l.nome });
                    }
                  }}
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                >
                  <td><b>{l.nome || "—"}</b></td>
                  <td className="dp-num dp-mono">{l.cracha || "—"}</td>
                  <td>{l.funcao || "—"}</td>
                  <td>
                    <span className={`dp-pill ${normalizar(l.situacao) === "ativo" ? "mute" : "accent"}`}>
                      {l.situacao || "—"}
                    </span>
                  </td>
                  <td className="dp-num">
                    {comp === "todas"
                      ? <span className="dp-muted">{l.meses} mês(es) · até {rotuloComp(l.ultima)}</span>
                      : (
                        <>
                          {rotuloComp(l.competencia)}
                          {abertas.has(l.competencia) && (
                            <span className="dp-pill warn" style={{ marginLeft: 6 }}>sem folha</span>
                          )}
                        </>
                      )}
                  </td>
                  <td className="dp-num">{umaCasa(l.apurada)}</td>
                  <td className="dp-num">{umaCasa(l.paga)}</td>
                  <td className="dp-num">{l.debito ? umaCasa(l.debito) : "—"}</td>
                  <td className="dp-num">{l.bancoH ? umaCasa(l.bancoH) : "—"}</td>
                  <td className="dp-num dp-mono">{l.reais ? `R$ ${emReais(l.reais)}` : "—"}</td>
                  <td className="dp-num dp-mono">
                    <b style={{ color: corSinal(l.movimento) }}>{emHoras(l.movimento)}</b>
                  </td>
                  <td className="dp-num">
                    <span className={`dp-pill ${classeSinal(l.acumulado)} dp-mono`}>{emHoras(l.acumulado)}</span>
                  </td>
                </tr>
              ))}
              {!visiveis.length && (
                <tr>
                  <td colSpan={totalColunas} className="dp-faint" style={{ textAlign: "center", padding: "22px" }}>
                    {linhas.length
                      ? "Nenhum colaborador com esses filtros."
                      : "Sem movimento nesta competência."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {pessoaSel && (
        <div
          className="dp-overlay"
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) fecharExtrato(); }}
        >
          <div className="dp-modal" style={{ width: 940 }} role="dialog" aria-modal="true" aria-label="Extrato do banco de horas">
            <div className="dp-modal-head">
              <h3>Extrato do banco de horas</h3>
              <button type="button" className="dp-det-x" onClick={fecharExtrato} aria-label="Fechar">
                <X size={17} />
              </button>
            </div>
            <ExtratoPessoa estado={extrato} abertas={abertas} nomeFallback={pessoaSel.nome} />
          </div>
        </div>
      )}
    </div>
  );
}

/* Extrato mes a mes de uma pessoa. O `saldo_acumulado_h` da ULTIMA linha ja e o saldo
   corrido — nao ha soma a refazer aqui. */
function ExtratoPessoa({ estado, abertas, nomeFallback }) {
  const { carregando, erro, linhas, pessoa } = estado;

  if (carregando) return <div className="dp-vazio" style={{ marginTop: 12 }}>Carregando o extrato…</div>;
  if (erro) {
    return (
      <div style={{ marginTop: 12 }}>
        <span className="dp-pill danger">{erro}</span>
      </div>
    );
  }
  if (!linhas.length) {
    return <div className="dp-vazio" style={{ marginTop: 12 }}>Sem movimento no período.</div>;
  }

  const ordenadas = [...linhas].sort((a, b) => (a.competencia < b.competencia ? 1 : -1));
  const atual = ordenadas[0];
  const fechadas = linhas.filter((l) => !abertas.has(l.competencia));
  const saldoFechado = fechadas.length ? fechadas[fechadas.length - 1].acumulado : null;

  return (
    <>
      <div className="dp-det-head" style={{ marginTop: 10 }}>
        <div>
          <b>{pessoa?.nome || nomeFallback || "—"}</b>
          <div className="sub">
            <span className="dp-mono">{pessoa?.cracha || "—"}</span>
            {pessoa?.funcao ? ` · ${pessoa.funcao}` : ""}
            {pessoa?.situacao ? ` · ${pessoa.situacao}` : ""}
            {pessoa?.admissao ? ` · admitido em ${pessoa.admissao}` : ""}
            {pessoa?.afastadoDesde ? ` · afastado desde ${pessoa.afastadoDesde}` : ""}
            {pessoa?.desligamento ? ` · desligado em ${pessoa.desligamento}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="dp-faint" style={{ fontSize: 11 }}>Saldo acumulado</div>
          <span className={`dp-pill ${classeSinal(atual.acumulado)} dp-mono`}>{emHoras(atual.acumulado)}</span>
          {saldoFechado != null && saldoFechado !== atual.acumulado && (
            <div className="dp-faint" style={{ fontSize: 11, marginTop: 4 }}>
              com a folha fechada: <b className="dp-mono" style={{ color: corSinal(saldoFechado) }}>{emHoras(saldoFechado)}</b>
            </div>
          )}
        </div>
      </div>

      <div className="dp-tabela-wrap" style={{ margin: "12px 0 0", maxHeight: "56vh" }}>
        <table className="dp-tabela">
          <thead>
            <tr>
              <th>Competência</th>
              <th>HE apurada</th>
              <th>HE paga</th>
              <th>Débito</th>
              <th>Banco pago</th>
              <th>Pago (R$)</th>
              <th>Movimento</th>
              <th>Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((l) => (
              <tr key={l.competencia}>
                <td>
                  <b>{rotuloComp(l.competencia)}</b>
                  {abertas.has(l.competencia) && (
                    <span className="dp-pill warn" style={{ marginLeft: 6 }}>sem folha</span>
                  )}
                </td>
                <td className="dp-num">{umaCasa(l.apurada)}</td>
                <td className="dp-num">{umaCasa(l.paga)}</td>
                <td className="dp-num">{l.debito ? umaCasa(l.debito) : "—"}</td>
                <td className="dp-num">{l.bancoH ? umaCasa(l.bancoH) : "—"}</td>
                <td className="dp-num dp-mono">{l.reais ? `R$ ${emReais(l.reais)}` : "—"}</td>
                <td className="dp-num dp-mono">
                  <b style={{ color: corSinal(l.movimento) }}>{emHoras(l.movimento)}</b>
                </td>
                <td className="dp-num dp-mono" style={{ color: corSinal(l.acumulado) }}>{emHoras(l.acumulado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dp-det-foot">
        Somente leitura: esta tela não grava nada na folha. Os valores vêm da tabela
        <span className="dp-mono"> banco_horas</span>, alimentada pelo importador do DP.
      </div>
    </>
  );
}
