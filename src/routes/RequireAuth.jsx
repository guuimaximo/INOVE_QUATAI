import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Capacitor } from "@capacitor/core";

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isNativeShell = Capacitor.isNativePlatform();
  const allowedNativePaths = new Set(["/pcm-troca-pneus", "/atualizar-perfil"]);

  if (loading) {
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

  if (isNativeShell && !allowedNativePaths.has(location.pathname)) {
    return <Navigate to="/pcm-troca-pneus" replace state={{ from: location }} />;
  }

  return children;
}
