import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";
import { FaEnvelope, FaUserPlus, FaKey } from "react-icons/fa";

export default function Register() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);

    const novoUsuario = {
      nome,
      login,
      senha,
      ativo: false,
      nivel: "Aguardando Aprovação",
      criado_em: new Date().toISOString(),
    };

    const { error } = await supabase.from("usuarios_aprovadores").insert([novoUsuario]);
    setLoading(false);

    if (error) {
      alert("Erro ao cadastrar: " + error.message);
      return;
    }

    // Simulação do envio de e-mail
    await fetch("https://formsubmit.co/ajax/guilhermemaximocsc@gmail.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: "Novo cadastro aguardando aprovação - InovaQuatai",
        message: `
Novo usuário cadastrado:
Nome: ${nome}
Login: ${login}
Aguardando aprovação no painel de configuração.
        `,
      }),
    });

    alert(
      "Cadastro enviado! Aguarde aprovação do administrador. Você será notificado quando for liberado."
    );
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-blue-700 mb-6">
          Criar Conta - InovaQuatai
        </h1>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="text-gray-600 text-sm mb-1 block">Nome Completo</label>
            <div className="flex items-center border rounded-md px-3 py-2">
              <FaUserPlus className="text-gray-400 mr-2" />
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Digite seu nome completo"
                className="w-full outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-gray-600 text-sm mb-1 block">Usuário (Login)</label>
            <div className="flex items-center border rounded-md px-3 py-2">
              <FaKey className="text-gray-400 mr-2" />
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Digite um nome de usuário"
                className="w-full outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-gray-600 text-sm mb-1 block">Senha</label>
            <div className="flex items-center border rounded-md px-3 py-2">
              <FaLock className="text-gray-400 mr-2" />
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite uma senha segura"
                className="w-full outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-md font-medium mt-2 transition-all"
          >
            {loading ? "Enviando..." : "Cadastrar"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Já possui conta?{" "}
          <span
            onClick={() => navigate("/login")}
            className="text-blue-600 font-medium cursor-pointer hover:underline"
          >
            Faça login
          </span>
        </p>
      </div>
    </div>
  );
}
