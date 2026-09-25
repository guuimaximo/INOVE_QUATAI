// autorizacaoGestor.js — UM GESTOR AUTORIZA UMA AÇÃO COM O LOGIN E A SENHA DELE.
//
// Quem está na tela pode não ser gestor (o RH abre e acompanha a vaga); a ação sensível
// pede que um gestor, ou alguém acima, digite o login e a senha ali mesmo. Primeiro uso:
// alterar a data de abertura da vaga (dono, 16/09/2026: "pode fazer isso é gestor para
// cima, colocando o login e senha").
//
// A SENHA É CONFERIDA PELO LOGIN DO SUPABASE, e não comparando a coluna `senha` da tabela
// (como faz o Reparo de Embarcados): o mesmo caminho da tela de Login, sem ler senha de
// ninguém. O cliente é À PARTE e não guarda sessão — quem está logado continua logado como
// estava. Ao terminar, a sessão do gestor é encerrada só AQUI (`scope: "local"`); o padrão
// do Supabase é derrubar todas as sessões dele, inclusive a do celular.
import { createClient } from "@supabase/supabase-js";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "../supabase";
import { resolveAuthAccount } from "./authBridge";

const txt = (v) => String(v ?? "").trim();
const semAcento = (v) => txt(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Gestor para cima: Administrador e qualquer nível de gestor ("Gestor", "Gestor Manutenção"). */
export function ehGestorParaCima(nivel) {
  const n = semAcento(nivel);
  return n === "administrador" || n === "admin" || n.startsWith("gestor");
}

/**
 * Confere o login e a senha de quem autoriza. Devolve `{ id, nome, login, nivel }` de quem
 * autorizou, ou lança um Error com a frase para a tela.
 *
 * `comoGestor` (opcional, 25/09/2026): uma função que recebe o cliente JÁ LOGADO COMO O
 * GESTOR e grava com a sessão dele — quando o banco precisa saber quem autorizou (a
 * exclusão de etiqueta de SOS é travada por gatilho, que só aceita Gestor/Administrador e
 * carimba o autor pelo login). O que ela devolver vem em `resultado`; se ela lançar, o erro
 * sobe e nada é dado como autorizado.
 */
export async function autorizarGestor(login, senha, { comoGestor } = {}) {
  const identificador = txt(login);
  if (!identificador || !senha) throw new Error("Informe o login e a senha de quem autoriza.");

  let conta = null;
  try {
    conta = await resolveAuthAccount(identificador);
  } catch {
    throw new Error("Não deu para conferir o login agora. Tente de novo.");
  }
  if (!conta?.usuario_id) throw new Error(`Nenhum usuário com o login "${identificador}".`);
  if (conta.ativo === false) throw new Error("Este usuário está inativo.");

  const { data: pessoa, error } = await supabase
    .from("usuarios_aprovadores")
    .select("id, nome, login, nivel, ativo")
    .eq("id", conta.usuario_id)
    .maybeSingle();
  if (error || !pessoa) throw new Error("Não deu para conferir o nível de quem autoriza.");
  if (pessoa.ativo === false) throw new Error("Este usuário está inativo.");
  if (!ehGestorParaCima(pessoa.nivel)) {
    throw new Error(`Só Gestor ou Administrador pode autorizar (este login é ${txt(pessoa.nivel) || "sem nível"}).`);
  }
  if (!conta.auth_user_id || !txt(conta.auth_email)) {
    throw new Error("Este usuário ainda não tem conta de acesso ativa — peça ao administrador para liberar.");
  }

  const avulso = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "sb-inove-autorizacao",
    },
  });
  const { error: erroSenha } = await avulso.auth.signInWithPassword({
    email: txt(conta.auth_email),
    password: senha,
  });
  if (erroSenha) {
    const msg = semAcento(erroSenha.message);
    if (msg.includes("invalid") || msg.includes("credentials")) throw new Error("Senha incorreta.");
    if (msg.includes("confirm")) throw new Error("O e-mail deste usuário ainda não foi confirmado.");
    throw new Error(`Não deu para conferir a senha: ${erroSenha.message}`);
  }
  let resultado;
  try {
    if (comoGestor) resultado = await comoGestor(avulso);
  } finally {
    try {
      await avulso.auth.signOut({ scope: "local" });
    } catch {
      // a conferência já passou; encerrar a sessão avulsa é arrumação
    }
  }
  return {
    id: pessoa.id, nome: txt(pessoa.nome) || txt(pessoa.login), login: txt(pessoa.login), nivel: txt(pessoa.nivel),
    resultado,
  };
}
