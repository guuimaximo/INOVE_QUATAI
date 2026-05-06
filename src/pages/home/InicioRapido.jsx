import React, { useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { useAccessGovernance } from "../../context/AccessContext";
import {
  FaChevronRight,
  FaInfoCircle,
  FaShieldAlt,
  FaCheckCircle,
  FaClock,
  FaUserTag,
  FaBell,
} from "react-icons/fa";
import { getMobileQuickLinks } from "../../utils/mobileNavigation";

function StatCard({ title, value, icon, hint, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </div>
          <div className="mt-2 text-xl font-bold text-slate-800 break-words sm:text-2xl">{value}</div>
          {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
          {icon}
        </div>
      </div>
    </div>
  );
}

function Box({ title, icon, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
          {icon}
        </div>
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="text-sm leading-relaxed text-slate-700">{children}</div>
    </div>
  );
}

function QuickLinkRow({ title, description, to }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 transition last:border-b-0 hover:bg-slate-50"
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
      </div>
      <FaChevronRight className="shrink-0 text-slate-400" />
    </Link>
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
  const { profileMap } = useAccessGovernance();

  const firstName = useMemo(() => {
    const name = String(user?.nome || "").trim();
    return name ? name.split(" ")[0] : "usuario";
  }, [user?.nome]);

  const nivel = user?.nivel || "-";

  const lastSeen = useMemo(() => {
    const key = "inove_last_seen";
    const previous = localStorage.getItem(key);
    localStorage.setItem(key, new Date().toISOString());
    if (!previous) return "Primeiro acesso registrado";
    try {
      return new Date(previous).toLocaleString("pt-BR");
    } catch {
      return "-";
    }
  }, []);

  const statusSistema = "ONLINE";
  const quickLinks = useMemo(() => getMobileQuickLinks(user, profileMap), [profileMap, user]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Inove</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Visao inicial</h1>
            <p className="mt-1 text-sm text-slate-600">
              Ola, <strong>{firstName}</strong>. Perfil atual: <strong>{nivel}</strong>.
            </p>
          </div>
          <div className="text-xs text-slate-500">Atualizado em {formatNowBR()}</div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Status do Sistema"
          value={statusSistema}
          icon={<FaCheckCircle />}
          hint="Servicos operacionais disponiveis"
        />
        <StatCard
          title="Seu Perfil"
          value={nivel}
          icon={<FaUserTag />}
          hint="Acessos conforme regra do modulo"
        />
        <StatCard
          title="Ultimo acesso"
          value={lastSeen}
          icon={<FaClock />}
          hint="Registro local do navegador"
          className="sm:col-span-2 xl:col-span-1"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">Acesso rapido</div>
          <div className="mt-1 text-xs text-slate-500">
            Entradas principais para usar o app no celular com menos toques.
          </div>
        </div>
        <div>
          {quickLinks.map((link) => (
            <QuickLinkRow
              key={link.path}
              title={link.title}
              description={link.description}
              to={link.path}
            />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Box title="Regras e boas praticas" icon={<FaShieldAlt />}>
          <ul className="list-disc space-y-1 pl-5">
            <li>Use o sistema apenas para rotinas operacionais e registros oficiais.</li>
            <li>Evite duplicidade de lancamentos: pesquise antes de criar um item novo.</li>
            <li>Se houver inconsistencias, deixe observacoes claras no proprio modulo.</li>
            <li>Use observacoes objetivas com acao executada, responsavel e horario.</li>
            <li>Quando houver anexo, prefira evidencia clara e completa.</li>
          </ul>
        </Box>

        <Box title="Avisos rapidos" icon={<FaBell />}>
          <div className="space-y-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              Se voce nao encontrar um botao ou aba, seu nivel provavelmente nao tem permissao para aquela acao.
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              Para solicitacoes urgentes, priorize o fluxo de intervencoes conforme o procedimento operacional.
            </div>
          </div>
        </Box>
      </div>
    </div>
  );
}
