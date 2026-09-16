import { useEffect, useRef, useState } from "react";
import { rodando, useRoboDP360 } from "./roboVigia";

/**
 * O ROBÔ, NO TOPO — pedido do dono: "preciso saber em algum lugar na ferramenta o bot
 * rodando".
 *
 * Ele fica na barra, e não dentro de uma aba, porque quem dispara na Revisão vai para as
 * Ocorrências enquanto espera. E fica SEMPRE visível, inclusive parado: um aviso que só
 * aparece quando há robô é um aviso que ninguém sabe onde procurar quando quer conferir
 * que NÃO há. Parado ele é cinza e não pede atenção.
 *
 * ELE VÊ O QUE O INOVE NÃO DISPAROU. A fonte é o GitHub, então o run que saiu da
 * ferramenta do PC aparece aqui igual — e é justamente esse que explica a fila travada
 * para quem está olhando só para esta tela.
 *
 * O PORQUÊ DA LISTA. Os workflows compartilham `concurrency: bots-transnet`: um roda, um
 * espera, e o terceiro é CANCELADO pelo GitHub sem avisar ninguém. Por isso a gaveta
 * mostra também o que acabou de terminar com o desfecho — `cancelado` ali é a resposta
 * para "mandei e não aconteceu nada".
 */
const QUANDO = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

function hora(iso) {
  const t = Date.parse(String(iso || ""));
  return Number.isFinite(t) ? QUANDO.format(new Date(t)) : "—";
}

/* QUEM DISPAROU (dono, 16/09/2026). O `ator` do GitHub é sempre a mesma conta, dona do
   token; o nome de quem clicou vem do registro do disparo no INOVE (`quem`). Na linha vai
   primeiro e último nome — o completo fica no balão. Sem registro, o run não saiu daqui. */
function quemDisparou(run) {
  // gateway antigo, que ainda não devolve `quem`: fica a conta do GitHub, como era
  if (run.quem === undefined) return { texto: run.ator || "—", titulo: "" };
  const completo = String(run.quem || "").trim();
  if (completo) {
    const partes = completo.split(/\s+/);
    const curto = partes.length > 2 ? `${partes[0]} ${partes[partes.length - 1]}` : completo;
    return { texto: curto, titulo: `Disparado no INOVE por ${completo}` };
  }
  return {
    texto: "fora do INOVE",
    titulo: `Não saiu do INOVE (ferramenta do PC ou direto no GitHub)${run.ator ? ` · conta ${run.ator}` : ""}`,
  };
}

function desfecho(run) {
  const st = String(run.status || "");
  if (st === "queued") return { texto: "na fila", tom: "fila" };
  if (st !== "completed") return { texto: "rodando", tom: "ativo" };
  const c = String(run.conclusao || "");
  if (c === "success") return { texto: "concluído", tom: "ok" };
  if (c === "cancelled") return { texto: "cancelado", tom: "aviso" };
  return { texto: c || "falhou", tom: "erro" };
}

export default function RoboNoTopo() {
  const { runs, esperando } = useRoboDP360();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => {
      if (caixa.current && !caixa.current.contains(e.target)) setAberto(false);
    };
    const esc = (e) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const ativos = rodando(runs);
  const naFila = ativos.filter((r) => String(r.status || "") === "queued").length;
  /* TRÊS ESTADOS, não dois. Entre clicar em "lançar" e o run existir no GitHub passam
     alguns segundos, e nesse intervalo "parado" é mentira e "rodando" também — quem
     acabou de disparar leria "robô parado" e concluiria que o clique não pegou. */
  const aceso = ativos.length > 0 || esperando;
  const legenda = ativos.length
    ? ativos.length === 1
      ? `robô rodando · ${ativos[0].nome || "?"}`
      : `${ativos.length} robôs${naFila ? ` (${naFila} na fila)` : ""}`
    : esperando
      ? "mandando o robô…"
      : "robô parado";

  return (
    <div className="dp-robo" ref={caixa}>
      <button
        type="button"
        className={`dp-robo-btn${aceso ? " is-ativo" : ""}`}
        onClick={() => setAberto((v) => !v)}
        title={
          ativos.length
            ? "Há robô mexendo no Transnet agora. Clique para ver quais."
            : esperando
              ? "O disparo saiu daqui agora; o GitHub leva alguns segundos para registrar o run."
              : "Nenhum robô rodando. Clique para ver os últimos."
        }
        aria-expanded={aberto}
      >
        <span className={`dp-robo-luz${aceso ? " is-ativo" : ""}`} />
        {legenda}
      </button>

      {aberto && (
        <div className="dp-robo-gaveta" role="dialog" aria-label="Robôs recentes">
          <div className="dp-robo-tit">Robôs nas últimas 6 horas</div>
          {!runs.length && (
            <div className="dp-faint" style={{ fontSize: 12, padding: "6px 0" }}>
              Nada rodou por aqui nas últimas horas.
            </div>
          )}
          {runs.map((r) => {
            const d = desfecho(r);
            const q = quemDisparou(r);
            return (
              <div key={r.id ?? `${r.nome}${r.comecou_em}`} className="dp-robo-linha">
                <span className={`dp-robo-tag ${d.tom}`}>{d.texto}</span>
                <span className="dp-robo-nome" title={r.nome}>
                  {r.nome || "—"}
                </span>
                <span className="dp-faint" style={{ fontSize: 11.5, whiteSpace: "nowrap" }} title={q.titulo}>
                  {hora(r.comecou_em)} · {q.texto}
                </span>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" className="dp-robo-link">
                    log ↗
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
