// supabase/functions/provisionar-auth-usuario/index.ts
//
// Provisiona a conta no Supabase Auth (auth.users) de UM usuario legado de
// `usuarios_aprovadores`, para que ele consiga logar como `authenticated` e a
// RLS libere os dados. Chamada pelo admin ao APROVAR/ATIVAR o usuario
// (src/pages/configuracoes/Usuarios.jsx).
//
// POR QUE ISTO EXISTE
//   Todo usuario novo nasce so em `usuarios_aprovadores` (auth_user_id null).
//   Sem conta no Auth, o login cai no modo de contingencia (anon) e, com a RLS
//   Fase 1 trancando o anon, nao carrega nada. Antes isso era corrigido rodando
//   scripts/migrar_auth_legados.mjs na mao; agora acontece automaticamente na
//   aprovacao.
//
// SEGURANCA
//   verify_jwt ON (default): so roda com um caller autenticado. Usa a
//   service_role (injetada) SO no servidor. A conta e criada com o MESMO e-mail
//   e a MESMA senha que o usuario ja usa, com e-mail confirmado (email_confirm)
//   -> NAO dispara e-mail. Idempotente: se ja tem auth_user_id, nao faz nada.
//
// Secrets: nenhum extra. SUPABASE_URL / SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY ja vem do projeto.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER_DOMAIN = "@inove.local";

function isRealEmail(value = ""): boolean {
  const v = String(value || "").trim().toLowerCase();
  return EMAIL_REGEX.test(v) && !v.endsWith(PLACEHOLDER_DOMAIN);
}

// Procura uma conta do Auth pelo e-mail (paginando), caso ja exista.
async function findAuthUserByEmail(admin: any, email: string) {
  const alvo = String(email).trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 200; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = (data?.users || []).find(
      (u: any) => String(u.email || "").trim().toLowerCase() === alvo,
    );
    if (found) return found;
    if (!data || data.users.length < perPage) return null;
  }
  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "use POST" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ ok: false, error: "configuracao ausente no servidor" }, 500);
  }

  // 1) Caller precisa estar autenticado (cracha real).
  const authHeader = req.headers.get("Authorization") || "";
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: callerData, error: callerErr } = await caller.auth.getUser();
  if (callerErr || !callerData?.user) {
    return json({ ok: false, error: "nao autenticado" }, 401);
  }

  // 2) Payload.
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const usuarioId = Number.parseInt(body?.usuario_id, 10);
  if (!Number.isInteger(usuarioId)) {
    return json({ ok: false, error: "usuario_id invalido" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3) Le o usuario legado.
  const { data: u, error: selErr } = await admin
    .from("usuarios_aprovadores")
    .select("id, nome, login, email, senha, setor, auth_user_id")
    .eq("id", usuarioId)
    .maybeSingle();
  if (selErr) return json({ ok: false, error: selErr.message }, 500);
  if (!u) return json({ ok: false, error: "usuario nao encontrado" }, 404);

  // Idempotente.
  if (u.auth_user_id) {
    return json({ ok: true, status: "ja_vinculado", auth_user_id: u.auth_user_id });
  }

  const email = String(u.email || "").trim().toLowerCase();
  const senha = String(u.senha || "");
  if (!isRealEmail(email)) {
    return json(
      { ok: false, status: "sem_email_real", error: "usuario sem e-mail real; peca para cadastrar um e-mail valido" },
      422,
    );
  }
  if (senha.length < 6) {
    return json(
      { ok: false, status: "senha_curta", error: "senha com menos de 6 caracteres (Auth exige 6+)" },
      422,
    );
  }

  // 4) Cria (ou vincula) a conta no Auth.
  let authUserId: string | null = null;
  let status = "criado";

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: {
      login: u.login || "",
      nome: u.nome || "",
      setor: u.setor || "",
      usuario_id: String(u.id),
      origem: "provisionar-aprovacao",
    },
  });

  if (createErr) {
    const msg = String(createErr.message || "").toLowerCase();
    if (!/already|registered|exists/.test(msg)) {
      return json({ ok: false, error: createErr.message }, 500);
    }
    const existente = await findAuthUserByEmail(admin, email);
    if (!existente) {
      return json({ ok: false, error: `e-mail ja existe no Auth mas nao localizei a conta: ${createErr.message}` }, 500);
    }
    authUserId = existente.id;
    status = "vinculado";
  } else {
    authUserId = created?.user?.id ?? null;
  }

  if (!authUserId) return json({ ok: false, error: "conta Auth sem id apos criar" }, 500);

  // 5) Grava o vinculo de volta.
  const { error: updErr } = await admin
    .from("usuarios_aprovadores")
    .update({ auth_user_id: authUserId, migrado_auth: true })
    .eq("id", u.id);
  if (updErr) {
    return json({ ok: false, error: `conta Auth ok, mas falhou ao gravar o vinculo: ${updErr.message}` }, 500);
  }

  return json({ ok: true, status, auth_user_id: authUserId });
});
