// Moldura comum das abas, no visual da FERRAMENTA: barra de filtros enxuta no topo
// (dp-viewbar), linha de resumo, e o conteudo solto — sem card grande em volta,
// porque a tabela densa e que manda na tela.
export default function AbaShell({ filtros, resumo, carregando, erro, children }) {
  return (
    <>
      {filtros && <div className="dp-viewbar">{filtros}</div>}

      {erro && (
        <div className="dp-resumo">
          <span className="dp-pill danger">{erro}</span>
        </div>
      )}

      {resumo && !erro && <div className="dp-resumo">{resumo}</div>}

      {carregando ? (
        <div className="dp-resumo">Carregando dados da base DP360…</div>
      ) : (
        children
      )}
    </>
  );
}
