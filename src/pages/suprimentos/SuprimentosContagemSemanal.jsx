import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaCheck, FaDownload, FaTimes } from "react-icons/fa";
import { supabase } from "../../supabase";
import {
  ActionButton,
  EmptyState,
  KpiCard,
  PageHero,
  Panel,
  StatusChip,
} from "./SuprimentosUI";
import { formatDateBR, formatDateTimeBR } from "./suprimentosShared";

export default function SuprimentosContagemSemanal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [aud, setAud] = useState(null);
  const [contagens, setContagens] = useState({ d1: [], d2: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: a } = await supabase
        .from("suprimentos_auditorias")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      setAud(a || null);
      if (a) {
        // pega as contagens dos dois domingos
        const fetchDay = async (d) => {
          const { data } = await supabase
            .from("suprimentos_contagens")
            .select("codigo,quantidade,descricao,created_at,contado_por_nome")
            .gte("created_at", `${d}T00:00:00`)
            .lte("created_at", `${d}T23:59:59.999`);
          return data || [];
        };
        const [d1Rows, d2Rows] = await Promise.all([fetchDay(a.data_inicio), fetchDay(a.data_fim)]);
        setContagens({ d1: d1Rows, d2: d2Rows });
      }
      setLoading(false);
    })();
  }, [id]);

  const resumo = aud?.resumo_json || {};
  const totalContado = useMemo(() => contagens.d1.length + contagens.d2.length, [contagens]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHero
        eyebrow="Suprimentos · Contagem · Semanal"
        title={aud ? `Auditoria de ${formatDateBR(aud.data_inicio)} → ${formatDateBR(aud.data_fim)}` : "Auditoria"}
        description="Comparação entre as duas contagens de domingo e o que o ERP movimentou no período."
        actions={
          <div className="flex flex-wrap gap-2">
            {aud?.excel_url ? (
              <a
                href={aud.excel_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <FaDownload /> Baixar Excel
              </a>
            ) : null}
            <ActionButton onClick={() => navigate("/suprimentos/contagem")}>
              <FaArrowLeft /> Voltar
            </ActionButton>
          </div>
        }
      />

      {loading ? (
        <Panel><p className="py-8 text-center text-sm font-semibold text-slate-400">Carregando...</p></Panel>
      ) : !aud ? (
        <Panel><EmptyState title="Auditoria não encontrada" subtitle="Pode ter sido removida." /></Panel>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard title="Itens auditados" value={resumo.itens_total ?? "—"} subtitle="Total no Excel" icon={<FaCheck />} tone="blue" />
            <KpiCard title="Corretos" value={resumo.itens_corretos ?? "—"} subtitle="Dentro da faixa Min-Máx" icon={<FaCheck />} tone="emerald" />
            <KpiCard title="Errados" value={resumo.itens_errados ?? "—"} subtitle="Fora da faixa" icon={<FaTimes />} tone="rose" />
            <KpiCard title="Sem contagem" value={resumo.itens_sem_contagem ?? "—"} subtitle="Não apareceram no 2º domingo" icon={<FaTimes />} tone="amber" />
            <KpiCard title="Apontamentos" value={totalContado} subtitle="Linhas nos dois domingos" icon={<FaCheck />} tone="cyan" />
          </section>

          <Panel title="Resumo da execução">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Domingo 1</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{formatDateBR(aud.data_inicio)}</p>
                <p className="text-xs text-slate-500">{contagens.d1.length} apontamentos</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Domingo 2</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{formatDateBR(aud.data_fim)}</p>
                <p className="text-xs text-slate-500">{contagens.d2.length} apontamentos</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Gerada em</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{formatDateTimeBR(aud.created_at)}</p>
                <p className="text-xs text-slate-500">{aud.criado_por_nome || "—"}</p>
              </div>
            </div>
            {resumo.formula ? (
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 font-mono text-xs text-slate-600">
                {resumo.formula}
              </p>
            ) : null}
          </Panel>

          <Panel title="Apontamentos do 1º domingo" subtitle="C1 da fórmula do Excel.">
            {contagens.d1.length === 0 ? (
              <EmptyState title="Sem apontamentos" subtitle="Não houve contagem nesse domingo." />
            ) : (
              <DiagSimples rows={contagens.d1} />
            )}
          </Panel>

          <Panel title="Apontamentos do 2º domingo" subtitle="C2 da fórmula do Excel.">
            {contagens.d2.length === 0 ? (
              <EmptyState title="Sem apontamentos" subtitle="Não houve contagem nesse domingo." />
            ) : (
              <DiagSimples rows={contagens.d2} />
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function DiagSimples({ rows }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Quando</th>
            <th className="px-4 py-3">Código</th>
            <th className="px-4 py-3">Peça</th>
            <th className="px-4 py-3 text-right">Qtd</th>
            <th className="px-4 py-3">Contado por</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={`${c.codigo}-${i}`} className="border-t border-slate-100">
              <td className="px-4 py-3 text-xs text-slate-500">{formatDateTimeBR(c.created_at)}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-700">{c.codigo || "—"}</td>
              <td className="px-4 py-3 text-slate-900">{c.descricao || "—"}</td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                {Number(c.quantidade || 0).toLocaleString("pt-BR")}
              </td>
              <td className="px-4 py-3 text-slate-700">{c.contado_por_nome || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
