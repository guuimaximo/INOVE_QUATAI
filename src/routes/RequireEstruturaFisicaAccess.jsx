import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAccessGovernance } from "../context/AccessContext";
import { canAccessEstruturaFisica } from "../utils/access";

export default function RequireEstruturaFisicaAccess({ children }) {
  const { user } = useAuth();
  const { profileMap } = useAccessGovernance();
  const location = useLocation();

  if (!user) return children;
  if (canAccessEstruturaFisica(user, profileMap)) return children;

  return <Navigate to="/" replace state={{ from: location }} />;
}
