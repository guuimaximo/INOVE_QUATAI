import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lerDP360, upsertDP360 } from "../../services/dp360Api";

/* ═══════════════════════════════════════════════════════════════════════════
   TabelaDP — a grade compartilhada do DP360

   Porte do `renderTabela` da ferramenta original (Sistemas/PONTO/app/ui/app.js
   ~5297) e dos seus auxiliares: `montarCols` (menu ⚙), `cmpVal`/`chaveOrd`
   (ordenação), `colW`/`COLW` (larguras), `tblCfg`/`loadCfg`/`saveCfg`
   (preferências por tela) e `baixar_csv` (main.py ~2324).

   O que a grade dá a QUALQUER aba, sem a aba escrever nada:
     · ordenar clicando no cabeçalho (2º clique inverte, ▲/▼);
     · escolher colunas no ⚙ (some da grade E do CSV);
     · fixar N colunas à esquerda (sticky, `left` acumulado);
     · redimensionar coluna arrastando a alça do cabeçalho;
     · selecionar linhas (opcional);
     · exportar CSV do que está na tela;
     · e LEMBRAR tudo isso por tela, entre sessões.

   ─ Por que ordenar não é `String.localeCompare` puro ─
   Erro já cometido na ferramenta e documentado lá: `parseFloat` lê o começo da
   string e ignora o resto, então "13/08/2026" virava 13 e "07/08/2026" virava
   7 — a tabela ordenava pelo DIA DO MÊS, misturando agosto com setembro. Com
   texto puro é o mesmo estrago: "10:00" vem antes de "9:00" e "10h09" antes de
   "9h20". `chaveOrd` transforma cada formato do DP (data BR, ISO, hora — até o
   "25:40" de turno que vira o dia —, jornada "10h09" e número) numa chave
   numérica comparável; o que não casa com nada nenhum cai no localeCompare.

   ─ Preferências: nunca podem impedir a pessoa de trabalhar ─
   Ficam no `app_config` (chave `tbl_<chave>`, a mesma convenção da ferramenta:
   `tbl_p2`, `tbl_p1_sug`…), liberado no gateway `dp360-api`. O localStorage é
   cache SÍNCRONO: a tela abre já com as colunas certas em vez de piscar o
   padrão esperando a rede. Toda leitura e toda gravação são best-effort e
   engolem erro — se o Supabase estiver fora, a grade abre no padrão e continua
   funcionando. Preferência de coluna não é dado de trabalho.

   ═══ API ═══
   <TabelaDP
     chave="p2"                      // identidade da tela (vira `tbl_p2` no app_config)
     colunas={COLUNAS}               // ver formato abaixo
     linhas={visiveis}               // JÁ filtradas pela aba; a grade só ordena
     classeLinha={(l) => "row-ok"}   // cor da linha por estado (row-ok, row-p1…)
     aoClicarLinha={(l, i) => …}
     idLinha={(l) => `${l.cracha}|${l.date_ref}`}   // recomendado se selecionavel
     selecionavel={false}
     aoSelecionar={(ids, linhas) => …}
     nomeCsv="revisao_2026-09-03"
     vazio="Nenhum cartão para esta categoria e data."
     carregando={false}
     acoes={<button className="dp-btn">…</button>}  // à esquerda da barra do ⚙
     ferramentas                     // false esconde a barra do ⚙ / CSV
     pinPadrao={2}
   />

   Coluna:
     {
       id: "cracha",                 // obrigatório; também é a chave da linha
       titulo: "Crachá",             // (aceita `rotulo`, como as abas já escrevem)
       classe: "dp-num dp-mono",     // classe do <td>
       largura: 110,                 // px; o usuário sobrepõe arrastando
       alinhar: "right",             // atalho para text-align
       estilo: { fontWeight: 600 },
       valor: (l) => l.cracha,       // ORDENA e EXPORTA (default: l[id])
       render: (l, i) => <span/>,    // só EXIBE (default: o `valor`)
       ordenavel: true,              // default true (false p/ coluna de botões)
     }

   Separador: `{ id: "_sep", titulo: "│" }` (qualquer id começando em `_sep`) —
   não ordena, não sai no ⚙ e não vai para o CSV, igual ao original.

   ═══ Fora do porte (de propósito) ═══
   · CÉLULA EDITÁVEL (`opts.editable` + `onEdit`, o `td.ed` do Passo 2). No
     original é `contenteditable` cru; em React isso briga com o cursor a cada
     re-render. Quem precisar de campo na grade põe um <input> controlado no
     `render` da coluna — é a mesma coisa, sem o `contenteditable`.
   · `fmtCol` (o formatador global que decidia a pinta da célula por chave de
     coluna). Aqui cada coluna traz o próprio `render` — a regra fica na aba,
     não numa tabelona no meio do arquivo.
   · `COLW` (mapa global de larguras por nome de coluna). Virou `largura` na
     própria coluna, pelo mesmo motivo.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ───────────────────────── ordenação (porte de cmpVal) ───────────────────── */

