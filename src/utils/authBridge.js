import { supabase } from "../supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER_DOMAIN = "@inove.local";

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeAccessValue(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function sanitizeAliasForEmail(value = "") {
  const normalized = normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".");

  return normalized.replace(/^\.+|\.+$/g, "") || "usuario";
}

async function queryLegacyBy(column, value) {
  if (value === null || value === undefined || value === "") return null;
  const { data, error } = await supabase
    .from("usuarios_aprovadores")
    .select("*")
    .eq(column, value)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function findLegacyUser(authUser, profile) {
  const candidates = [];
  const metadata = authUser?.user_metadata || {};
  const profileUserId = profile?.usuario_id;
  const metadataUserId = Number.parseInt(metadata.usuario_id, 10);

  candidates.push(["auth_user_id", authUser?.id]);
  if (Number.isInteger(profileUserId)) candidates.push(["id", profileUserId]);
  if (Number.isInteger(metadataUserId)) candidates.push(["id", metadataUserId]);
  candidates.push(["email", normalizeText(authUser?.email).toLowerCase()]);
  candidates.push(["login", normalizeText(profile?.login)]);
  candidates.push(["login", normalizeText(metadata.login)]);

  const tried = new Set();

  for (const [column, value] of candidates) {
    const key = `${column}:${value}`;
    if (!value || tried.has(key)) continue;
    tried.add(key);

    const row = await queryLegacyBy(column, value);
    if (row) return row;
  }

  return null;
}

function buildProfileReviewState({ authUser, legacyUser, profile }) {
  const reasons = [];
  const nome = normalizeText(profile?.nome || legacyUser?.nome);
  const login = normalizeText(profile?.login || legacyUser?.login || authUser?.user_metadata?.login);
  const setor = normalizeText(profile?.setor || legacyUser?.setor || authUser?.user_metadata?.setor);
  const email = normalizeText(authUser?.email || legacyUser?.email).toLowerCase();

  if (!nome) reasons.push("nome");
  if (!login) reasons.push("login");
  if (!setor) reasons.push("setor");
  if (!isValidEmail(email) || isPlaceholderEmail(email)) reasons.push("email");

  return {
    requiresProfileReview: reasons.length > 0,
    profileReviewReasons: reasons,
  };
}

export function isValidEmail(value = "") {
  return EMAIL_REGEX.test(String(value).trim().toLowerCase());
}

export function isPlaceholderEmail(value = "") {
  return String(value).trim().toLowerCase().endsWith(PLACEHOLDER_DOMAIN);
}

export function isPendingAccessLevel(value = "") {
  return normalizeAccessValue(value) === "pendente";
}

export function buildPlaceholderEmail(loginValue = "", userId = "") {
  const alias = sanitizeAliasForEmail(loginValue);
  const suffix = normalizeText(userId) ? `.${normalizeText(userId)}` : "";
  return `${alias}${suffix}${PLACEHOLDER_DOMAIN}`;
}

export function getAbsoluteUrl(path = "/") {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return new URL(safePath, window.location.origin).toString();
}

export async function resolveAuthAccount(identifier) {
  const cleanIdentifier = normalizeText(identifier);
  if (!cleanIdentifier) return null;

  const { data, error } = await supabase.rpc("resolve_auth_account", {
    p_identifier: cleanIdentifier,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return row || null;
}

export async function ensureLegacyAuthLink(emailHint = null) {
  const { error } = await supabase.rpc("link_auth_account", {
    p_email: normalizeText(emailHint) || null,
  });

  if (error) throw error;
}

export async function hydrateAuthenticatedUser(authUser) {
  if (!authUser?.id) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (profileError) throw profileError;

  const legacyUser = await findLegacyUser(authUser, profile);
  const review = buildProfileReviewState({ authUser, legacyUser, profile });
  const metadata = authUser.user_metadata || {};

  return {
    id: legacyUser?.id ?? profile?.usuario_id ?? authUser.id,
    usuario_id: profile?.usuario_id ?? legacyUser?.id ?? null,
    auth_user_id: authUser.id,
    nome: profile?.nome || legacyUser?.nome || metadata.nome || "Usuario",
    login: profile?.login || legacyUser?.login || metadata.login || authUser.email || "",
    email: authUser.email || legacyUser?.email || "",
    nivel: profile?.nivel || legacyUser?.nivel || "Pendente",
    setor: profile?.setor || legacyUser?.setor || metadata.setor || "",
    ativo: profile?.ativo ?? legacyUser?.ativo ?? true,
    status_cadastro:
      legacyUser?.status_cadastro || (isPendingAccessLevel(profile?.nivel || legacyUser?.nivel) ? "Pendente" : "Aprovado"),
    migrado_auth: legacyUser?.migrado_auth ?? !!legacyUser?.auth_user_id,
    legacy_user: legacyUser,
    profile,
    requires_profile_review: review.requiresProfileReview,
    profile_review_reasons: review.profileReviewReasons,
  };
}

export function getRpcSetupMessage() {
  return "Execute as migrations de login/auth do Supabase antes de usar o novo fluxo de autenticacao.";
}
