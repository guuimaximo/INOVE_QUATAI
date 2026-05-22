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
    "/atualizar-perfil",
  ]);
  const allowedNativePrefixes = ["/embarcados"];

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

  if (user?.requires_profile_review && location.pathname !== "/atualizar-perfil") {
    return <Navigate to="/atualizar-perfil" replace state={{ from: location }} />;
  }

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