// Cada formato do DP vira um número comparável; o que não casar cai no texto.
function chaveOrd(s) {
  let m;
  if ((m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s))) return +(m[3] + m[2] + m[1]); // 13/08/2026
  if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s))) // ISO
    return +(m[1] + m[2] + m[3] + (m[4] || "00") + (m[5] || "00") + (m[6] || "00"));
  if ((m = /^(\d{1,3}):(\d{2})(?::(\d{2}))?$/.exec(s))) // 14:42 e o 25:40 do DP
    return +m[1] * 3600 + +m[2] * 60 + +(m[3] || 0);
  if ((m = /^(\d{1,3})h(\d{2})$/.exec(s))) return +m[1] * 60 + +m[2]; // 10h09 (jornada)
  if (/^-?\d+([.,]\d+)?$/.test(s)) return parseFloat(s.replace(",", ".")); // número INTEIRO
  return null;
}

export function cmpVal(a, b) {
  // Números e datas de verdade (o `valor` da coluna pode devolver qualquer coisa)
  // não precisam passar pelo texto — e não podem, ou 10 ficaria antes de 9.
  const na = typeof a === "number" && Number.isFinite(a);
  const nb = typeof b === "number" && Number.isFinite(b);
  if (na && nb) return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();

  const A = String(a ?? "").trim();
  const B = String(b ?? "").trim();
  if (A === B) return 0;
  if (!A) return 1;
  if (!B) return -1;
  const ka = chaveOrd(A);
  const kb = chaveOrd(B);
  if (ka != null && kb != null) return ka - kb;
  return A.localeCompare(B, "pt");
}

const ehVazio = (v) => v == null || (typeof v !== "number" && String(v).trim() === "");

// ÚNICO desvio consciente do original: lá o comentário diz "vazio sempre no fim,
// nos dois sentidos", mas a ordenação multiplicava o resultado inteiro por
// `sortDir` — então no ▼ os vazios subiam todos para o topo e a pessoa via 40
// linhas em branco antes do primeiro dado. Aqui a direção só vale entre valores
// PREENCHIDOS; vazio fica no fim de verdade nos dois sentidos, como estava escrito.
export function cmpOrdenacao(a, b, dir) {
  const va = ehVazio(a);
  const vb = ehVazio(b);
  if (va && vb) return 0;
  if (va) return 1;
  if (vb) return -1;
  return cmpVal(a, b) * dir;
}

/* ───────────────────────────── colunas / larguras ────────────────────────── */

const COL_SEL = "__sel";
const LARGURA_PADRAO = 110;
const LARGURA_SEL = 44;
const LARGURA_SEP = 24;
const LARGURA_MIN = 40;

