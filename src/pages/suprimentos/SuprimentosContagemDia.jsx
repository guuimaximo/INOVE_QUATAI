import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { FaArrowLeft, FaCheck, FaRobot, FaTimes } from "react-icons/fa";
import PullToRefresh from "../../components/PullToRefresh";
import { AuthContext } from "../../context/AuthContext";
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

function diffTone(diff) {
  if (diff === null || diff === undefined) return "slate";
  if (Number(diff) === 0) return "emerald";
  return Number(diff) > 0 ? "amber" : "rose";
}
function diffLabel(diff) {
  if (diff === null || diff === undefined) return "Não conferido";
  const n = Number(diff);
  if (n === 0) return "Bate com ERP";
  if (n > 0) return `+${n.toLocaleString("pt-BR")} (sobra)`;
  return `${n.toLocaleString("pt-BR")} (falta)`;
}

export default function SuprimentosContagemDia() {
  const { data: dataParam, loteId } = useParams(); // YYYY-MM-DD ou uuid do lote
  const navigate = useNavigate();
  const [data, setData] = useState(dataParam || "");
  const { user } = useContext(AuthContext);
  const userInfo = useMemo(() => ({
    id: Number(user?.usuario_id || user?.id || 0) || null,
    nome: user?.nome || user?.nome_completo || user?.login || user?.email || "Usuario",
  }), [user]);
  const isAdmin = useMemo(() => {
    const nivel = String(user?.nivel || "").trim().toLowerCase();
    return nivel === "administrador" || nivel === "admin";
  }, [user]);

  const [contagens, setContagens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [botJob, setBotJob] = useState(null);
  const [botMsg, setBotMsg] = useState("");
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const botPollRef = useRef(null);

  async function carregar() {
    setLoading(true);
    let rows = [];
    let dataAlvo = data;

    if (loteId) {
      // Filtra por lote_id
      const res = await supabase
        .from("suprimentos_contagens")
        .select("*")
        .eq("lote_id", loteId)
        .order("created_at", { ascending: false });
      rows = res.data || [];
      // descobre a data_alvo a partir da primeira contagem
      if (rows.length > 0) {
        const d = new Date(rows[rows.length - 1].created_at);
        dataAlvo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        setData(dataAlvo);
      }
    } else if (data) {
      const inicio = `${data}T00:00:00-03:00`;
      const fim = `${data}T23:59:59.999-03:00`;
      const res = await supabase
        .from("suprimentos_contagens")
        .select("*")
        .gte("created_at", inicio)
        .lte("created_at", fim)
        .order("created_at", { ascending: false });
      rows = res.data || [];
    }
    setContagens(rows);

    // Pega o último job (por lote_id se houver, senão por data_alvo)
    let jobRes;
    if (loteId) {
      jobRes = await supabase
        .from("suprimentos_bot_jobs")
        .select("*")
        .eq("lote_id", loteId)
        .order("created_at", { ascending: false })
        .limit(1);
    } else if (dataAlvo) {
      jobRes = await supabase
        .from("suprimentos_bot_jobs")
        .select("*")
        .eq("data_alvo", dataAlvo)
        .order("created_at", { ascending: false })
        .limit(1);
    }
    setBotJob(jobRes?.data?.[0] || null);
    setLoading(false);
  }
  useEffect(() => { carregar(); }, [data, loteId]);

  // Auto-refresh em tempo real (Realtime).
  useEffect(() => {
    if (!data && !loteId) return;
    let recarregando = false;
    const debounceRecarregar = () => {
      if (recarregando) return;
      recarregando = true;
      setTimeout(() => { recarregando = false; carregar(); }, 600);
    };

    const channel = supabase.channel(`contagem-lote-${loteId || data}`);

    if (loteId) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "suprimentos_contagens", filter: `lote_id=eq.${loteId}` },
        () => debounceRecarregar()
      ).on(
        "postgres_changes",
        { event: "*", schema: "public", table: "suprimentos_bot_jobs", filter: `lote_id=eq.${loteId}` },
        () => debounceRecarregar()
      );
    } else {
      const inicio = `${data}T00:00:00-03:00`;
      const fim = `${data}T23:59:59.999-03:00`;
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "suprimentos_contagens" },
        (payload) => {
          const row = payload.new || payload.old || {};
          const ts = row.created_at;
          if (!ts || (ts >= inicio && ts <= fim)) debounceRecarregar();
        }
      ).on(
        "postgres_changes",
        { event: "*", schema: "public", table: "suprimentos_bot_jobs", filter: `data_alvo=eq.${data}` },
        () => debounceRecarregar()
      );
    }

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [data, loteId]);

  async function dispararConferencia() {
    setBotMsg("");
    const { data: job, error } = await supabase
      .from("suprimentos_bot_jobs")
      .insert({
        tipo: "conferencia_dia",
        tipo_contagem: "diaria",
        data_alvo: data,
        status: "pendente",
        criado_por_id: userInfo.id,
        criado_por_nome: userInfo.nome,
      })
      .select().single();
    if (error) { setBotMsg(`Erro: ${error.message}`); return; }
    setBotJob(job);
    setBotMsg("Job enfileirado. Disparando workflow no GitHub Actions...");

    // Dispara o workflow imediatamente (GitHub workflow_dispatch)
    try {
      const token = import.meta.env.VITE_GITHUB_TOKEN_BOT;
      if (!token) {
        setBotMsg("Job enfileirado. Sem VITE_GITHUB_TOKEN_BOT — vai rodar no próximo cron (até 5 min).");
        return;
      }
      const owner = import.meta.env.VITE_GITHUB_USER_BOT || "guuimaximo";
      const repo = import.meta.env.VITE_GITHUB_REPO_BOT || "INOVE_QUATAI";
      const ref = import.meta.env.VITE_GITHUB_REF_BOT || "main";
      const r = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/bot-estoque-diaria.yml/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ref, inputs: { data_alvo: data } }),
        }
      );
      if (!r.ok) {
        const text = await r.text();
        setBotMsg(`Job enfileirado. GitHub respondeu ${r.status}: ${text.slice(0, 120)}`);
      } else {
        setBotMsg("Job enfileirado e workflow disparado. Pode levar alguns minutos.");
      }
    } catch (e) {
      setBotMsg(`Job enfileirado. Erro chamando GitHub: ${e?.message || e}`);
    }
  }

  useEffect(() => {
    if (!botJob || botJob.status === "concluido" || botJob.status === "erro") {
      clearInterval(botPollRef.current);
      botPollRef.current = null;
      return;
    }
    botPollRef.current = setInterval(async () => {
      const { data: j } = await supabase
        .from("suprimentos_bot_jobs")
        .select("*")
        .eq("id", botJob.id)
        .maybeSingle();
      if (!j) return;
      setBotJob(j);
      if (j.status === "concluido") {
        const r = j.resultado_json || {};
        setBotMsg(`Conferência concluída: ${r.itens_atualizados ?? "?"} atualizados, ${r.divergencias ?? "?"} divergências.`);
        carregar();
      } else if (j.status === "erro") {
        setBotMsg(`Bot falhou: ${j.erro || "?"}`);
      }
    }, 4000);
    return () => clearInterval(botPollRef.current);
  }, [botJob?.id, botJob?.status]);

  const kpis = useMemo(() => {
    const total = contagens.length;
    const conferidos = contagens.filter((c) => c.saldo_erp !== null && c.saldo_erp !== undefined).length;
    const corretos = contagens.filter((c) => c.saldo_erp !== null && c.saldo_erp !== undefined && Number(c.diferenca || 0) === 0).length;
    const divergencias = conferidos - corretos;
    const sem_cadastro = contagens.filter((c) => !c.peca_id).length;
    const acuracidade = conferidos > 0 ? Math.round((corretos / conferidos) * 1000) / 10 : null;
    return { total, divergencias, conferidos, sem_cadastro, corretos, acuracidade };
  }, [contagens]);

  const botStatusChip = botJob ? (
    <StatusChip
      tone={botJob.status === "concluido" ? "emerald" : botJob.status === "erro" ? "rose" : "amber"}
      label={
        botJob.status === "concluido" ? "Concluído" :
        botJob.status === "erro" ? "Erro" :
        botJob.status === "processando" ? "Em execução" : "Na fila"
      }
    />
  ) : null;

  const isNative = Boolean(Capacitor?.isNativePlatform?.());

  const conteudo = (
    <div className="flex flex-col gap-6 p-6">
      <PageHero
        eyebrow="Suprimentos · Contagem · Lote"
        title={loteId ? `Lote ${String(loteId).slice(0, 8)}` : `Contagens de ${formatDateBR(data)}`}
        description={loteId
          ? `Sessão de contagem ${String(loteId).slice(0, 8)} (${formatDateBR(data)}).`
          : `Todas as contagens feitas no dia ${formatDateBR(data)}.`}
        actions={
          <ActionButton onClick={() => navigate("/suprimentos/contagem")}>
            <FaArrowLeft /> Voltar
          </ActionButton>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Itens contados" value={kpis.total} subtitle="No lote" icon={<FaCheck />} tone="blue" />
        <KpiCard title="Conferidos" value={kpis.conferidos} subtitle={`${kpis.sem_cadastro} sem cadastro fora da acurácia`} icon={<FaCheck />} tone="cyan" />
        <KpiCard title="Divergências" value={kpis.divergencias} subtitle="Qtd diferente do ERP" icon={<FaCheck />} tone="amber" />
        <KpiCard title="Acuracidade" value={kpis.acuracidade !== null ? `${kpis.acuracidade}%` : "—"} subtitle="Corretos / Conferidos" icon={<FaCheck />} tone="emerald" />
      </section>

      {Capacitor?.isNativePlatform?.() ? (
        // Mobile: só mostra o status, sem botão (dispatch automático após cada contagem)
        botJob ? (
          <Panel title="Conferência com ERP" subtitle="Disparada automaticamente após cada contagem.">
            <div className="flex flex-wrap items-center gap-3">
              {botStatusChip}
              {botJob?.resultado_json ? (
                <span className="text-xs font-medium text-slate-500">
                  Última execução: {formatDateTimeBR(botJob.concluido_em)}
                </span>
              ) : null}
            </div>
          </Panel>
        ) : null
      ) : isAdmin ? (
        // Web: botão manual SÓ para administradores
        <Panel
          title="Conferir com ERP"
          subtitle="Dispara o bot que entra no TransNet, lê o saldo desse dia e atualiza as contagens."
        >
          <div className="flex flex-wrap items-center gap-3">
            <ActionButton
              tone="blue"
              onClick={dispararConferencia}
              disabled={Boolean(botJob && ["pendente", "processando"].includes(botJob.status))}
            >
              <FaRobot />
              {botJob && ["pendente", "processando"].includes(botJob.status) ? "Bot rodando..." : "Conferir agora"}
            </ActionButton>
            {botStatusChip}
            {botJob?.resultado_json ? (
              <span className="text-xs font-medium text-slate-500">
                Última execução: {formatDateTimeBR(botJob.concluido_em)}
              </span>
            ) : null}
          </div>
          {botMsg ? <p className="mt-3 text-sm font-medium text-slate-600">{botMsg}</p> : null}
        </Panel>
      ) : (
        // Web não-admin: vê só o status, sem botão
        botJob ? (
          <Panel title="Conferência com ERP" subtitle="Disparada por administradores ou automaticamente pelo cron.">
            <div className="flex flex-wrap items-center gap-3">
              {botStatusChip}
              {botJob?.resultado_json ? (
                <span className="text-xs font-medium text-slate-500">
                  Última execução: {formatDateTimeBR(botJob.concluido_em)}
                </span>
              ) : null}
            </div>
          </Panel>
        ) : null
      )}

      <Panel title="Itens deste lote">
        {loading ? (
          <p className="py-12 text-center text-sm font-semibold text-slate-400">Carregando...</p>
        ) : contagens.length === 0 ? (
          <EmptyState title="Nenhuma contagem nessa data" subtitle="Faça novas contagens na tela principal." />
        ) : Capacitor?.isNativePlatform?.() ? (
          // ─── Mobile: lista compacta Codigo / Fisico / Virtual + cor da linha ───
          <div className="space-y-2">
            <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr] gap-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Código</span>
              <span className="text-right">Saldo Físico</span>
              <span className="text-right">Saldo Virtual</span>
            </div>
            {contagens.map((c) => {
              const conferido = c.saldo_erp !== null && c.saldo_erp !== undefined;
              const certo = conferido && Number(c.diferenca || 0) === 0;
              const errado = conferido && Number(c.diferenca || 0) !== 0;
              const bg = certo
                ? "bg-emerald-50 border-emerald-200"
                : errado
                  ? "bg-rose-50 border-rose-200"
                  : !c.peca_id
                    ? "bg-rose-50/40 border-rose-200"
                    : "bg-white border-slate-200";
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setItemSelecionado(c)}
                  className={`grid w-full grid-cols-[1.4fr_0.8fr_0.8fr] items-center gap-2 rounded-xl border px-3 py-3 text-left active:scale-[0.99] ${bg}`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-semibold text-slate-900">{c.codigo || "—"}</p>
                    {!c.peca_id ? (
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">Sem cadastro</p>
                    ) : null}
                  </div>
                  <span className="text-right text-sm font-semibold text-slate-900">
                    {Number(c.quantidade || 0).toLocaleString("pt-BR")}
                  </span>
                  <span className="text-right text-sm font-semibold text-slate-700">
                    {conferido ? Number(c.saldo_erp).toLocaleString("pt-BR") : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          // ─── Web: tabela completa ──────────────────────────────────────
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Quando</th>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Peça</th>
                  <th className="px-4 py-3">Localização</th>
                  <th className="px-4 py-3 text-right">Qtd contada</th>
                  <th className="px-4 py-3 text-right">Saldo ERP</th>
                  <th className="px-4 py-3">Divergência</th>
                  <th className="px-4 py-3">Contado por</th>
                  <th className="px-4 py-3">Origem</th>
                </tr>
              </thead>
              <tbody>
                {contagens.map((c) => (
                  <tr key={c.id} className={`border-t border-slate-100 hover:bg-slate-50/60 ${!c.peca_id ? "bg-rose-50/40" : ""}`}>
                    <td className="px-4 py-3 text-xs font-medium text-slate-500">{formatDateTimeBR(c.created_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{c.codigo || "—"}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{c.descricao || "—"}</p>
                      {!c.peca_id ? (
                        <span className="mt-1 inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                          Sem cadastro
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.localizacao || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {Number(c.quantidade || 0).toLocaleString("pt-BR")} {c.unidade || ""}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {c.saldo_erp !== null && c.saldo_erp !== undefined ? Number(c.saldo_erp).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip label={diffLabel(c.diferenca)} tone={diffTone(c.diferenca)} />
                    </td>
                    <td className="px-4 py-3 text-slate-700">{c.contado_por_nome || "—"}</td>
                    <td className="px-4 py-3">
                      {c.origem === "mobile" ? (
                        <StatusChip label="Mobile" tone="cyan" />
                      ) : c.origem === "web" ? (
                        <StatusChip label="Web" tone="slate" />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );

  return (
    <>
      {isNative ? (
        <PullToRefresh onRefresh={carregar}>{conteudo}</PullToRefresh>
      ) : (
        conteudo
      )}

      {itemSelecionado ? (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/60 p-4 sm:items-center"
          onClick={() => setItemSelecionado(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-500">Detalhe do item</p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-slate-500">{itemSelecionado.codigo || "—"}</p>
              </div>
              <button
                onClick={() => setItemSelecionado(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <FaTimes />
              </button>
            </div>
            <h3 className="text-base font-semibold text-slate-900">{itemSelecionado.descricao || "Sem cadastro"}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Saldo físico</p>
                <p className="mt-0.5 font-semibold text-slate-900">{Number(itemSelecionado.quantidade || 0).toLocaleString("pt-BR")} {itemSelecionado.unidade || ""}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Saldo virtual (ERP)</p>
                <p className="mt-0.5 font-semibold text-slate-900">
                  {itemSelecionado.saldo_erp !== null && itemSelecionado.saldo_erp !== undefined
                    ? Number(itemSelecionado.saldo_erp).toLocaleString("pt-BR")
                    : "—"}
                </p>
              </div>
              <div className="col-span-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Divergência</p>
                <p className="mt-0.5 font-semibold text-slate-900">{diffLabel(itemSelecionado.diferenca)}</p>
              </div>
              {itemSelecionado.localizacao ? (
                <div className="col-span-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Localização</p>
                  <p className="mt-0.5 font-semibold text-slate-900">{itemSelecionado.localizacao}</p>
                </div>
              ) : null}
              {itemSelecionado.observacao ? (
                <div className="col-span-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Observação</p>
                  <p className="mt-0.5 text-slate-700">{itemSelecionado.observacao}</p>
                </div>
              ) : null}
              <div className="col-span-2 text-xs text-slate-500">
                Contado por <span className="font-semibold text-slate-700">{itemSelecionado.contado_por_nome || "—"}</span>
                {" · "}
                {formatDateTimeBR(itemSelecionado.created_at)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
