import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaCar, FaSearch, FaArrowRight, FaTools, FaExclamationTriangle } from "react-icons/fa";
import { supabase } from "../../supabase";
import { MonitoramentoFrame, MonitoramentoSection, MonitoramentoStatCard } from "./MonitoramentoShell";

function normalizeText(value = "") {
  return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(0)}%` : String(value);
}

// Traduz o sinal tecnico do problema em "o que fazer" claro.
const ACAO_POR_PROBLEMA = {
  ROSTO_MUITO_BAIXO: "Incline a camera para baixo — o rosto sai cortado embaixo.",
  ROSTO_MUITO_ALTO: "Incline a camera para cima — o rosto sai cortado em cima.",
  ROSTO_NA_LATERAL: "Centralize a camera — o rosto aparece de lado.",
  ROSTO_CORTADO: "Ajuste o enquadramento — o rosto esta sendo cortado.",
  ROSTO_MUITO_PEQUENO: "Aproxime / aumente o zoom — o rosto fica pequeno demais.",
  SEM_ROSTO: "Reposicione a camera — ela nao esta capturando o rosto.",
};

// Monta {problema, acao, severidade} a partir dos campos da view.
function diagnosticar(row) {
  const problemas = Number(row.total_com_problema_camera || 0);
  const total = Number(row.total_laudos || 0);
  // Taxa de problema = % de laudos com falha de camera (alto = pior).
  const taxa = row.taxa_problema != null ? Number(row.taxa_problema) : total ? (problemas / total) * 100 : 0;

  // Severidade pela taxa de problema (quanto maior, mais urgente).
  let sev;
  if (taxa >= 50) sev = { nivel: "Critico", tone: "rose", ordem: 3 };
  else if (taxa >= 25) sev = { nivel: "Alto", tone: "amber", ordem: 2 };
  else sev = { nivel: "Medio", tone: "blue", ordem: 1 };

  // Problema legivel.
  const codigo = String(row.problema_principal || "").toUpperCase().replace(/\s+/g, "_");
  const posicao = normalizeText(row.ultima_camera_posicao);
  const enq = normalizeText(row.ultima_camera_enquadramento);

  let problema = row.problema_principal || "Camera precisa de ajuste";
  let acao = row.acao_sugerida || ACAO_POR_PROBLEMA[codigo] || "";

  if (!acao) {
    if (codigo in ACAO_POR_PROBLEMA) acao = ACAO_POR_PROBLEMA[codigo];
    else if (posicao.includes("baixo")) { problema = "Rosto muito baixo"; acao = ACAO_POR_PROBLEMA.ROSTO_MUITO_BAIXO; }
    else if (posicao.includes("alto")) { problema = "Rosto muito alto"; acao = ACAO_POR_PROBLEMA.ROSTO_MUITO_ALTO; }
    else if (posicao.includes("esquerda") || posicao.includes("direita") || posicao.includes("lateral")) { problema = "Rosto na lateral"; acao = ACAO_POR_PROBLEMA.ROSTO_NA_LATERAL; }
    else if (enq.includes("inadequado")) { problema = "Enquadramento inadequado"; acao = "Ajuste o campo de visao e a inclinacao da camera."; }
    else { problema = "Camera com baixa leitura"; acao = "Revise posicao, inclinacao e limpeza da lente."; }
  }

  return { problema, acao, sev, problemas, total, taxa };
}

const SEV_BADGE = {
  rose: "bg-rose-100 text-rose-700 border-rose-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
};
const SEV_STRIP = { rose: "bg-rose-500", amber: "bg-amber-500", blue: "bg-blue-500" };

export default function MonitoramentoVeiculos() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("vw_monitoramento_inspecoes_veiculos")
        .select("prefixo,total_laudos,total_com_problema_camera,acertividade,prioridade_camera,necessita_ajuste_camera,problema_principal,acao_sugerida,ultima_camera_posicao,ultima_camera_enquadramento,ultima_recomendacao_camera")
        .eq("necessita_ajuste_camera", true)
        .order("acertividade", { ascending: true })
        .order("prioridade_camera", { ascending: false })
        .order("total_com_problema_camera", { ascending: false });

      if (!alive) return;
      if (error) {
        console.error("Erro ao carregar veiculos do monitoramento:", error);
        setRows([]);
      } else {
        setRows(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const itens = useMemo(() => {
    const q = normalizeText(search);
    return rows
      .filter((row) => (q ? normalizeText(row.prefixo).includes(q) : true))
      .map((row) => ({ row, diag: diagnosticar(row) }));
  }, [rows, search]);

  const taxaDe = (r) => (r.taxa_problema != null ? Number(r.taxa_problema) : 0);
  const stats = useMemo(() => {
    const total = rows.length;
    const criticos = rows.filter((r) => taxaDe(r) >= 50).length;
    // Mais urgente = maior prioridade calculada pela view (cai na maior taxa de problema).
    const pior = rows.length
      ? rows.reduce((max, r) => (Number(r.prioridade_camera || 0) > Number(max.prioridade_camera || 0) ? r : max), rows[0])
      : null;
    return { total, criticos, pior };
  }, [rows]);

  return (
    <MonitoramentoFrame
      title="Veículos"
      icon={<FaCar className="text-lg" />}
      activeTab="veiculos"
      description="Fila de ajuste de câmera por prioridade. Cada carro já mostra o problema e o que fazer — o topo da lista é o mais urgente."
    >
      <MonitoramentoSection title="Prioridade de manutenção" subtitle="Comece pelos críticos (vermelho)">
        <div className="grid gap-3 md:grid-cols-3">
          <MonitoramentoStatCard title="Carros para ajustar" value={stats.total} tone="blue" />
          <MonitoramentoStatCard title="Críticos" value={stats.criticos} tone="rose" helper="acerto abaixo de 30%" />
          <MonitoramentoStatCard
            title="Mais urgente"
            value={stats.pior ? stats.pior.prefixo : "-"}
            tone="amber"
            helper={stats.pior ? `${formatPercent(stats.pior.taxa_problema)} com problema` : ""}
          />
        </div>
      </MonitoramentoSection>

      <MonitoramentoSection
        title="O que ajustar em cada carro"
        subtitle="Clique para ver o histórico e as fotos que justificam o ajuste"
        actions={
          <label className="relative block w-full min-w-[260px] md:w-[340px]">
            <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar carro..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:bg-white"
            />
          </label>
        }
      >
        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center text-sm font-semibold text-slate-400">Carregando carros...</div>
        ) : itens.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
            <p className="text-sm font-semibold text-slate-700">Nenhum carro precisa de ajuste agora. 🎉</p>
          </div>
        ) : (
          <div className="space-y-3">
            {itens.map(({ row, diag }) => (
              <Link
                key={row.prefixo}
                to={`/monitoramento/veiculos/${encodeURIComponent(row.prefixo)}`}
                className="group flex items-stretch overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {/* Faixa de severidade */}
                <div className={`w-1.5 shrink-0 ${SEV_STRIP[diag.sev.tone]}`} />

                <div className="flex flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Carro + diagnostico */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black tracking-tight text-slate-900">{row.prefixo || "SEM PREFIXO"}</span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black uppercase ${SEV_BADGE[diag.sev.tone]}`}>{diag.sev.nivel}</span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-700">
                      <FaExclamationTriangle className="text-amber-500" /> {diag.problema}
                    </p>
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-emerald-700">
                      <FaTools className="mt-0.5 shrink-0" /> <span className="font-semibold">{diag.acao}</span>
                    </p>
                  </div>

                  {/* Numeros */}
                  <div className="flex shrink-0 items-center gap-5">
                    <div className="text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Com problema</p>
                      <p className={`text-2xl font-black ${diag.sev.tone === "rose" ? "text-rose-600" : diag.sev.tone === "amber" ? "text-amber-600" : "text-blue-600"}`}>{formatPercent(diag.taxa)}</p>
                    </div>
                    <div className="hidden text-center sm:block">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Laudos</p>
                      <p className="text-sm font-bold text-slate-700">{diag.problemas} de {diag.total || "-"}</p>
                    </div>
                    <FaArrowRight className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-500" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </MonitoramentoSection>
    </MonitoramentoFrame>
  );
}
