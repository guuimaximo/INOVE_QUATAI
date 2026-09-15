// Perguntar.jsx — A CONFIRMAÇÃO DO DP360, NO LAYOUT DA FERRAMENTA.
//
// Porte de `Sistemas/PONTO/app/ui/app.js:7103` (`perguntar`) + o markup de `index.html:113`
// e o CSS de `styles.css:503`. O original explica por que a caixa existe, e vale palavra por
// palavra aqui:
//
//   "O `confirm()` do navegador era feio, quebrava o tema e, pior, TRAVA A THREAD: o
//    `hidden` que escondia o carregando era aplicado mas o navegador não repintava antes do
//    diálogo, então os dois apareciam juntos na tela."
//
// No INOVE há um terceiro motivo, que o dono viu em 10/09/2026: o `window.confirm` do
// Chrome escreve "inovequatai.onrender.com diz" em cima da pergunta, ignora o tema escuro e
// espreme tudo num bloco de texto — e o que está sendo confirmado aqui é advertência na
// ficha de alguém, ou robô reescrevendo cartão de ponto. A pergunta tem de dar para ler.
//
// ── COMO SE USA ────────────────────────────────────────────────────────────────
//   const [perguntar, caixaPergunta] = usePergunta();
//   ...
//   if (!(await perguntar("texto de sempre"))) return;          // string: já funciona
//   if (!(await perguntar({ titulo, passos, linhas, obs, nota, sim, nao, tom }))) return;
//   ...
//   return (<>{caixaPergunta}<resto/></>);
//
// NÃO É PROVIDER DE PROPÓSITO: as telas do DP360 não têm raiz comum (o cluster tem abas,
// mas Resumo, Abandonos e Banco de Horas são páginas soltas). Um hook que devolve a caixa
// junto funciona nas duas formas, sem contexto para esquecer de montar.
import { useCallback, useEffect, useRef, useState } from "react";

const txt = (v) => String(v ?? "").trim();

/* ── O QUE É NÚMERO APARECE COMO NÚMERO ────────────────────────────────────
 * As listas destas caixas são sempre a mesma coisa: quem, que dia, que horas. Escritas
 * como texto corrido, elas viram um muro cinza — e é nesse muro que alguém tem de reparar
 * que uma linha tem `25:35` ou uma data errada. Aqui a linha é lida e remontada: crachá,
 * data e horário em fonte de número; o nome, em negrito; o resto igual ao que veio.
 * Nada é interpretado além disso — a caixa não inventa nem esconde texto. */
const RE_NUMERO = /(\b\d{7,8}\b|\b\d{2}\/\d{2}\/\d{4}\b|\b\d{1,2}:\d{2}\b)/g;
// O `split` acima devolve também os pedaços capturados; este, SEM o `/g`, diz quais são
// eles. Testar com o de cima erraria dia sim, dia não: regex com `/g` guarda a posição da
// última busca entre as chamadas de `.test`.
const RE_SO_NUMERO = /^(\d{7,8}|\d{2}\/\d{2}\/\d{4}|\d{1,2}:\d{2})$/;

function LinhaFormatada({ texto }) {
  const bruto = String(texto ?? "");
  // "NOME 02/09/2026: 12:50 14:43" → o nome é o começo, até o primeiro número
  const corte = bruto.search(/\d{7,8}\b|\d{2}\/\d{2}\/\d{4}|\d{1,2}:\d{2}/);
  const nome = corte > 0 ? bruto.slice(0, corte) : "";
  const resto = corte > 0 ? bruto.slice(corte) : bruto;
  return (
    <>
      {nome ? <b>{nome}</b> : null}
      {resto.split(RE_NUMERO).map((pedaco, i) =>
        RE_SO_NUMERO.test(pedaco) ? (
          <span className="dp-mono dp-num" key={i}>{pedaco}</span>
        ) : (
          <span key={i}>{pedaco}</span>
        ),
      )}
    </>
  );
}

