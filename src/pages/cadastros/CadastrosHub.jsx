import { useNavigate } from "react-router-dom";
import {
  Users,
  IdCard,
  ShieldCheck,
  Boxes,
  Truck,
  Bus,
  Tags,
  ListChecks,
  ChevronRight,
  Wrench,
} from "lucide-react";

// Hub central de cadastros (dados-base). Por enquanto organiza e leva aos
// cadastros que ja existem; os "parametros" (listas hoje fixas no codigo) vao
// ganhar gestao propria quando a tabela cadastros_opcoes entrar.
const GRUPOS = [
  {
    titulo: "Pessoas e acesso",
    itens: [
      { label: "Funcionários", desc: "Cadastro de colaboradores", icon: IdCard, path: "/funcionarios" },
      { label: "Usuários", desc: "Acesso ao sistema", icon: Users, path: "/usuarios" },
      { label: "Níveis de acesso", desc: "Permissões por nível", icon: ShieldCheck, path: "/niveis-acesso" },
    ],
  },
  {
    titulo: "Suprimentos",
    itens: [
      { label: "Peças", desc: "Catálogo de peças", icon: Boxes, path: "/suprimentos/cadastro" },
      { label: "Fornecedores", desc: "Fornecedores e serviços", icon: Truck, path: "/suprimentos/cadastro" },
    ],
  },
  {
    titulo: "Frota",
    itens: [
      { label: "Veículos / Linhas", desc: "Definir origem (RH ou cadastro próprio)", icon: Bus, soon: true },
    ],
  },
  {
    titulo: "Parâmetros (listas)",
    descricao: "Hoje fixos no código — vão virar cadastro gerenciável.",
    itens: [
      { label: "Motivos de tratativa", desc: "Diesel e RH", icon: ListChecks, soon: true },
      { label: "Tipos / motivos de SAC", desc: "Atendimento", icon: ListChecks, soon: true },
      { label: "Tipos de ocorrência (SOS)", desc: "Recolheu, avaria, troca...", icon: ListChecks, soon: true },
      { label: "Marcas de pneu", desc: "PCM", icon: Tags, soon: true },
      { label: "Prioridades", desc: "Padrão do sistema", icon: Tags, soon: true },
      { label: "Setores", desc: "Áreas da empresa", icon: Tags, soon: true },
      { label: "Tipos de reparo / embarcados", desc: "Manutenção", icon: Wrench, soon: true },
    ],
  },
];

export default function CadastrosHub() {
  const navigate = useNavigate();

  return (
    <div className="min-h-full bg-slate-100 p-4 lg:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Cadastros</h1>
          <p className="text-sm text-slate-500">
            Central de dados-base do sistema. Mantenha aqui o que alimenta as telas.
          </p>
        </div>

        <div className="space-y-7">
          {GRUPOS.map((grupo) => (
            <div key={grupo.titulo}>
              <div className="mb-2 flex items-baseline gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">{grupo.titulo}</h2>
                {grupo.descricao && <span className="text-xs text-slate-400">— {grupo.descricao}</span>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grupo.itens.map((item) => {
                  const Icon = item.icon;
                  const disabled = !!item.soon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && item.path && navigate(item.path)}
                      className={`flex items-center gap-3 rounded-xl border bg-white p-4 text-left transition ${
                        disabled
                          ? "border-slate-200 opacity-70"
                          : "border-slate-200 hover:border-blue-300 hover:shadow-sm"
                      }`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <Icon size={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          {item.label}
                          {disabled && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                              em breve
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-slate-500">{item.desc}</span>
                      </span>
                      {!disabled && <ChevronRight size={18} className="shrink-0 text-slate-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
