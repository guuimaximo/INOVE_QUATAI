import { useContext, useMemo } from "react";
import { NavLink, useParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { AuthContext } from "../../context/AuthContext";
import { useAccessGovernance } from "../../context/AccessContext";
import { canUserAccessPath } from "../../utils/access";

import "./dp360.css";
import Inicio from "./abas/Inicio";
import Refeicao from "./abas/Refeicao";
import Revisao from "./abas/Revisao";
import Folgas from "./abas/Folgas";
import Gordura from "./abas/Gordura";
import Ocorrencias from "./abas/Ocorrencias";
import Motorista from "./abas/Motorista";

// A aparencia segue a FERRAMENTA (Sistemas/PONTO/app/ui), nao o visual do INOVE:
// topbar enxuta com abas de texto, fundo cinza, tabela densa. Quem usa o DP passa o
// dia lendo linha — densidade e cor de linha sao informacao, nao enfeite.
// Uma aba = um componente (src/pages/dp360/abas).
const ABAS = [
  { id: "inicio", label: "Início", Componente: Inicio },
  { id: "refeicao", label: "Refeição", Componente: Refeicao },
  { id: "revisao", label: "Revisão", Componente: Revisao },
  { id: "folgas", label: "Folgas", Componente: Folgas },
  { id: "gordura", label: "Gordura", Componente: Gordura },
  { id: "ocorrencias", label: "Ocorrências", Componente: Ocorrencias },
  { id: "motorista", label: "Motorista", Componente: Motorista },
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
    <div className="dp360 -m-4 sm:-m-6">
      <div className="dp-topbar">
        <div className="dp-brand">
          <div className="dp-brand-mark">DP</div>
          <div>
            <div className="dp-brand-title">DP360 · Gestão de Ponto</div>
            <div className="dp-brand-sub">{user?.nome || "Usuário"}</div>
          </div>
        </div>

        <nav className="dp-tabs" aria-label="Abas da DP360">
          {ABAS.map((item) => (
            <NavLink
              key={item.id}
              to={item.id === "inicio" ? "/dp360" : `/dp360/${item.id}`}
              className={`dp-tab${item.id === ativa.id ? " is-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Conteudo />
    </div>
  );
}
