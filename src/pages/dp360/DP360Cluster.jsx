import { useContext, useEffect, useMemo, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Coffee,
  Gauge,
  LayoutDashboard,
  UserRound,
} from "lucide-react";
import { AuthContext } from "../../context/AuthContext";
import { useAccessGovernance } from "../../context/AccessContext";
import { canUserAccessPath } from "../../utils/access";
import { carregarResumoDP360 } from "../../services/dp360Api";

const ABAS = [
  { id: "inicio", label: "Início", icon: LayoutDashboard, resumo: "Visão geral da captura e das pendências do time." },
  { id: "refeicao", label: "Refeição", icon: Coffee, resumo: "Conferência do intervalo e da regra de almoço." },
  { id: "revisao", label: "Revisão", icon: ClipboardCheck, resumo: "Cartão, fontes e decisão de ajuste." },
  { id: "folgas", label: "Folgas", icon: CalendarDays, resumo: "Calendário e tratamento de folgas do período." },
  { id: "gordura", label: "Gordura", icon: Gauge, resumo: "Diferença entre o alvo e a jornada registrada." },
  { id: "ocorrencias", label: "Ocorrências", icon: AlertTriangle, resumo: "Pedidos do colaborador e avisos enviados pelo DP." },
  { id: "motorista", label: "Motorista", icon: UserRound, resumo: "Histórico individual, fontes e trilha do processo." },
];

function formatarData(valor) {
  if (!valor) return "Sem registro";
  const data = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor);
  if (Number.isNaN(data.getTime())) return String(valor);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: valor.length > 10 ? "short" : undefined }).format(data);
}

function ConteudoAba({ aba, resumo, carregando, erro }) {
  const Icon = aba.icon;
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Icon size={23} /></div>
          <div><h2 className="text-xl font-black text-slate-900">{aba.label}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{aba.resumo}</p></div>
        </div>
        <span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 ring-1 ring-amber-200">Ligação com a base DP360</span>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Sessão</div><div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><CheckCircle2 size={17} className="text-emerald-600" /> Login do INOVE ativo</div></div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Dados</div><div className="mt-2 text-sm font-semibold text-slate-800">{carregando ? "Conferindo a base DP360…" : erro ? "Não foi possível confirmar a base" : "Conexão privada ativa"}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Ações</div><div className="mt-2 text-sm font-semibold text-slate-800">Sempre processadas pelo servidor</div></div>
      </div>
      {aba.id === "inicio" && <div className="mt-6"><div className="text-xs font-black uppercase tracking-wide text-slate-500">Última atualização por fonte</div>{erro ? <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{erro}</p> : <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(resumo?.fontes || []).map((fonte) => <div key={fonte.nome} className={`rounded-2xl border p-4 ${fonte.ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}><div className="text-sm font-bold text-slate-800">{fonte.nome}</div><div className="mt-1 text-xs font-semibold text-slate-600">{fonte.ok ? formatarData(fonte.atualizado_em) : "indisponível"}</div></div>)}</div>}</div>}
    </section>
  );
}

export default function DP360Cluster() {
  const { aba } = useParams();
  const { user } = useContext(AuthContext);
  const { profileMap } = useAccessGovernance();
  const podeAcessar = canUserAccessPath(user, "/dp360", profileMap);
  const ativa = useMemo(() => ABAS.find((item) => item.id === aba) || ABAS[0], [aba]);
  const [resumo, setResumo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!podeAcessar) return;
    let ativo = true;
    carregarResumoDP360()
      .then((dados) => { if (ativo) setResumo(dados); })
      .catch((falha) => { if (ativo) setErro(falha.message || "Falha ao consultar a base DP360."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [podeAcessar]);
  if (!podeAcessar) return <div className="mx-auto max-w-3xl rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm"><AlertTriangle className="mx-auto text-amber-700" size={30} /><h1 className="mt-3 text-xl font-black text-slate-900">Sem acesso à DP360</h1><p className="mt-2 text-sm text-slate-700">Peça ao administrador para liberar o cluster DP360 no seu perfil do INOVE.</p></div>;
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-1 pb-10 sm:px-2">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-lg sm:p-8"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-100"><Clock3 size={15} /> Cluster INOVE</div><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">DP360 · Gestão de Ponto</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Uma única sessão do INOVE para acompanhar, decidir e comprovar o ponto da equipe.</p></div><div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm backdrop-blur-sm"><div className="text-blue-100">Sessão INOVE</div><div className="mt-1 font-bold">{user?.nome || "Usuário"}</div></div></div></header>
      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Abas da DP360">{ABAS.map((item) => { const Icon = item.icon; const selecionada = item.id === ativa.id; return <NavLink key={item.id} to={item.id === "inicio" ? "/dp360" : `/dp360/${item.id}`} className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${selecionada ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}><Icon size={17} />{item.label}</NavLink>; })}</nav>
      <ConteudoAba aba={ativa} resumo={resumo} carregando={carregando} erro={erro} />
    </div>
  );
}