/* ── O TEXTO QUE JÁ EXISTIA VIRA LAYOUT SEM SER REESCRITO ───────────────────
 * Os avisos desta tela foram escritos para o `confirm()`: parágrafos separados por linha em
 * branco, itens em "· ", passos em "1. ". Em vez de reescrever 13 textos (e correr o risco
 * de perder frase que custou caro), a caixa LÊ essa convenção:
 *   · linha começando com "1." … "9."  → passo numerado (o `.pl` da ferramenta)
 *   · linha começando com "· "          → item de lista
 *   · o resto                            → parágrafo, com as quebras preservadas
 * Quem quiser a forma estruturada passa `passos`/`linhas`/`obs`/`nota` e não depende disto. */
function blocosDoTexto(texto) {
  const partes = txt(texto).split(/\n{2,}/);
  const blocos = [];
  partes.forEach((parte, iP) => {
    const linhas = parte.split("\n");
    let acumulado = [];
    const despejar = () => {
      if (acumulado.length) blocos.push({ tipo: "p", texto: acumulado.join("\n") });
      acumulado = [];
    };
    linhas.forEach((linha, iL) => {
      const passo = /^\s*([1-9])[.)]\s+(.*)$/.exec(linha);
      const item = /^\s*[·•-]\s+(.*)$/.exec(linha);
      if (passo) {
        despejar();
        blocos.push({ tipo: "passo", n: passo[1], texto: passo[2], chave: `${iP}-${iL}` });
      } else if (item) {
        const ultimo = blocos[blocos.length - 1];
        despejar();
        if (ultimo && ultimo.tipo === "lista") ultimo.itens.push(item[1]);
        else blocos.push({ tipo: "lista", itens: [item[1]], chave: `${iP}-${iL}` });
      } else {
        acumulado.push(linha);
      }
    });
    despejar();
  });
  return blocos;
}

function Corpo({ pedido }) {
  const { texto, passos, linhas, obs, nota } = pedido;
  const blocos = texto ? blocosDoTexto(texto) : [];
  return (
    <div className="dp-perg-corpo">
      {(passos || []).map((p, i) => (
        <div className="dp-perg-pl" key={`ps${i}`}>
          <span className="n">{i + 1}.</span>
          <span>{p}</span>
        </div>
      ))}
      {blocos.map((b, i) =>
        /* O AVISO NÃO É PARÁGRAFO. "ATENÇÃO: …" e "N ficam de fora" são a razão de a caixa
           existir: quem lê depressa tem de esbarrar neles. */
        b.tipo === "p" && /^\s*(⚠|ATENÇÃO)/i.test(b.texto) ? (
          <div className="dp-perg-obs" key={`b${i}`}>{b.texto}</div>
        ) : b.tipo === "p" && /ficam de fora|ficou de fora|ficam fora/i.test(b.texto) ? (
          <div className="dp-perg-fora" key={`b${i}`}>{b.texto}</div>
        ) : b.tipo === "passo" ? (
          <div className="dp-perg-pl" key={`b${i}`}>
            <span className="n">{b.n}.</span>
            <span>{b.texto}</span>
          </div>
        ) : b.tipo === "lista" ? (
          <ul className="dp-perg-lista" key={`b${i}`}>
            {b.itens.map((it, j) => (
              <li key={j}><LinhaFormatada texto={it} /></li>
            ))}
          </ul>
        ) : (
          <p className="dp-perg-p" key={`b${i}`}>{b.texto}</p>
        ),
      )}
      {(linhas || []).length ? (
        <ul className="dp-perg-lista">
          {linhas.map((l, i) => (
            <li key={i}><LinhaFormatada texto={l} /></li>
          ))}
        </ul>
      ) : null}
      {obs ? <div className="dp-perg-obs">{obs}</div> : null}
      {nota ? <div className="dp-perg-nota">{nota}</div> : null}
    </div>
  );
}

