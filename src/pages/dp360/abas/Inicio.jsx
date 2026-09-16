import { Suspense, lazy, useContext, useEffect, useState } from "react";
import AbaShell from "./AbaShell";
import { AuthContext } from "../../../context/AuthContext";
import { useAccessGovernance } from "../../../context/AccessContext";
import { canUserAccessPath } from "../../../utils/access";

/* O RESUMO MORA AQUI TAMBÉM (dono, 15/09/2026: "essa tela de resumo coloca na de Início do
 * DP360"). É o MESMO componente da página `/dp360-resumo`, desenhado sem a moldura dela —
 * duas cópias do gerencial seria duas contas para o mesmo mês.
 * SOB DEMANDA (`lazy`): ele é a maior tela do cluster e lê a competência inteira; carregá-lo
 * junto com as abas deixaria a DP360 mais lenta para quem nem passa aqui. */
const DP360Resumo = lazy(() => import("../DP360Resumo"));
import { carregarResumoDP360 } from "../../../services/dp360Api";

function formatarData(valor) {
  if (!valor) return "sem registro";
  const iso = String(valor);
  const data = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(data.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: iso.length > 10 ? "short" : undefined,
  }).format(data);
}

/* A CONTA DO TRANSNET MOROU AQUI até 15/09/2026. Foi para o topo, ao lado do robô
 * (`ContaTransnetNoTopo`): quem abria direto a Revisão ou as Ocorrências não passava por
 * esta tela e disparava sem saber se estava conectado. */

export default function Inicio() {
  const { user } = useContext(AuthContext);
  const { profileMap } = useAccessGovernance();
  // o Resumo é uma página com liberação própria: quem não a tem vê só as fontes
  const podeVerResumo = canUserAccessPath(user, "/dp360-resumo", profileMap);
  const [resumo, setResumo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    carregarResumoDP360()
      .then((dados) => { if (ativo) setResumo(dados); })
      .catch((falha) => { if (ativo) setErro(falha.message || "Falha ao consultar a base DP360."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  const fontes = resumo?.fontes || [];

  return (
    <AbaShell
      carregando={carregando}
      erro={erro}
      resumo="Até quando cada fonte do ponto está atualizada. Se uma delas atrasa, as telas mostram dado velho."
    >
      {podeVerResumo ? (
        <Suspense
          fallback={
            <div className="dp-espera" role="status" aria-live="polite">
              <span className="dp-espera-circulo" aria-hidden="true" />
              <span className="dp-espera-txt">Abrindo o Resumo…</span>
            </div>
          }
        >
          <DP360Resumo embutido />
        </Suspense>
      ) : null}

      <div className="dp-fontes-t">Fontes do ponto</div>
      <div className="dp-tabela-wrap">
        <table className="dp-tabela">
          <thead>
            <tr>
              <th>Fonte</th>
              <th>Atualizada até</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {fontes.map((fonte) => (
              <tr key={fonte.nome} className={fonte.ok ? "row-ok" : "row-sem"}>
                <td>{fonte.nome}</td>
                <td className="dp-num dp-mono">{fonte.ok ? formatarData(fonte.atualizado_em) : "—"}</td>
                <td>
                  <span className={`dp-pill ${fonte.ok ? "ok" : "danger"}`}>
                    {fonte.ok ? "no ar" : "indisponível"}
                  </span>
                </td>
              </tr>
            ))}
            {!fontes.length && (
              <tr>
                <td colSpan={3} className="dp-faint">Nenhuma fonte respondeu.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AbaShell>
  );
}
