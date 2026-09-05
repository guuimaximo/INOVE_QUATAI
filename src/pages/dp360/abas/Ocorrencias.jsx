import { AlertTriangle } from "lucide-react";
import AbaShell from "./AbaShell";

// TODO(port DP360): tela ainda nao portada do app antigo (Sistemas/PONTO).
// A especificacao desta aba esta em docs/dp360/.
export default function Ocorrencias() {
  return (
    <AbaShell icone={AlertTriangle} titulo="Ocorrências" resumo="Pedidos do colaborador e avisos enviados pelo DP.">
      <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
        Em construcao — porte da tela do DP360 em andamento.
      </p>
    </AbaShell>
  );
}
