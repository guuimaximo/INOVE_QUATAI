import { CalendarDays } from "lucide-react";
import AbaShell from "./AbaShell";

// TODO(port DP360): tela ainda nao portada do app antigo (Sistemas/PONTO).
// A especificacao desta aba esta em docs/dp360/.
export default function Folgas() {
  return (
    <AbaShell icone={CalendarDays} titulo="Folgas" resumo="Calendário e tratamento de folgas do período.">
      <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
        Em construcao — porte da tela do DP360 em andamento.
      </p>
    </AbaShell>
  );
}
