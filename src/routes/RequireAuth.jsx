import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Capacitor } from "@capacitor/core";
import { useAccessGovernance } from "../context/AccessContext";
import { canUserAccessPath, getDefaultAccessiblePath } from "../utils/access";

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const { profileMap, loading: accessLoading } = useAccessGovernance();
  const location = useLocation();
  const isNativeShell = Capacitor.isNativePlatform();
  const allowedNativePaths = new Set([
    "/",
    "/pcm-troca-pneus",
    "/pcm-controle-fichas",
    "/suprimentos/contagem",
    "/atualizar-perfil",
  ]);
  const allowedNativePrefixes = ["/embarcados", "/suprimentos/contagem"];

  if (loading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        Carregando sessao...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Revisao de perfil NAO bloqueia mais o acesso: usuarios legados com setor/email
  // incompletos (e o envio de e-mail do Auth/SMTP indisponivel) ficavam presos nesta
  // tela. A pagina /atualizar-perfil continua acessivel, mas e opcional.

  const isAllowedNativePath =
    allowedNativePaths.has(location.pathname) ||
    allowedNativePrefixes.some(
      (prefix) =>
        location.pathname === prefix ||
        location.pathname.startsWith(`${prefix}-`) ||
        location.pathname.startsWith(`${prefix}/`)
    );

  if (isNativeShell && !isAllowedNativePath) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  // No native shell, qualquer path liberado eh sempre permitido (a MobileHome controla a UI).
  // Isso evita loops de redirect quando as permissoes do DB nao incluem os novos modulos.
  if (!isNativeShell && !canUserAccessPath(user, location.pathname, profileMap)) {
    return <Navigate to={getDefaultAccessiblePath(user, profileMap)} replace state={{ from: location }} />;
  }

  return children;
}
