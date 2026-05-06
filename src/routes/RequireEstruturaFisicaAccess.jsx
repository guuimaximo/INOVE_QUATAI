import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canAccessEstruturaFisica } from "../utils/access";

export default function RequireEstruturaFisicaAccess({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return children;
  if (canAccessEstruturaFisica(user)) return children;

  return <Navigate to="/" replace state={{ from: location }} />;
}
