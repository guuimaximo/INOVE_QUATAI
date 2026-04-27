import React, { useContext, useMemo } from "react";
import { AuthContext } from "../../context/AuthContext";
import {
  FaInfoCircle,
  FaShieldAlt,
  FaCheckCircle,
  FaClock,
  FaUserTag,
  FaBell,
} from "react-icons/fa";

function StatCard({ title, value, icon, hint }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {title}
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-800">{value}</div>
          {hint ? <div className="mt-1 text-xs text-gray-500">{hint}</div> : null}
        </div>
        <div className="h-10 w-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-700">
          {icon}
        </div>
      </div>
    </div>
  );
}

function Box({ title, icon, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-9 w-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-700">
          {icon}
        </div>
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}

function formatNowBR() {
  try {
    return new Date().toLocaleString("pt-BR");
  } catch {
    return "";
  }
}

export default function InicioRapido() {
  const { user } = useContext(AuthContext);

  const firstName = useMemo(() => {
    const n = String(user?.nome || "").trim();
    return n ? n.split(" ")[0] : "usuário";
  }, [user?.nome]);

  const nivel = user?.nivel || "-";

  const lastSeen = useMemo(() => {
    // Guarda um "último acesso" local (não depende do Supabase).
    // Isso dá sensação de sistema “vivo”, sem criar link nem nova tabela.
    const key = "inove_last_seen";
    const prev = localStorage.getItem(key);
    localStorage.setItem(key, new Date().toISOString());
    if (!prev) return "Primeiro acesso registrado";
    try {
      return new Date(prev).toLocaleString("pt-BR");
    } catch {
      return "—";
    }
  }, []);

  const statusSistema = "ONLINE";

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Visão Inicial</h1>
        <div className="text-sm text-gray-600">
          Olá, <b>{firstName}</b>. Você está logado como <b>{nivel}</b>.
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Atualizado em {formatNowBR()} • Utilize o menu lateral para navegar.
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Status do Sistema"
          value={statusSistema}
          icon={<FaCheckCircle />}
          hint="Serviços operacionais disponíveis"
        />
        <StatCard
          title="Seu Perfil"
          value={nivel}
          icon={<FaUserTag />}
          hint="Acessos conforme regra do módulo"
        />
        <StatCard
          title="Último acesso"
          value={lastSeen}
          icon={<FaClock />}
          hint="Registro local do navegador"
        />
      </div>

      {/* Conteúdo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Box title="Como usar o INOVE" icon={<FaInfoCircle />}>
          <ul className="list-disc pl-5 space-y-1">
            <li>Escolha o módulo no menu lateral (Tratativas, Intervenções, etc.).</li>
            <li>Mantenha filtros e datas consistentes para evitar leitura incorreta.</li>
            <li>Ao finalizar ações, registre observações completas e evidências quando aplicável.</li>
          </ul>
        </Box>

        <Box title="Regras e Boas Práticas" icon={<FaShieldAlt />}>
          <ul className="list-disc pl-5 space-y-1">
            <li>Use o sistema apenas para rotinas operacionais e registros oficiais.</li>
            <li>Evite duplicidade de lançamentos: pesquise antes de criar.</li>
            <li>Se identificar inconsistência, registre no campo de observação do módulo.</li>
          </ul>
        </Box>

        <Box title="Avisos" icon={<FaBell />}>
          <div className="text-sm text-gray-700">
            <div className="font-semibold text-gray-800 mb-2">Orientações rápidas</div>
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                Se você não encontrar um botão/aba, provavelmente seu nível não tem permissão para aquela ação.
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                Para solicitações urgentes, priorize o fluxo de Intervenções (SOS) conforme procedimento.
              </div>
            </div>
          </div>
        </Box>

        <Box title="Padrão de Qualidade do Registro" icon={<FaCheckCircle />}>
          <ul className="list-disc pl-5 space-y-1">
            <li>Escreva observações objetivas: o que foi feito, por quem e quando.</li>
            <li>Evite termos genéricos (ex.: “resolvido”) sem descrever a ação.</li>
            <li>Anexos: prefira evidência clara (foto nítida / PDF completo).</li>
          </ul>
        </Box>
      </div>
    </div>
  );
}