const ehSeparador = (id) => typeof id === "string" && id.startsWith("_sep");
const rotuloDe = (col) => col.titulo ?? col.rotulo ?? "";

function larguraDe(col, prefs) {
  const salva = prefs.widths && prefs.widths[col.id];
  if (salva) return salva;
  if (col.largura) return col.largura;
  if (col.id === COL_SEL) return LARGURA_SEL;
  if (ehSeparador(col.id)) return LARGURA_SEP;
  return LARGURA_PADRAO;
}

// `valor` manda; sem ele, o campo cru da linha (era o `r[chave]` do original).
function valorDe(col, linha) {
  return col.valor ? col.valor(linha) : linha?.[col.id];
}

function exibirValor(v) {
  if (v == null || v === false) return "";
  if (typeof v === "string" || typeof v === "number") return v;
  return String(v);
}

/* ────────────────────── preferências (app_config + cache) ────────────────── */

const PREF_PADRAO = { hidden: [], sortKey: null, sortDir: 1, widths: {}, pin: 2 };
const chaveConfig = (chave) => `tbl_${chave}`;
const chaveLocal = (chave) => `dp360:tbl:${chave}`;

// Aceita o que vier (jsonb, string JSON, lixo) e devolve SEMPRE um objeto válido.
function normalizarPrefs(bruto, pinPadrao) {
  const base = { ...PREF_PADRAO, pin: pinPadrao };
  let v = bruto;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return base;
    }
  }
  if (!v || typeof v !== "object") return base;
  return {
    hidden: Array.isArray(v.hidden) ? v.hidden.map(String) : base.hidden,
    sortKey: typeof v.sortKey === "string" ? v.sortKey : null,
    sortDir: v.sortDir === -1 ? -1 : 1,
    widths: v.widths && typeof v.widths === "object" ? { ...v.widths } : {},
    pin: Number.isInteger(v.pin) && v.pin >= 0 ? v.pin : base.pin,
  };
}

function lerCache(chave, pinPadrao) {
  try {
    const cru = window.localStorage.getItem(chaveLocal(chave));
    return cru ? normalizarPrefs(cru, pinPadrao) : { ...PREF_PADRAO, pin: pinPadrao };
  } catch {
    return { ...PREF_PADRAO, pin: pinPadrao };
  }
}

function gravarCache(chave, prefs) {
  try {
    window.localStorage.setItem(chaveLocal(chave), JSON.stringify(prefs));
  } catch {
    /* quota cheia / modo privado: a grade segue com o que está em memória */
  }
}

/* ─────────────────────────────── CSV (porte) ─────────────────────────────── */

// Separador `;` e aspas em tudo (o Excel pt-BR lê `;` como separador de campo).
// Codificação: UTF-8 com BOM — o original gravava cp1252 porque escrevia arquivo
// no disco do Windows; aqui o BOM já faz o Excel abrir com acento certo.
function celulaCsv(v) {
  if (v == null || v === false) return '""';
  let s;
  if (typeof v === "number" && Number.isFinite(v)) s = String(v).replace(".", ",");
  else if (v instanceof Date) s = v.toLocaleString("pt-BR");
  else s = String(v);
  return `"${s.replace(/\r?\n|\r/g, " ").replace(/"/g, '""')}"`;
}

