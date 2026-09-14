import { useEffect, useRef, useState } from "react";
import { rodando, useVigiaDoRobo } from "./roboVigia";

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
  const runs = useVigiaDoRobo();
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
  const legenda = !ativos.length
    ? "robô parado"
    : ativos.length === 1
      ? `robô rodando · ${ativos[0].nome || "?"}`
      : `${ativos.length} robôs${naFila ? ` (${naFila} na fila)` : ""}`;

  return (
    <div className="dp-robo" ref={caixa}>
      <button
        type="button"
        className={`dp-robo-btn${ativos.length ? " is-ativo" : ""}`}
        onClick={() => setAberto((v) => !v)}
        title={
          ativos.length
            ? "Há robô mexendo no Transnet agora. Clique para ver quais."
            : "Nenhum robô rodando. Clique para ver os últimos."
        }
        aria-expanded={aberto}
      >
        <span className={`dp-robo-luz${ativos.length ? " is-ativo" : ""}`} />
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
            return (
              <div key={r.id ?? `${r.nome}${r.comecou_em}`} className="dp-robo-linha">
                <span className={`dp-robo-tag ${d.tom}`}>{d.texto}</span>
                <span className="dp-robo-nome" title={r.nome}>
                  {r.nome || "—"}
                </span>
                <span className="dp-faint" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
                  {hora(r.comecou_em)}
                  {r.ator ? ` · ${r.ator}` : ""}
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
