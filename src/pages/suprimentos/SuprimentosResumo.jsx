import { useEffect, useMemo, useState } from "react";
import {
  FaBoxOpen,
  FaBug,
  FaChartLine,
  FaCheckCircle,
  FaClipboardList,
  FaCoins,
  FaFlask,
  FaRedo,
  FaRoute,
  FaShieldAlt,
  FaTruckLoading,
} from "react-icons/fa";
import { supabase } from "../../supabase";
import {
  ActionButton,
  EmptyState,
  KpiCard,
  PageHero,
  Panel,
  StatusChip,
} from "./SuprimentosUI";
import {
  deriveGarantiaMeta,
  deriveTesteMeta,
  formatCurrencyBR,
  formatDateBR,
  formatDateTimeBR,
  formatKm,
} from "./suprimentosShared";

export default function SuprimentosResumo() {
  const [garantias, setGarantias] = useState([]);
  const [testes, setTestes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function carregar() {
    setLoading(true);
    setErrorMessage("");

    const [garantiasResp, testesResp] = await Promise.all([
      supabase.from("suprimentos_garantias").select("*").order("created_at", { ascending: false }),
      supabase.from("suprimentos_testes").select("*").order("created_at", { ascending: false }),
    ]);

    if (garantiasResp.error || testesResp.error) {
      const message =
        garantiasResp.error?.message ||
        testesResp.error?.message ||
        "Erro ao carregar resumo de suprimentos.";
      console.error("SuprimentosResumo:", garantiasResp.error || testesResp.error);
      setGarantias([]);
      setTestes([]);
      setErrorMessage(message);
    } else {
      setGarantias((garantiasResp.data || []).map((row) => ({ ...row, anexos: Array.isArray(row?.anexos) ? row.anexos : [] })));
      setTestes((testesResp.data || []).map((row) => ({ ...row, anexos: Array.isArray(row?.anexos) ? row.anexos : [] })));
    }

    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const resumo = useMemo(() => {
    const garantiasAbertas = garantias.filter((row) => deriveGarantiaMeta(row).status === "Aberta");
    const garantiasConcluidas = garantias.filter((row) => deriveGarantiaMeta(row).status === "Concluída");
    const testesAtivos = testes.filter((row) => deriveTesteMeta(row).status === "Ativo");
    const testesConcluidos = testes.filter((row) => deriveTesteMeta(row).status === "Concluído");
    const valorEmGarantia = garantiasAbertas.reduce((sum, row) => sum + Number(row.valor_peca || 0), 0);
    const valorRecuperado = garantias
      .filter((row) => row.resultado === "Aprovada")
      .reduce((sum, row) => sum + Number(row.valor_aprovado || row.valor_peca || 0), 0);
    const kmAtivo = testesAtivos.reduce((sum, row) => {
      const inicial = Number(row.km_inicial || 0);
      const atual = Number(row.km_atual || 0);
      return sum + Math.max(atual - inicial, 0);
    }, 0);

    return {
      garantiasAbertas,
      garantiasConcluidas,
      testesAtivos,
      testesConcluidos,
      valorEmGarantia,
      valorRecuperado,
      kmAtivo,
    };
  }, [garantias, testes]);

  const garantiasRecentes = useMemo(() => garantias.slice(0, 5), [garantias]);
  const testesRecentes = useMemo(() => testes.slice(0, 5), [testes]);
  const alertas = useMemo(() => {
    const itens = [];

    garantias.forEach((row) => {
      const meta = deriveGarantiaMeta(row);
      if (meta.status === "Aberta" && row.enviado_fornecedor_em && !row.resultado) {
        itens.push({
          id: `g-${row.id}`,
          tipo: "Garantia",
          titulo: `${row.peca} · ${row.prefixo || "sem prefixo"}`,
          texto: `Enviada ao fornecedor em ${formatDateBR(row.enviado_fornecedor_em)} e ainda sem retorno.`,
          tone: "amber",
        });
      }
    });

    testes.forEach((row) => {
      const meta = deriveTesteMeta(row);
      if (meta.status === "Ativo" && row.falha_registrada) {
        itens.push({
          id: `t-${row.id}`,
          tipo: "Teste",
          titulo: `${row.nome_teste} · ${row.prefixo || "sem prefixo"}`,
          texto: "Existe falha registrada e o teste segue sem encerramento final.",
          tone: "rose",
        });
      }
    });

    return itens.slice(0, 8);
  }, [garantias, testes]);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Suprimentos"
        title="Resumo Suprimentos"
        description=""
        actions={<ActionButton onClick={carregar}><FaRedo /> Atualizar resumo</ActionButton>}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard title="Garantias abertas" value={resumo.garantiasAbertas.length} subtitle="Itens aguardando resposta ou fechamento" icon={<FaShieldAlt />} tone="amber" />
        <KpiCard title="Garantias concluídas" value={resumo.garantiasConcluidas.length} subtitle="Fechadas por crédito, peça ou negativa" icon={<FaCheckCircle />} tone="emerald" />
        <KpiCard title="Valor em garantia" value={formatCurrencyBR(resumo.valorEmGarantia)} subtitle="Base aberta para cobrar resposta" icon={<FaCoins />} tone="blue" />
        <KpiCard title="Valor recuperado" value={formatCurrencyBR(resumo.valorRecuperado)} subtitle="Aprovado pelo fornecedor" icon={<FaChartLine />} tone="cyan" />
        <KpiCard title="Testes ativos" value={resumo.testesAtivos.length} subtitle="Peças rodando em campo" icon={<FaFlask />} tone="violet" />
        <KpiCard title="KM em teste" value={`${resumo.kmAtivo.toLocaleString("pt-BR")} km`} subtitle="Rodagem acumulada dos testes ativos" icon={<FaRoute />} tone="slate" />
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{errorMessage}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title="Radar de garantias"
          subtitle=""
          actions={<StatusChip label={`${garantias.length} registros`} tone="blue" />}
        >
          {loading ? (
            <div className="py-12 text-center text-sm font-semibold text-slate-500">Carregando garantias...</div>
          ) : garantiasRecentes.length === 0 ? (
            <EmptyState title="Sem garantias ainda" subtitle="Assim que você abrir a primeira garantia, o resumo passa a acompanhar a carteira." />
          ) : (
            <div className="space-y-3">
              {garantiasRecentes.map((row) => {
                const meta = deriveGarantiaMeta(row);
                return (
                  <div key={row.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-base font-black text-slate-900">{row.peca}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          {row.fornecedor} · Prefixo {row.prefixo || "—"} · Falha em {formatDateBR(row.data_falha)}
                        </p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Aberto por {row.aberto_por_nome || "—"} · {formatDateTimeBR(row.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusChip label={meta.status} tone={meta.concluida ? "emerald" : "amber"} />
                        <StatusChip label={meta.fase} tone={meta.tone} />
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <MiniInfo label="Valor peça" value={formatCurrencyBR(row.valor_peca)} />
                      <MiniInfo label="KM falha" value={formatKm(row.km_falha)} />
                      <MiniInfo label="Solicitação" value={row.tipo_solicitacao || "—"} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          title="Alertas"
          subtitle=""
          actions={<StatusChip label={`${alertas.length} alertas`} tone={alertas.length ? "amber" : "emerald"} />}
        >
          {loading ? (
            <div className="py-12 text-center text-sm font-semibold text-slate-500">Carregando alertas...</div>
          ) : alertas.length === 0 ? (
            <EmptyState title="Nenhum alerta no momento" subtitle="Quando houver garantia parada ou teste com falha sem desfecho, ele aparece aqui." />
          ) : (
            <div className="space-y-3">
              {alertas.map((item) => (
                <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">{item.tipo}</p>
                      <p className="mt-2 text-sm font-black text-slate-900">{item.titulo}</p>
                      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{item.texto}</p>
                    </div>
                    <StatusChip label="Atenção" tone={item.tone} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Testes em andamento"
          subtitle=""
          actions={<StatusChip label={`${resumo.testesAtivos.length} ativos`} tone="violet" />}
        >
          {loading ? (
            <div className="py-12 text-center text-sm font-semibold text-slate-500">Carregando testes...</div>
          ) : testesRecentes.length === 0 ? (
            <EmptyState title="Sem testes cadastrados" subtitle="Crie um teste para começar a acompanhar peça, quilometragem e parecer técnico." />
          ) : (
            <div className="space-y-3">
              {testesRecentes.map((row) => {
                const meta = deriveTesteMeta(row);
                const kmRodado = Math.max(Number(row.km_atual || 0) - Number(row.km_inicial || 0), 0);
                return (
                  <div key={row.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-base font-black text-slate-900">{row.nome_teste}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          {row.peca} · {row.fornecedor} · Prefixo {row.prefixo || "—"}
                        </p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Aberto por {row.aberto_por_nome || "—"} · {formatDateTimeBR(row.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusChip label={meta.status} tone={meta.concluido ? "emerald" : "amber"} />
                        <StatusChip label={meta.fase} tone={meta.tone} />
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <MiniInfo label="KM inicial" value={formatKm(row.km_inicial)} />
                      <MiniInfo label="KM atual" value={formatKm(row.km_atual)} />
                      <MiniInfo label="KM rodado" value={formatKm(kmRodado)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          title="Pulso do cluster"
          subtitle=""
        >
          <div className="grid gap-4 md:grid-cols-2">
            <PulseCard
              title="Garantias"
              lines={[
                { icon: <FaClipboardList />, label: "Total cadastrado", value: garantias.length },
                { icon: <FaTruckLoading />, label: "Em tratamento", value: resumo.garantiasAbertas.length },
                { icon: <FaCheckCircle />, label: "Concluídas", value: resumo.garantiasConcluidas.length },
                { icon: <FaCoins />, label: "Recuperado", value: formatCurrencyBR(resumo.valorRecuperado) },
              ]}
            />
            <PulseCard
              title="Testes"
              lines={[
                { icon: <FaFlask />, label: "Total cadastrado", value: testes.length },
                { icon: <FaRoute />, label: "Ativos", value: resumo.testesAtivos.length },
                { icon: <FaBug />, label: "Com falha", value: testes.filter((row) => row.falha_registrada).length },
                { icon: <FaChartLine />, label: "KM em teste", value: `${resumo.kmAtivo.toLocaleString("pt-BR")} km` },
              ]}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function MiniInfo({ label, value }) {
  return (
    <div className="rounded-[18px] border border-white bg-white px-3 py-3 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-800">{value || "—"}</p>
    </div>
  );
}

function PulseCard({ title, lines }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-500">{title}</p>
      <div className="mt-4 space-y-3">
        {lines.map((line) => (
          <div key={line.label} className="flex items-center justify-between gap-4 rounded-2xl border border-white bg-white px-3 py-3 shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <span className="text-sm">{line.icon}</span>
              <span className="text-sm font-semibold">{line.label}</span>
            </div>
            <span className="text-sm font-black text-slate-900">{line.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