function Caixa({ pedido, aoResponder }) {
  const simRef = useRef(null);
  // ENTER CONFIRMA, ESC CANCELA — as duas teclas do original (app.js:7125). Quem chegou aqui
  // com o dedo no Enter já estava respondendo a esta caixa: ela só aparece depois do clique.
  useEffect(() => {
    const tecla = (e) => {
      if (e.key === "Escape") { e.preventDefault(); aoResponder(false); }
      else if (e.key === "Enter") { e.preventDefault(); aoResponder(true); }
    };
    document.addEventListener("keydown", tecla);
    simRef.current?.focus();
    return () => document.removeEventListener("keydown", tecla);
  }, [aoResponder]);

  const grave = pedido.tom === "erro";
  return (
    <div
      className="dp-perg-ov"
      role="dialog"
      aria-modal="true"
      aria-label={pedido.titulo || "Confirmação"}
      // CLICAR FORA NÃO RESPONDE. A caixa que decide sobre advertência e ponto não pode ser
      // fechada por um clique perdido; a saída é o botão ou o Esc.
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={`dp-perg-bx${grave ? " grave" : ""}`}>
        {pedido.titulo ? <div className="dp-perg-tit">{pedido.titulo}</div> : null}
        <Corpo pedido={pedido} />
        <div className="dp-perg-rod">
          <button type="button" className="dp-btn" onClick={() => aoResponder(false)}>
            {pedido.nao || "Cancelar"}
          </button>
          <button
            ref={simRef}
            type="button"
            className={`dp-btn dp-perg-sim${grave ? " grave" : ""}`}
            onClick={() => aoResponder(true)}
          >
            {pedido.sim || "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Devolve `[perguntar, caixa]`. `perguntar` resolve `true`/`false` — a mesma resposta do
 * `window.confirm`, só que assíncrona, então o chamador vira `await`.
 *
 * A PROMESSA NÃO PODE FICAR PENDURADA: se o componente sair da tela com a caixa aberta, o
 * `await` do chamador nunca voltaria e a ação ficaria congelada para sempre. O efeito de
 * limpeza responde `false` (é o que o Esc faria).
 */
export function usePergunta() {
  const [pedido, setPedido] = useState(null);
  const pendente = useRef(null);

  const perguntar = useCallback(
    (arg) =>
      new Promise((resolve) => {
        const base = typeof arg === "string" ? { texto: arg } : { ...(arg || {}) };
        // TÍTULO SEM TÍTULO: o texto do `confirm()` já começava com a frase-chave em
        // maiúsculas ("ADVERTIR E CORRIGIR 12 vencido(s)…"). Ela vira o título, e o corpo
        // fica com o resto — que é exatamente a leitura da ferramenta.
        if (!base.titulo && base.texto) {
          const [primeira, ...resto] = txt(base.texto).split("\n");
          if (primeira && primeira.length <= 120) {
            base.titulo = primeira.replace(/:$/, "");
            base.texto = resto.join("\n").replace(/^\n+/, "");
          }
        }
        /* GRAVE POR PADRÃO NAS AÇÕES QUE ESCREVEM (15/09/2026). O botão de confirmar saía
           cinza, igual ao de cancelar, numa caixa que manda robô reescrever cartão de ponto.
           Quem passa `tom` continua mandando; sem ele, o verbo do título decide. */
        if (!base.tom && /^(ADVERTIR|LANÇAR|EXECUTAR|RECUSAR|CORRIGIR|CANCELAR|MARCAR|FECHAR|CONFERIR)\b/i.test(txt(base.titulo)))
          base.tom = "erro";
        pendente.current = resolve;
        setPedido(base);
      }),
    [],
  );

  const responder = useCallback((v) => {
    const resolve = pendente.current;
    pendente.current = null;
    setPedido(null);
    resolve?.(v);
  }, []);

  useEffect(() => () => { pendente.current?.(false); pendente.current = null; }, []);

  return [perguntar, pedido ? <Caixa pedido={pedido} aoResponder={responder} /> : null];
}

export default usePergunta;
