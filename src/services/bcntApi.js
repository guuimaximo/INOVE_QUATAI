/* O CAMINHO DO INOVE ATÉ A BASE BCNT (21/09/2026).
 *
 * Antes as telas falavam direto com a BCNT, com a chave pública dentro do site. A BCNT
 * fechou essa chave e tudo parou: checklists, meritocracia e os arquivos do Agente. O dono
 * não quis repor a chave no site ("não queria deixar como VITE"), então ela passou a viver
 * só como secret da função `bcnt-api`, e é a função que fala com a BCNT.
 *
 * Aqui é só o telefone: manda a sessão do INOVE e recebe as linhas. Somente leitura — a
 * função não tem caminho de escrita, porque a base é de outro dono.
 */
import { supabase } from "../supabase";

const FUNCAO = "bcnt-api";
const LIMITE_PAGINA = 1000; // o PostgREST corta em 1000 por página, aqui como lá

async function chamar(corpo) {
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao?.session?.access_token;
  if (!token) throw new Error("entre no INOVE de novo para ver estes dados");
  const { data, error } = await supabase.functions.invoke(FUNCAO, {
    body: corpo,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw new Error(error.message || "não foi possível falar com a BCNT");
  if (data && data.ok === false) throw new Error(data.error || "a BCNT recusou a consulta");
  return data;
}

/** Uma página (até 1000 linhas). `filtros` é PostgREST: { status: "eq.ativo" }. */
export async function lerBCNT(tabela, { colunas, filtros, ordem, limite, offset } = {}) {
  const r = await chamar({ action: "read", tabela, colunas, filtros, ordem, limite, offset });
  return r?.linhas ?? [];
}

/** Todas as páginas, na ordem pedida. Para até a primeira página incompleta. */
export async function lerTudoBCNT(tabela, opcoes = {}, maxPaginas = 40) {
  const passo = Math.min(opcoes.limite || LIMITE_PAGINA, LIMITE_PAGINA);
  const tudo = [];
  for (let pagina = 0; pagina < maxPaginas; pagina += 1) {
    const linhas = await lerBCNT(tabela, { ...opcoes, limite: passo, offset: pagina * passo });
    tudo.push(...linhas);
    if (linhas.length < passo) break;
  }
  return tudo;
}

/** Os arquivos de um bucket da BCNT (mesma forma do `storage.list`). */
export async function arquivosBCNT(bucket, prefixo = "", { limite = 100, ordenarPor = "name", ordem = "asc" } = {}) {
  const r = await chamar({ action: "arquivos", bucket, prefixo, limite, ordenarPor, ordem });
  return r?.arquivos ?? [];
}

/** Link temporário (5 min) de um arquivo. A chave nunca sai do servidor. */
export async function urlArquivoBCNT(bucket, caminho) {
  if (!caminho) return "";
  const r = await chamar({ action: "arquivo_url", bucket, caminho });
  return r?.url ?? "";
}
