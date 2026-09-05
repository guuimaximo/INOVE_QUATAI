// Moldura comum das abas do DP360: cabeçalho, estados de carregando/erro e slot
// para a tela. Mantém as abas visualmente iguais sem repetir markup.
export default function AbaShell({ icone: Icone, titulo, resumo, carregando, erro, acoes, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          {Icone && (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Icone size={23} />
            </div>
          )}
          <div>
            <h2 className="text-xl font-black text-slate-900">{titulo}</h2>
            {resumo && <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{resumo}</p>}
          </div>
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>

      {erro && (
        <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{erro}</p>
      )}

      {carregando ? (
        <p className="mt-8 text-sm font-semibold text-slate-500">Carregando dados da base DP360…</p>
      ) : (
        <div className="mt-6">{children}</div>
      )}
    </section>
  );
}
