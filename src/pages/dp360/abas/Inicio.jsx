import { useEffect, useState } from "react";
import { CheckCircle2, LayoutDashboard } from "lucide-react";
import AbaShell from "./AbaShell";
import { carregarResumoDP360 } from "../../../services/dp360Api";

function formatarData(valor) {
  if (!valor) return "Sem registro";
  const data = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor);
  if (Number.isNaN(data.getTime())) return String(valor);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: valor.length > 10 ? "short" : undefined,
  }).format(data);
}

export default function Inicio() {
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

  return (
    <AbaShell
      icone={LayoutDashboard}
      titulo="Início"
      resumo="Visão geral da captura e das pendências do time."
      carregando={carregando}
      erro={erro}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Sessão</div>
          <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <CheckCircle2 size={17} className="text-emerald-600" /> Login do INOVE ativo
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Dados</div>
          <div className="mt-2 text-sm font-semibold text-slate-800">
            {erro ? "Não foi possível confirmar a base" : "Conexão privada ativa"}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Ações</div>
          <div className="mt-2 text-sm font-semibold text-slate-800">Sempre processadas pelo servidor</div>
        </div>
      </div>

      <div className="mt-6">
        <div className="text-xs font-black uppercase tracking-wide text-slate-500">
          Última atualização por fonte
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(resumo?.fontes || []).map((fonte) => (
            <div
              key={fonte.nome}
              className={`rounded-2xl border p-4 ${fonte.ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}
            >
              <div className="text-sm font-bold text-slate-800">{fonte.nome}</div>
              <div className="mt-1 text-xs font-semibold text-slate-600">
                {fonte.ok ? formatarData(fonte.atualizado_em) : "indisponível"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AbaShell>
  );
}
