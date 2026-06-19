import { useEffect, useState } from "react";
import { FaCopy, FaMagic } from "react-icons/fa";
import { supabase } from "../../supabase";
import { MonitoramentoFrame, MonitoramentoSection } from "./MonitoramentoShell";

export default function MonitoramentoPrompt() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("vision_config").select("valor").eq("chave", "prompt_gemini").maybeSingle();
      if (!alive) return;
      if (error) {
        console.error("Erro ao carregar prompt Gemini:", error);
        setPrompt("");
      } else {
        setPrompt(data?.valor || "");
      }
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const copyPrompt = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const helper = useMemo(() => (prompt ? `${prompt.length.toLocaleString("pt-BR")} caracteres` : ""), [prompt]);

  return (
    <MonitoramentoFrame
      title="Prompt GEMINI"
      icon={<FaMagic className="text-lg" />}
      activeTab="prompt"
      description="Aqui fica o texto-base usado pelo assistente do monitoramento. A tela foi deixada mais limpa para consulta rápida."
      actions={
        <button
          type="button"
          onClick={copyPrompt}
          disabled={loading || !prompt}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FaCopy />
          {copied ? "Copiado" : "Copiar prompt"}
        </button>
      }
    >
      <MonitoramentoSection title="Configuração atual" subtitle={helper}>
        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-slate-100">
          {loading ? (
            <div className="py-10 text-center text-sm font-semibold text-slate-400">Carregando prompt...</div>
          ) : prompt ? (
            <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed">{prompt}</pre>
          ) : (
            <div className="py-10 text-center text-sm font-semibold text-slate-400">
              Nenhum prompt encontrado em <span className="font-black text-slate-200">vision_config.prompt_gemini</span>.
            </div>
          )}
        </div>
      </MonitoramentoSection>
    </MonitoramentoFrame>
  );
}
