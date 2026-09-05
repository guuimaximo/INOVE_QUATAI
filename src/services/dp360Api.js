// Cliente do gateway DP360. TUDO passa pela Edge Function `dp360-api`, que
// valida a sessão do INOVE, exige Administrador e guarda a chave da base de
// ponto como secret. O navegador nunca vê credencial da base DP360.
import { supabase } from "../supabase";

const LIMITE_PAGINA = 1000;

async function chamar(body) {
  const { data, error } = await supabase.functions.invoke("dp360-api", { body });
  if (error) throw new Error(error.message || "Não foi possível consultar a base DP360.");
  if (!data?.ok) throw new Error(data?.error || "Não foi possível consultar a base DP360.");
  return data;
}

/** Última atualização por fonte (aba Início). */
export async function carregarResumoDP360() {
  return chamar({ action: "overview" });
}

/**
 * Uma página de uma tabela liberada.
 * `filtros` no padrão PostgREST, por coluna:
 *   { cracha: "eq.30061089" }
 *   { date_ref: ["gte.2026-08-01", "lte.2026-08-31"] }  // intervalo
 *   { cracha: "in.(1,2,3)", latitude: "not.is.null" }
 */
export async function lerDP360(tabela, { colunas, filtros, ordem, limite, offset } = {}) {
  const dados = await chamar({
    action: "read",
    tabela,
    colunas,
    filtros,
    ordem,
    limite,
    offset,
  });
  return dados.linhas || [];
}

/** Lê a tabela inteira paginando (com teto de segurança para não travar a tela). */
export async function lerTudoDP360(tabela, opcoes = {}, maxPaginas = 40) {
  const passo = Math.min(opcoes.limite || LIMITE_PAGINA, LIMITE_PAGINA);
  const todas = [];
  for (let pagina = 0; pagina < maxPaginas; pagina += 1) {
    const bloco = await lerDP360(tabela, { ...opcoes, limite: passo, offset: pagina * passo });
    todas.push(...bloco);
    if (bloco.length < passo) break;
  }
  return todas;
}

async function gravar(tabela, op, payload) {
  return chamar({ action: "write", tabela, op, ...payload });
}

/** UPSERT (merge por chave definida no servidor). */
export function upsertDP360(tabela, linhas) {
  return gravar(tabela, "upsert", { linhas: Array.isArray(linhas) ? linhas : [linhas] });
}

/** INSERT append-only (histórico/log). */
export function inserirDP360(tabela, linhas) {
  return gravar(tabela, "insert", { linhas: Array.isArray(linhas) ? linhas : [linhas] });
}

/** DELETE — o servidor recusa sem filtro, de propósito. */
export function apagarDP360(tabela, filtros) {
  return gravar(tabela, "delete", { filtros });
}
