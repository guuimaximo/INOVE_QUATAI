// src/pages/Landing.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";

const NIVEIS_GESTAO = new Set(["Gestor", "Administrador"]);

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      // 1) Identificar usuário logado
      const { data: auth } = await supabase.auth.getUser();
      const authUserId = auth?.user?.id || null;
      const email = auth?.user?.email || null;

      if (!authUserId && !email) {
        navigate("/login", { replace: true });
        return;
      }

      // 2) Buscar nível em usuarios_aprovadores (auth_user_id; fallback email)
      let userRow = null;

      const q1 = await supabase
        .from("usuarios_aprovadores")
        .select("nivel, ativo, status_cadastro, auth_user_id, email")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (!q1.error && q1.data) userRow = q1.data;

      if (!userRow && email) {
        const q2 = await supabase
          .from("usuarios_aprovadores")
          .select("nivel, ativo, status_cadastro, auth_user_id, email")
          .eq("email", email)
          .maybeSingle();
        if (!q2.error && q2.data) userRow = q2.data;
      }

      // Se não achou cadastro, manda para a home real do INOVE
      if (!userRow) {
        navigate("/inove", { replace: true });
        return;
      }

      const nivel = String(userRow.nivel || "").trim();

      // ✅ Nova regra:
      // Gestor/Adm -> Dashboard completo
      // Outros -> Início Básico (para não cair no início “executivo”)
      if (NIVEIS_GESTAO.has(nivel)) {
        navigate("/inove", { replace: true });
      } else {
        navigate("/inicio-basico", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="bg-white border border-slate-200 rounded-2xl px-8 py-6 shadow-sm text-slate-600">
        Carregando...
      </div>
    </div>
  );
}