// Exportado porque a Gordura precisa disso: o original tem um COLS_P4_CSV
// separado, com as colunas CRUAS (`gordura_entrada` em minutos, `nivel_entrada`)
// no lugar dos chips coloridos da tela. A aba passa a própria lista e usa o
// mesmo escritor de CSV.
export function baixarCsv(nome, colunas, linhas) {
  const cabecalho = colunas.map((c) => celulaCsv(rotuloDe(c))).join(";");
  const corpo = linhas.map((l) => colunas.map((c) => celulaCsv(valorDe(c, l))).join(";"));
  const texto = `﻿${[cabecalho, ...corpo].join("\r\n")}`;
  const blob = new Blob([texto], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ═══════════════════════════════ componente ══════════════════════════════ */

export default function TabelaDP({
  chave,
  colunas,
  linhas,
  classeLinha,
  aoClicarLinha,
  idLinha,
  selecionavel = false,
  aoSelecionar,
  nomeCsv,
  vazio = "Nada para mostrar.",
  carregando = false,
  mensagemCarregando = "Carregando dados da base DP360…",
  ferramentas = true,
  acoes = null,
  pinPadrao = 2,
}) {
  const [prefs, setPrefs] = useState(() => lerCache(chave, pinPadrao));
  const [menuAberto, setMenuAberto] = useState(false);
  const [selecionados, setSelecionados] = useState(() => new Set());

  // `tocado` trava a resposta atrasada do app_config: se a pessoa já mexeu numa
  // coluna enquanto a rede voltava, o remoto NÃO desfaz o que ela acabou de fazer.
  const tocado = useRef(false);
  const timerSalvar = useRef(null);
  const colgroupRef = useRef(null);
  const menuRef = useRef(null);

  // Troca de chave (a Refeição alterna tbl_p1_sug/p1_ab/p1_red pelo filtro):
  // ajusta o estado DURANTE o render, senão a grade pisca um frame com as
  // colunas da chave anterior.
  const chaveAnterior = useRef(chave);
  if (chaveAnterior.current !== chave) {
    chaveAnterior.current = chave;
    tocado.current = false;
    setPrefs(lerCache(chave, pinPadrao));
  }

  /* ── carrega do app_config (best-effort; falhou, fica o padrão/cache) ── */
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const achadas = await lerDP360("app_config", {
          colunas: "chave,valor",
          filtros: { chave: `eq.${chaveConfig(chave)}` },
          limite: 1,
        });
        if (!vivo || tocado.current || !achadas?.length) return;
        const remoto = normalizarPrefs(achadas[0].valor, pinPadrao);
        setPrefs(remoto);
        gravarCache(chave, remoto);
      } catch {
        /* sem preferência salva é vida normal: segue no padrão */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [chave, pinPadrao]);

  /* ── grava: localStorage na hora, app_config com folga (evita 1 POST por px) ── */
  const salvar = useCallback(
    (novo) => {
      tocado.current = true;
      setPrefs(novo);
      gravarCache(chave, novo);
      if (timerSalvar.current) clearTimeout(timerSalvar.current);
      timerSalvar.current = setTimeout(() => {
        upsertDP360("app_config", { chave: chaveConfig(chave), valor: novo }).catch(() => {
          /* sem permissão / sem rede: a preferência vive no cache local */
        });
      }, 700);
    },
    [chave],
  );

  const mudar = useCallback((mudanca) => salvar({ ...prefs, ...mudanca }), [prefs, salvar]);

  /* ────────────────────────── colunas em cena ────────────────────────── */

  const todasCols = useMemo(() => (colunas || []).filter(Boolean), [colunas]);

  const cols = useMemo(() => {
    const oculto = new Set(prefs.hidden || []);
    const visiveis = todasCols.filter((c) => ehSeparador(c.id) || !oculto.has(c.id));
    return selecionavel ? [{ id: COL_SEL, titulo: "", ordenavel: false }, ...visiveis] : visiveis;
  }, [todasCols, prefs.hidden, selecionavel]);

  // Fixadas à esquerda: `left` ACUMULADO com a largura das anteriores — sem isso
  // as fixadas empilham todas em left:0 e uma tapa a outra.
  const { npin, lefts, larguras } = useMemo(() => {
    const ws = cols.map((c) => larguraDe(c, prefs));
    const n = Math.min((selecionavel ? 1 : 0) + (prefs.pin || 0), cols.length);
    let acc = 0;
    const ls = cols.map((_, i) => {
      const l = acc;
      if (i < n) acc += ws[i];
      return l;
    });
    return { npin: n, lefts: ls, larguras: ws };
  }, [cols, prefs, selecionavel]);

  /* ───────────────────────────── ordenação ───────────────────────────── */

  const ordenadas = useMemo(() => {
    const col = prefs.sortKey ? todasCols.find((c) => c.id === prefs.sortKey) : null;
    if (!col) return linhas || [];
    const dir = prefs.sortDir < 0 ? -1 : 1;
    return [...(linhas || [])].sort((a, b) => cmpOrdenacao(valorDe(col, a), valorDe(col, b), dir));
  }, [linhas, todasCols, prefs.sortKey, prefs.sortDir]);

  const ordenarPor = useCallback(
    (id) => {
      if (prefs.sortKey === id) mudar({ sortDir: prefs.sortDir < 0 ? 1 : -1 });
      else mudar({ sortKey: id, sortDir: 1 });
    },
    [prefs.sortKey, prefs.sortDir, mudar],
  );

  /* ──────────────────────────── redimensionar ────────────────────────── */

  // Durante o arrasto só o <colgroup> é mexido no DOM (o original faz igual):
  // re-renderizar 500 linhas × 30 colunas a cada mousemove trava a tela. O estado
  // — e a gravação — só acontecem no soltar.
  const iniciarResize = useCallback(
    (evento, id) => {
      evento.preventDefault();
      evento.stopPropagation();
      const x0 = evento.clientX;
      const indice = cols.findIndex((c) => c.id === id);
      const w0 = larguras[indice] ?? LARGURA_PADRAO;
      let largura = w0;
      const mover = (ev) => {
        largura = Math.max(LARGURA_MIN, Math.round(w0 + (ev.clientX - x0)));
        const alvo = colgroupRef.current?.children?.[indice];
        if (alvo) alvo.style.width = `${largura}px`;
      };
      const soltar = () => {
        document.removeEventListener("mousemove", mover);
        document.removeEventListener("mouseup", soltar);
        salvar({ ...prefs, widths: { ...prefs.widths, [id]: largura } });
      };
      document.addEventListener("mousemove", mover);
      document.addEventListener("mouseup", soltar);
    },
    [cols, larguras, prefs, salvar],
  );

  /* ───────────────────────────── seleção ─────────────────────────────── */

  const idDe = useCallback((linha, i) => (idLinha ? idLinha(linha) : i), [idLinha]);

  const avisarSelecao = useCallback(
    (novo) => {
      setSelecionados(novo);
      if (!aoSelecionar) return;
      const ids = [...novo];
      aoSelecionar(ids, ordenadas.filter((l, i) => novo.has(idDe(l, i))));
    },
    [aoSelecionar, ordenadas, idDe],
  );

  const alternarLinha = useCallback(
    (id) => {
      const novo = new Set(selecionados);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      avisarSelecao(novo);
    },
    [selecionados, avisarSelecao],
  );

  const idsVisiveis = useMemo(
    () => (selecionavel ? ordenadas.map((l, i) => idDe(l, i)) : []),
    [selecionavel, ordenadas, idDe],
  );
  const marcadosNaTela = idsVisiveis.filter((id) => selecionados.has(id)).length;
  const todasMarcadas = idsVisiveis.length > 0 && marcadosNaTela === idsVisiveis.length;

  const alternarTodas = useCallback(() => {
    avisarSelecao(todasMarcadas ? new Set() : new Set(idsVisiveis));
  }, [todasMarcadas, idsVisiveis, avisarSelecao]);

  /* ─────────────────────────── menu ⚙ Colunas ────────────────────────── */

  useEffect(() => {
    if (!menuAberto) return undefined;
    const foraClique = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAberto(false);
    };
    const esc = (e) => {
      if (e.key === "Escape") setMenuAberto(false);
    };
    document.addEventListener("mousedown", foraClique);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", foraClique);
      document.removeEventListener("keydown", esc);
    };
  }, [menuAberto]);

  const alternarColuna = useCallback(
    (id) => {
      const oculto = new Set(prefs.hidden || []);
      if (oculto.has(id)) oculto.delete(id);
      else oculto.add(id);
      mudar({ hidden: [...oculto] });
    },
    [prefs.hidden, mudar],
  );

  /* ─────────────────────────────── CSV ───────────────────────────────── */

  // Só o que está em cena: colunas visíveis (sem o checkbox e sem separador) e
  // as linhas que a aba já filtrou, na ordem em que estão na tela.
  const colsCsv = useMemo(
    () => cols.filter((c) => c.id !== COL_SEL && !ehSeparador(c.id)),
    [cols],
  );
  const exportar = useCallback(() => {
    baixarCsv(nomeCsv || `dp360_${chave}`, colsCsv, ordenadas);
  }, [nomeCsv, chave, colsCsv, ordenadas]);

  /* ─────────────────────────────── render ────────────────────────────── */

  const colunasDoMenu = todasCols.filter((c) => !ehSeparador(c.id));
  const ocultas = new Set(prefs.hidden || []);

  return (
    <>
      {ferramentas && (
        <div className="dp-tbl-tools">
          {acoes}
          <div className="dir" ref={menuRef}>
            <button
              type="button"
              className="dp-btn"
              onClick={exportar}
              disabled={!ordenadas.length}
              title="Baixar as colunas visíveis, das linhas em tela"
            >
              ⬇ CSV
            </button>
            <button
              type="button"
              className="dp-btn"
              onClick={() => setMenuAberto((v) => !v)}
              aria-expanded={menuAberto}
              aria-haspopup="true"
            >
              ⚙ Colunas
            </button>
            {menuAberto && (
              <div className="dp-cols-menu" role="dialog" aria-label="Colunas da tabela">
                <div className="dp-pin-ctl">
                  <span>Fixar à esquerda:</span>
                  <select
                    value={prefs.pin || 0}
                    onChange={(e) => mudar({ pin: Number(e.target.value) })}
                  >
                    {[0, 1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="dp-cols-list">
                  {colunasDoMenu.map((c) => (
                    <label key={c.id}>
                      <input
                        type="checkbox"
                        checked={!ocultas.has(c.id)}
                        onChange={() => alternarColuna(c.id)}
                      />
                      <span>{rotuloDe(c) || c.id}</span>
                    </label>
                  ))}
                </div>
                <div className="dp-cols-foot">
                  <button
                    type="button"
                    className="dp-btn"
                    onClick={() =>
                      salvar({ ...PREF_PADRAO, pin: pinPadrao, sortKey: prefs.sortKey, sortDir: prefs.sortDir })
                    }
                  >
                    Restaurar padrão
                  </button>
                  <button type="button" className="dp-btn" onClick={() => setMenuAberto(false)}>
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="dp-tabela-wrap">
        <table className="dp-tabela fixa">
          <colgroup ref={colgroupRef}>
            {cols.map((c, i) => (
              <col key={c.id} style={{ width: `${larguras[i]}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {cols.map((c, i) => {
                const fixa = i < npin;
                const estilo = fixa ? { left: `${lefts[i]}px` } : undefined;
                const classe = `${fixa ? "dp-pin " : ""}${ehSeparador(c.id) ? "dp-sep " : ""}`.trim();

                if (c.id === COL_SEL) {
                  return (
                    <th key={c.id} className={classe || undefined} style={estilo}>
                      <input
                        type="checkbox"
                        className="dp-selall"
                        title="Marcar todas"
                        aria-label="Marcar todas as linhas"
                        checked={todasMarcadas}
                        ref={(el) => {
                          if (el) el.indeterminate = marcadosNaTela > 0 && !todasMarcadas;
                        }}
                        onChange={alternarTodas}
                      />
                    </th>
                  );
                }

                const podeOrdenar = c.ordenavel !== false && !ehSeparador(c.id);
                const ativa = prefs.sortKey === c.id;
                // Operável por teclado sem perder o papel nativo de cabeçalho:
                // tabIndex + Enter/Espaço, e o `aria-sort` conta o estado.
                return (
                  <th
                    key={c.id}
                    className={`${podeOrdenar ? "dp-sortable " : ""}${classe}`.trim() || undefined}
                    style={{ ...estilo, ...(c.alinhar ? { textAlign: c.alinhar } : null) }}
                    aria-sort={ativa ? (prefs.sortDir < 0 ? "descending" : "ascending") : undefined}
                    tabIndex={podeOrdenar ? 0 : undefined}
                    title={podeOrdenar ? "Ordenar por esta coluna" : undefined}
                    onClick={(e) => {
                      if (!podeOrdenar) return;
                      if (e.target.classList?.contains("dp-rz")) return; // clique na alça não ordena
                      ordenarPor(c.id);
                    }}
                    onKeyDown={(e) => {
                      if (!podeOrdenar) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        ordenarPor(c.id);
                      }
                    }}
                  >
                    {rotuloDe(c)}
                    {ativa ? (prefs.sortDir > 0 ? " ▲" : " ▼") : ""}
                    <span
                      className="dp-rz"
                      role="presentation"
                      title="Arraste para mudar a largura"
                      onMouseDown={(e) => iniciarResize(e, c.id)}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {carregando && (
              <tr>
                <td colSpan={cols.length} className="dp-tbl-vazio">
                  {mensagemCarregando}
                </td>
              </tr>
            )}

            {!carregando && !ordenadas.length && (
              <tr>
                <td colSpan={cols.length} className="dp-tbl-vazio">
                  {vazio}
                </td>
              </tr>
            )}

            {!carregando &&
              ordenadas.map((linha, indice) => {
                const id = idDe(linha, indice);
                return (
                  <tr
                    key={id ?? indice}
                    className={(classeLinha && classeLinha(linha, indice)) || undefined}
                    style={aoClicarLinha ? { cursor: "pointer" } : undefined}
                    onClick={aoClicarLinha ? () => aoClicarLinha(linha, indice) : undefined}
                    // Linha clicavel precisa abrir pelo teclado tambem. As abas tinham
                    // isso na <table> propria e perderam ao migrar pra ca; como o
                    // componente e compartilhado, resolver aqui vale para todas.
                    tabIndex={aoClicarLinha ? 0 : undefined}
                    role={aoClicarLinha ? "button" : undefined}
                    onKeyDown={
                      aoClicarLinha
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              aoClicarLinha(linha, indice);
                            }
                          }
                        : undefined
                    }
                  >
                    {cols.map((c, i) => {
                      const fixa = i < npin;
                      const estilo = {
                        ...(fixa ? { left: `${lefts[i]}px` } : null),
                        ...(c.alinhar ? { textAlign: c.alinhar } : null),
                        ...c.estilo,
                      };
                      const classe =
                        `${c.classe || ""}${fixa ? " dp-pin" : ""}${
                          ehSeparador(c.id) ? " dp-sep" : ""
                        }`.trim() || undefined;

                      if (c.id === COL_SEL) {
                        return (
                          <td key={c.id} className={classe} style={estilo}>
                            <input
                              type="checkbox"
                              className="dp-selrow"
                              aria-label="Marcar esta linha"
                              checked={selecionados.has(id)}
                              onClick={(e) => e.stopPropagation()} // não abre o cartão da linha
                              onChange={() => alternarLinha(id)}
                            />
                          </td>
                        );
                      }

                      return (
                        <td key={c.id} className={classe} style={estilo} data-k={c.id}>
                          {c.render ? c.render(linha, indice) : exibirValor(valorDe(c, linha))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </>
  );
}
