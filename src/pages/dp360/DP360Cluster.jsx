import { useContext, useMemo } from "react";
import { NavLink, useParams } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
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

import Inicio from "./abas/Inicio";
import Refeicao from "./abas/Refeicao";
import Revisao from "./abas/Revisao";
import Folgas from "./abas/Folgas";
import Gordura from "./abas/Gordura";
import Ocorrencias from "./abas/Ocorrencias";
import Motorista from "./abas/Motorista";

// Uma aba = um componente próprio (src/pages/dp360/abas). Cada tela do DP360
// antigo é portada no seu arquivo, então dá para evoluir uma sem mexer nas outras.
const ABAS = [
  { id: "inicio", label: "Início", icon: LayoutDashboard, Componente: Inicio },
  { id: "refeicao", label: "Refeição", icon: Coffee, Componente: Refeicao },
  { id: "revisao", label: "Revisão", icon: ClipboardCheck, Componente: Revisao },
  { id: "folgas", label: "Folgas", icon: CalendarDays, Componente: Folgas },
  { id: "gordura", label: "Gordura", icon: Gauge, Componente: Gordura },
  { id: "ocorrencias", label: "Ocorrências", icon: AlertTriangle, Componente: Ocorrencias },
  { id: "motorista", label: "Motorista", icon: UserRound, Componente: Motorista },
];

export default function DP360Cluster() {
  const { aba } = useParams();
  const { user } = useContext(AuthContext);
  const { profileMap } = useAccessGovernance();
  const podeAcessar = canUserAccessPath(user, "/dp360", profileMap);
  const ativa = useMemo(() => ABAS.find((item) => item.id === aba) || ABAS[0], [aba]);

  if (!podeAcessar) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto text-amber-700" size={30} />
        <h1 className="mt-3 text-xl font-black text-slate-900">Sem acesso à DP360</h1>
        <p className="mt-2 text-sm text-slate-700">
          Peça ao administrador para liberar o cluster DP360 no seu perfil do INOVE.
        </p>
      </div>
    );
  }

  const Conteudo = ativa.Componente;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-1 pb-10 sm:px-2">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-100">
              <Clock3 size={15} /> Cluster INOVE
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">DP360 · Gestão de Ponto</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
              Uma única sessão do INOVE para acompanhar, decidir e comprovar o ponto da equipe.
            </p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm backdrop-blur-sm">
            <div className="text-blue-100">Sessão INOVE</div>
            <div className="mt-1 font-bold">{user?.nome || "Usuário"}</div>
          </div>
        </div>
      </header>

      <nav
        className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
        aria-label="Abas da DP360"
      >
        {ABAS.map((item) => {
          const Icon = item.icon;
          const selecionada = item.id === ativa.id;
          return (
            <NavLink
              key={item.id}
              to={item.id === "inicio" ? "/dp360" : `/dp360/${item.id}`}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
                selecionada ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon size={17} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <Conteudo />
    </div>
  );
}
