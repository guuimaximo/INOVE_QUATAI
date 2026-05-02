import React from "react";

export default class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: String(error?.message || error || "Erro inesperado ao iniciar o Inove."),
    };
  }

  componentDidCatch(error, info) {
    console.error("Falha ao iniciar o shell do Inove:", error, info);
    window.__INOVE_HIDE_BOOT?.();
    window.__INOVE_SET_BOOT_ERROR?.(error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-50">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-500/30 bg-slate-900/90 p-6 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-300">Inove mobile</p>
          <h1 className="mt-3 text-2xl font-bold">O aplicativo encontrou um erro ao abrir</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            A tela branca foi substituida por este aviso para facilitar o diagnostico. Gere um APK novo depois desta
            correcao e, se ainda falhar, me envie esta mensagem.
          </p>
          <pre className="mt-5 overflow-auto rounded-2xl bg-black/30 p-4 text-xs leading-6 text-red-200">
            {this.state.message}
          </pre>
        </div>
      </div>
    );
  }
}
