import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaCar, FaSearch } from "react-icons/fa";
import { supabase } from "../../supabase";
import { MonitoramentoFrame, MonitoramentoSection, MonitoramentoStatCard } from "./MonitoramentoShell";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR") : String(value);
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1).replace(".", ",")}%` : String(value);
}

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
        .select("prefixo,total_laudos,total_com_problema_camera,acertividade,prioridade_camera,necessita_ajuste_camera")
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

    return () => {
      alive = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    return [...rows].filter((row) => {
      if (!q) return true;
      return normalizeText(row.prefixo).includes(q);
    });
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const pior = rows.length ? Math.min(...rows.map((row) => Number(row.acertividade || 0))) : 0;
    const media = rows.length
      ? rows.reduce((sum, row) => sum + Number(row.acertividade || 0), 0) / rows.length
      : 0;

    return { total, pior: Number.isFinite(pior) ? pior : 0, media };
  }, [rows]);

  return (
    <MonitoramentoFrame
      title="Veículos"
      icon={<FaCar className="text-lg" />}
      activeTab="veiculos"
      description="Lista curta só com os carros que realmente merecem revisão da câmera. Clique no carro para ver os detalhes."
    >
      <MonitoramentoSection title="Fila de ajuste" subtitle="Uma linha por carro, com a porcentagem de acerto">
        <div className="grid gap-3 md:grid-cols-3">
          <MonitoramentoStatCard title="Carros na fila" value={formatNumber(stats.total)} tone="blue" />
          <MonitoramentoStatCard title="Média de acerto" value={formatPercent(stats.media)} tone="emerald" />
          <MonitoramentoStatCard title="Pior acerto" value={formatPercent(stats.pior)} tone="amber" />
        </div>
      </MonitoramentoSection>

      <MonitoramentoSection
        title="Carros com ajuste"
        subtitle="Clique em qualquer linha para abrir a tela de detalhes daquele veículo"
        actions={
          <label className="relative block w-full min-w-[280px] md:w-[360px]">
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
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center text-sm font-semibold text-slate-400">
            Carregando carros...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
            <p className="text-sm font-semibold text-slate-700">Nenhum carro com ajuste encontrado.</p>
            <p className="mt-1 text-sm text-slate-500">Se quiser, eu posso deixar o limiar mais sensível ou mais rígido.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((row) => (
              <Link
                key={row.prefixo}
                to={`/monitoramento/veiculos/${encodeURIComponent(row.prefixo)}`}
                className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/30 px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="min-w-0">
                  <p className="truncate text-lg font-black tracking-tight text-slate-900">{row.prefixo || "SEM PREFIXO"}</p>
                </div>

                <div className="ml-4 text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Acerto</p>
                  <p className="text-2xl font-black text-amber-700">{formatPercent(row.acertividade)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </MonitoramentoSection>
    </MonitoramentoFrame>
  );
}
