// src/pages/Cadastro.jsx

import { useState } from "react";
import { supabase } from "../supabase";
import { Link, useNavigate } from "react-router-dom";
import { FaUserPlus } from "react-icons/fa";

export default function Cadastro() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const navigate = useNavigate();

  async function handleCadastro(e) {
    e?.preventDefault();

    if (loading) return;

    setLoading(true);
    setErr("");

    try {
      const nomeLimpo = name.trim();
      const emailLimpo = email.trim().toLowerCase();

      if (!nomeLimpo) {
        setErr("Por favor, informe seu nome.");
        return;
      }

      if (!emailLimpo) {
        setErr("Por favor, informe seu e-mail.");
        return;
      }

      if (!emailLimpo.includes("@")) {
        setErr("Informe um e-mail válido.");
        return;
      }

      if (password.length < 6) {
        setErr("A senha deve ter pelo menos 6 caracteres.");
        return;
      }

      if (password !== confirmPassword) {
        setErr("As senhas não coincidem.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: emailLimpo,
        password,
        options: {
          data: {
            name: nomeLimpo,
            nome: nomeLimpo,
          },
        },
      });

      if (error) {
        setErr(error.message || "Erro ao realizar cadastro.");
        return;
      }

      const userId = data?.user?.id;

      if (userId) {
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(
            {
              id: userId,
              name: nomeLimpo,
              email: emailLimpo,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "id",
            }
          );

        if (profileError) {
          console.warn("Cadastro criado, mas não salvou em profiles:", profileError);
        }
      }

      alert(
        "Cadastro realizado com sucesso! Verifique seu e-mail para confirmação, se estiver habilitado."
      );

      navigate("/login");
    } catch (error) {
      console.error("Erro inesperado no cadastro:", error);
      setErr("Erro inesperado ao cadastrar. Verifique o console.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <FaUserPlus className="mx-auto h-12 w-auto text-blue-600" />

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
            Crie sua Conta
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Preencha os campos abaixo para se registrar.
          </p>
        </div>

        <form onSubmit={handleCadastro} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome Completo
            </label>

            <input
              type="text"
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome completo"
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-mail Corporativo
            </label>

            <input
              type="email"
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seunome@grupocsc.com.br"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>

            <input
              type="password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar Senha
            </label>

            <input
              type="password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
              autoComplete="new-password"
            />
          </div>

          {err && (
            <div className="text-red-600 text-sm font-medium text-center p-2 bg-red-50 rounded-md">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-5 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? "Criando conta..." : "Cadastrar"}
          </button>
        </form>

        <div className="text-center text-sm">
          Já possui uma conta?{" "}
          <Link
            to="/login"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Faça login aqui
          </Link>
        </div>
      </div>
    </div>
  );
}
