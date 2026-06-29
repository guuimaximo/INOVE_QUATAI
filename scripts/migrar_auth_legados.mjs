/**
 * Migracao de usuarios legados para o Supabase Auth real.
 *
 * O QUE FAZ
 *   Para cada usuario em `usuarios_aprovadores` que ainda NAO tem conta no Auth
 *   (auth_user_id vazio) e tem e-mail REAL, cria a conta no Supabase Auth com o
 *   mesmo e-mail e a MESMA senha que ele ja usa hoje (ja confirmada), e grava o
 *   auth_user_id de volta na tabela. Resultado: a pessoa loga com login/senha
 *   identicos, mas agora como papel `authenticated` -> a RLS libera (e o `anon`
 *   continua barrado).
 *
 * SEGURANCA
 *   Usa a chave service_role (secreta). NUNCA comite essa chave nem este comando
 *   com a chave embutida. Passe por variavel de ambiente.
 *
 * COMO RODAR (PowerShell, na raiz do projeto)
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "cole_a_service_role_key_aqui"
 *   node scripts/migrar_auth_legados.mjs --dry-run     # so mostra o que faria
 *   node scripts/migrar_auth_legados.mjs               # aplica de verdade
 *
 * A service_role key fica em: Supabase -> Project Settings -> API -> service_role.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://wboelthngddvkgrvwkbu.supabase.co"
).trim();

// A chave service_role pode vir da env OU de um arquivo local gitignored
// (scripts/.service_key.local) — assim a chave nunca precisa ir para o chat.
function readKeyFromFile() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    return readFileSync(join(here, ".service_key.local"), "utf8").trim();
  } catch {
    return "";
  }
}

const SERVICE_ROLE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY || readKeyFromFile()
).trim();

const DRY_RUN = process.argv.includes("--dry-run");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER_DOMAIN = "@inove.local";

function isRealEmail(value = "") {
  const v = String(value || "").trim().toLowerCase();
  return EMAIL_REGEX.test(v) && !v.endsWith(PLACEHOLDER_DOMAIN);
}

function fail(msg) {
  console.error(`\n[ERRO] ${msg}\n`);
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  fail(
    "Faltou a service_role key. Use UMA das opcoes:\n" +
      "  1) Crie o arquivo scripts/.service_key.local com a chave dentro; ou\n" +
      '  2) PowerShell:  $env:SUPABASE_SERVICE_ROLE_KEY = "..."'
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Procura um usuario do Auth pelo e-mail (paginando), caso a conta ja exista.
async function findAuthUserByEmail(email) {
  const alvo = String(email).trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  // limite de seguranca (40k usuarios)
  for (let i = 0; i < 200; i += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const found = (data?.users || []).find(
      (u) => String(u.email || "").trim().toLowerCase() === alvo
    );
    if (found) return found;

    if (!data || data.users.length < perPage) return null;
    page += 1;
  }

  return null;
}

async function main() {
  console.log("=".repeat(64));
  console.log(`Migracao Auth de legados ${DRY_RUN ? "(DRY-RUN, nada sera gravado)" : "(APLICANDO)"}`);
  console.log(`Projeto: ${SUPABASE_URL}`);
  console.log("=".repeat(64));

  const { data: usuarios, error } = await admin
    .from("usuarios_aprovadores")
    .select("id, nome, login, email, senha, setor, nivel, auth_user_id")
    .is("auth_user_id", null)
    .order("nome");

  if (error) fail(`Falha ao listar usuarios: ${error.message}`);

  const candidatos = (usuarios || []).filter((u) => isRealEmail(u.email));
  const semEmail = (usuarios || []).filter((u) => !isRealEmail(u.email));

  console.log(`\nSem Auth no total: ${usuarios.length}`);
  console.log(`  -> com e-mail real (vamos migrar): ${candidatos.length}`);
  console.log(`  -> sem e-mail valido (PULADOS):     ${semEmail.length}`);
  if (semEmail.length) {
    semEmail.forEach((u) => console.log(`       . #${u.id} ${u.nome} (${u.email || "sem e-mail"})`));
  }
  console.log("");

  const resultado = { criados: 0, vinculados: 0, pulados: 0, erros: 0 };

  for (const u of candidatos) {
    const email = String(u.email).trim().toLowerCase();
    const senha = String(u.senha || "");
    const tag = `#${u.id} ${u.nome} <${email}>`;

    if (senha.length < 6) {
      console.log(`[PULADO] ${tag} -> senha com menos de 6 caracteres (Auth exige 6+). Trate manualmente.`);
      resultado.pulados += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(`[DRY-RUN] criaria conta Auth e vincularia: ${tag}`);
      resultado.criados += 1;
      continue;
    }

    try {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: {
          login: u.login || "",
          nome: u.nome || "",
          setor: u.setor || "",
          usuario_id: String(u.id),
          origem: "migracao-legado",
        },
      });

      let authUserId = created?.user?.id || null;

      if (createErr) {
        const msg = String(createErr.message || "").toLowerCase();
        const jaExiste = /already|registered|exists/.test(msg);

        if (!jaExiste) throw createErr;

        // Conta ja existia no Auth: encontra e apenas vincula.
        const existente = await findAuthUserByEmail(email);
        if (!existente) {
          throw new Error(`Auth diz que o e-mail ja existe, mas nao consegui localizar a conta: ${createErr.message}`);
        }
        authUserId = existente.id;
        console.log(`[JA EXISTIA] ${tag} -> vinculando a conta Auth existente.`);
        resultado.vinculados += 1;
      } else {
        console.log(`[CRIADO]  ${tag}`);
        resultado.criados += 1;
      }

      const { error: updErr } = await admin
        .from("usuarios_aprovadores")
        .update({ auth_user_id: authUserId, migrado_auth: true })
        .eq("id", u.id);

      if (updErr) throw new Error(`conta Auth ok, mas falhou ao gravar auth_user_id: ${updErr.message}`);
    } catch (e) {
      console.log(`[ERRO]    ${tag} -> ${e?.message || e}`);
      resultado.erros += 1;
    }
  }

  console.log("\n" + "-".repeat(64));
  console.log(
    `Resumo: criados=${resultado.criados} vinculados=${resultado.vinculados} pulados=${resultado.pulados} erros=${resultado.erros}`
  );
  if (DRY_RUN) console.log("(DRY-RUN: nada foi gravado. Rode sem --dry-run para aplicar.)");
  console.log("-".repeat(64) + "\n");
}

main().catch((e) => fail(e?.message || String(e)));
