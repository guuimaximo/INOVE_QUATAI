import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaCar, FaChartBar, FaClipboard, FaCopy, FaFileAlt, FaHome, FaMagic } from "react-icons/fa";
import { supabase } from "../../supabase";
import { InovePageHeader, InoveSection } from "../../components/InovePage";

function NavTab({ to, icon, label, active = false }) {
  return (
    <Link
      to={to}
      className={`flex min-h-[68px] items-center justify-center gap-3 px-4 py-4 text-sm font-bold transition md:px-6 ${
        active ? "bg-white text-blue-600 shadow-[inset_0_-4px_0_0_#1d4ed8]" : "bg-white text-slate-500 hover:bg-slate-50"
      }`}
    >
      <span className={`text-lg ${active ? "text-blue-600" : "text-slate-400"}`}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

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

  const tabs = useMemo(
    () => [
      { to: "/painel", icon: <FaHome />, label: "Dashboard" },
      { to: "/monitoramento", icon: <FaClipboard />, label: "Laudos" },
      { to: "/embarcados-central", icon: <FaCar />, label: "Veículos" },
      { to: "/monitoramento/prompt-gemini", icon: <FaMagic />, label: "Prompt GEMINI", active: true },
    ],
    []
  );

  const copyPrompt = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
        <header className="rounded-[28px] border border-slate-200 bg-white px-6 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
                <FaMagic className="text-lg" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">VISION WEB</p>
                <h1 className="mt-2 text-[28px] font-black tracking-tight text-slate-900 md:text-[34px]">
                  Monitoramento de Inspeções
                </h1>
              </div>
            </div>

            <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:min-w-[760px] lg:grid-cols-4">
              {tabs.map((tab) => (
                <NavTab key={tab.to} to={tab.to} icon={tab.icon} label={tab.label} active={Boolean(tab.active)} />
              ))}
            </div>
          </div>
        </header>

        <InoveSection className="overflow-hidden">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">Prompt Gemini</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Configuração atual do prompt</h2>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Aqui você confere o texto usado pelo assistente. Se precisar alterar o comportamento da IA, essa é a base.
              </p>
            </div>

            <button
              type="button"
              onClick={copyPrompt}
              disabled={loading || !prompt}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FaCopy /> {copied ? "Copiado" : "Copiar prompt"}
            </button>
          </div>

          <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-950 p-5 text-slate-100 shadow-inner">
            {loading ? (
              <div className="py-12 text-center text-sm font-bold text-slate-400">Carregando prompt...</div>
            ) : prompt ? (
              <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">{prompt}</pre>
            ) : (
              <div className="py-12 text-center text-sm font-bold text-slate-400">
                Nenhum prompt encontrado em <span className="font-black text-slate-200">vision_config.prompt_gemini</span>.
              </div>
            )}
          </div>
        </InoveSection>
      </div>
    </div>
  );
}
