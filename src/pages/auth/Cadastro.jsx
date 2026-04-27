// src/pages/Cadastro.jsx
// (Atualizado com Nome, Confirmar Senha e melhorias visuais)

import { useState } from 'react'
import { supabase } from '../../supabase'
import { Link, useNavigate } from 'react-router-dom'
import { FaUserPlus } from 'react-icons/fa'; // Ícone de exemplo

export default function Cadastro() {
  const [name, setName] = useState(''); // Estado para o nome
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // Estado para confirmar senha
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  async function handleCadastro() {
    setLoading(true);
    setErr('');

    // --- Validações ---
    if (!name.trim()) {
      setErr('Por favor, informe seu nome.');
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setErr('A senha deve ter pelo menos 6 caracteres.');
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setErr('As senhas não coincidem.');
      setLoading(false);
      return;
    }
    // --- Fim Validações ---

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        // Podemos enviar dados extras que o Gatilho SQL pode usar,
        // mas o nome é mais fácil atualizar depois no perfil.
        // data: { display_name: name } 
      }
    });

    if (error) {
      setErr(error.message);
    } else if (data.user) {
        // **ATUALIZAÇÃO PÓS-CADASTRO**: Insere o nome na tabela profiles
        // O gatilho já criou a linha, aqui apenas atualizamos o nome.
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ name: name })
            .eq('id', data.user.id); // Atualiza o perfil recém-criado

        if (profileError) {
             console.error("Erro ao atualizar nome no perfil:", profileError);
             // Não bloqueia o fluxo, mas loga o erro
        }

        alert('Cadastro realizado com sucesso! Verifique seu e-mail para confirmação (se habilitado). Redirecionando para Login.');
        navigate('/login');
    } else {
        // Caso raro onde não há erro mas não há usuário (ex: confirmação de email habilitada)
        alert('Cadastro iniciado! Verifique seu e-mail para confirmar a conta.');
         navigate('/login');
    }
    
    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 space-y-6">
        
        {/* Cabeçalho */}
        <div className="text-center">
           <FaUserPlus className="mx-auto h-12 w-auto text-blue-600" /> 
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
            Crie sua Conta
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Preencha os campos abaixo para se registrar.
          </p>
        </div>

        {/* Formulário */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
            <input
              type="text"
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome completo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail Corporativo</label>
            <input
              type="email"
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seunome@grupocsc.com.br"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha (mínimo 6 caracteres)</label>
            <input
              type="password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Senha</label>
            <input
              type="password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {err && <div className="text-red-600 text-sm font-medium text-center p-2 bg-red-50 rounded-md">{err}</div>}

          <button 
            onClick={handleCadastro} 
            disabled={loading}
            className="w-full mt-5 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
          >
            {loading ? 'Criando conta...' : 'Cadastrar'}
          </button>
        </div>
        
        {/* Link para Login */}
        <div className="text-center text-sm">
          Já possui uma conta?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
            Faça login aqui
          </Link>
        </div>
      </div>
    </div>
  )
}
