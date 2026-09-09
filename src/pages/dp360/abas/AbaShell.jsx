// Moldura comum das abas, no visual da FERRAMENTA: barra de filtros enxuta no topo
// (dp-viewbar), linha de resumo, e o conteudo solto — sem card grande em volta,
// porque a tabela densa e que manda na tela.

/**
 * O ESPERAR TEM LUGAR NA TELA (06/09/2026).
 *
 * Antes o carregamento era uma linha de texto na altura do resumo — some no meio da
 * barra, e numa tela que leva dezenas de segundos lendo o lake dia a dia o DP ficava
 * olhando uma tela quase vazia sem saber se travou.
 *
 * CÍRCULO, não barra, como padrão: a maioria das abas NÃO sabe quanto falta (é uma
 * consulta só, sem etapas), e barra sem porcentagem ou finge que anda ou fica parada —
 * as duas mentem. O círculo diz "estou trabalhando" e não promete prazo.
 * Onde o progresso É conhecido (a leitura por dia da Ocorrências manda `progresso`),
 * aí sim entra a barra de verdade, cheia até a fração lida, com a contagem embaixo.
 */
function Espera({ progresso }) {
  const total = progresso?.total || 0;
  const feitos = progresso?.feitos || 0;
  const pct = total ? Math.min(100, Math.round((feitos / total) * 100)) : 0;
  return (
    <div className="dp-espera" role="status" aria-live="polite">
      <span className="dp-espera-circulo" aria-hidden="true" />
      <span className="dp-espera-txt">Carregando dados da base DP360…</span>
      {total > 0 && (
        <>
          <span
            className="dp-espera-barra"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={feitos}
          >
            <span style={{ width: `${pct}%` }} />
          </span>
          <span className="dp-espera-sub dp-num">
            lendo o cartão de cada dia — {feitos} de {total}
          </span>
        </>
      )}
    </div>
  );
}

export default function AbaShell({ filtros, resumo, carregando, progresso, erro, children }) {
  return (
    <>
      {filtros && <div className="dp-viewbar">{filtros}</div>}

      {erro && (
        <div className="dp-resumo">
          <span className="dp-pill danger">{erro}</span>
        </div>
      )}

      {resumo && !erro && <div className="dp-resumo">{resumo}</div>}

      {carregando ? <Espera progresso={progresso} /> : children}
    </>
  );
}
