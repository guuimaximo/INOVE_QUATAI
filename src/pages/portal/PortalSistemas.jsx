// src/pages/PortalSistemas.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";
import { ExternalLink, LayoutGrid, ShieldAlert } from "lucide-react";

export default function PortalSistemas() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [nivel, setNivel] = useState(null);
  const [nome, setNome] = useState(null);

  const loginSalvo = useMemo(() => {
    return (
      localStorage.getItem("inove_login") ||
      sessionStorage.getItem("inove_login") ||
      localStorage.getItem("login") ||
      sessionStorage.getItem("login") ||
      ""
    );
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadNivel() {
      try {
        if (!loginSalvo) {
          navigate("/login", { replace: true });
          return;
        }

        const { data, error } = await supabase
          .from("usuarios_aprovadores")
          .select("nome, nivel, ativo")
          .eq("login", loginSalvo)
          .eq("ativo", true)
          .single();

        if (error || !data) {
          navigate("/login", { replace: true });
          return;
        }

        if (!mounted) return;

        setNivel(data.nivel || "");
        setNome(data.nome || "");

        const isGestorOuAdm =
          String(data.nivel || "").toLowerCase() === "gestor" ||
          String(data.nivel || "").toLowerCase() === "administrador";

        // ✅ CORREÇÃO CRÍTICA: não-Gestor/Adm não pode ficar no "/"
        if (!isGestorOuAdm) {
          navigate("/inove", { replace: true });
          return;
        }

        setLoading(false);
      } catch {
        navigate("/login", { replace: true });
      }
    }

    loadNivel();

    return () => {
      mounted = false;
    };
  }, [loginSalvo, navigate]);

  function abrirFarol() {
    window.location.href = "https://faroldemetas.onrender.com/?from=inove";
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-slate-600 text-sm">Carregando acesso...</div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <LayoutGrid className="w-6 h-6" />
              Portal de Sistemas
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Usuário: <span className="font-semibold">{nome || loginSalvo}</span> · Nível:{" "}
              <span className="font-semibold">{nivel}</span>
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
            <ShieldAlert className="w-4 h-4" />
            Acesso liberado apenas para Gestor/Administrador
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card INOVE */}
          <button
            onClick={() => navigate("/inove", { replace: true })}
            className="group text-left bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="text-lg font-extrabold text-slate-900">INOVE</div>
              <div className="text-slate-400 group-hover:text-slate-700 transition-colors">
                <ExternalLink className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Avarias, Cobranças, Tratativas, SOS, PCM, Diesel e demais módulos internos.
            </p>
            <div className="mt-4 text-xs font-bold uppercase tracking-wider text-blue-600">
              Entrar no INOVE
            </div>
          </button>

          {/* Card Farol Tático */}
          <button
            onClick={abrirFarol}
            className="group text-left bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="text-lg font-extrabold text-slate-900">Farol Tático</div>
              <div className="text-slate-400 group-hover:text-slate-700 transition-colors">
                <ExternalLink className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Metas, rotinas, reuniões, atas, ações e gestão tática integrada.
            </p>
            <div className="mt-4 text-xs font-bold uppercase tracking-wider text-emerald-600">
              Abrir Farol Tático
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
