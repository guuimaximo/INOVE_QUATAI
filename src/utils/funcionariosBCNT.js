/* O CADASTRO DE QUEM TRABALHA NA 046 — nome, função, status e celular.
 *
 * DE ONDE VEM (21/09/2026). Era lido direto da base BCNT, do navegador e com a chave
 * pública. Essa base passou a recusar a leitura ("permission denied for table
 * funcionarios_atualizada") e as telas de Pessoas, Checklists e Diesel ficaram vazias, sem
 * nenhuma mudança nossa. Agora a mesma fonte oficial do lake
 * (`csc-views-gestao-informacao`.`vw_funcionarios_celular`, a do de/para do cerco do ponto)
 * é trazida pelo importador diário para a tabela `funcionarios` da base de importação, e o
 * INOVE a lê pelo gateway `dp360-api`: chave de serviço no servidor, sessão do INOVE na
 * porta. Nenhuma tela escreve — a tabela é só leitura.
 *
 * O NOME DO ARQUIVO E AS FUNÇÕES FICARAM: as telas continuam chamando as mesmas três, com o
 * mesmo formato de saída (`mapFuncionarioBCNT`). O que mudou é só por onde o dado entra.
 * A única coluna que trocou de nome na origem é o telefone: `nr_telefone_celular` virou
 * `numero_celular`, e o mapeamento aceita as duas.
 */
import { lerDP360, lerTudoDP360 } from "../services/dp360Api";

const TABELA = "funcionarios";
const COLUNAS =
  "id_funcionario,nr_cracha,nm_funcionario,nm_funcao,numero_celular,dt_inicio_atividade,status";

function cleanText(value) {
  return String(value || "").trim();
}

export function mapFuncionarioBCNT(row) {
  return {
    id: row?.id_funcionario ?? null,
    chapa: cleanText(row?.nr_cracha),
    nome: cleanText(row?.nm_funcionario),
    cargo: cleanText(row?.nm_funcao),
    status: cleanText(row?.status),
    telefone: cleanText(row?.numero_celular ?? row?.nr_telefone_celular),
    dtInicioAtividade: row?.dt_inicio_atividade || null,
  };
}

/**
 * Todos os funcionários de um status (padrão: os ativos), em ordem de nome.
 * `status: ["ativo", "afastado"]` traz os dois; `status: null` traz a base inteira.
 * A paginação é do `lerTudoDP360` (o PostgREST corta em 1000 por página).
 */
/* AS COLUNAS PEDIDAS PELAS TELAS PASSAM POR AQUI. Elas foram escritas para a base antiga:
   vêm com espaço depois da vírgula (o gateway não aceita) e pedem `nr_telefone_celular`,
   que na view do lake se chama `numero_celular`. Traduzir aqui evita mexer em sete telas —
   e a linha devolvida leva o telefone nos DOIS nomes, para quem lê a linha crua. */
const DE_PARA = { nr_telefone_celular: "numero_celular" };
const VALIDAS = new Set(COLUNAS.split(","));

function normalizaColunas(pedidas) {
  const lista = String(pedidas || "")
    .split(",")
    .map((c) => DE_PARA[c.trim()] || c.trim())
    .filter((c) => VALIDAS.has(c));
  return lista.length ? [...new Set(lista)].join(",") : COLUNAS;
}

export async function linhasDoCadastro({ status = "ativo", colunas = COLUNAS } = {}) {
  const filtros = {};
  if (Array.isArray(status) && status.length) filtros.status = `in.(${status.join(",")})`;
  else if (status) filtros.status = `eq.${status}`;
  const linhas =
    (await lerTudoDP360(TABELA, {
      colunas: normalizaColunas(colunas),
      filtros,
      ordem: "nm_funcionario.asc",
    })) || [];
  return linhas.map((l) => ("numero_celular" in l ? { ...l, nr_telefone_celular: l.numero_celular } : l));
}

export async function listarFuncionarios(opcoes = {}) {
  return (await linhasDoCadastro(opcoes)).map(mapFuncionarioBCNT);
}

/** Compatibilidade com as telas antigas: os ativos. `from`/`to` não são mais necessários. */
export async function listarFuncionariosAtivos({ columns = COLUNAS } = {}) {
  return listarFuncionarios({ status: "ativo", colunas: columns });
}

/* A BUSCA POR NOME OU CRACHÁ É FEITA AQUI, NÃO NO SERVIDOR. O gateway não aceita o filtro
   "ou" do PostgREST (o valor com parênteses não passa na validação, e afrouxá-la só para
   isto abriria a porta para consulta montada na tela). Como a 046 tem ~370 ativos, a lista
   inteira cabe numa leitura: ela é guardada por 5 minutos e o que a pessoa digita filtra
   em memória — sem ida ao servidor a cada tecla. */
const VALIDADE_CACHE_MS = 5 * 60 * 1000;
let cacheAtivos = { quando: 0, linhas: null };

async function ativosEmCache() {
  if (cacheAtivos.linhas && Date.now() - cacheAtivos.quando < VALIDADE_CACHE_MS) return cacheAtivos.linhas;
  const linhas = await listarFuncionarios({ status: "ativo" });
  cacheAtivos = { quando: Date.now(), linhas };
  return linhas;
}

const semAcento = (s) => cleanText(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export async function buscarFuncionariosAtivos(termo, { limit = 10, excluirMotoristas = false } = {}) {
  const busca = semAcento(termo);
  if (busca.length < 2) return [];
  const todos = await ativosEmCache();
  return todos
    .filter((f) => f.chapa)
    .filter((f) => !excluirMotoristas || !/^motorista/i.test(f.cargo))
    .filter((f) => semAcento(f.nome).includes(busca) || f.chapa.toLowerCase().includes(busca))
    .slice(0, limit);
}

export async function buscarCargoFuncionarioAtivo(cracha) {
  const registro = cleanText(cracha);
  if (!registro) return null;
  const linhas = await lerDP360(TABELA, {
    colunas: "nr_cracha,nm_funcao,status",
    filtros: { status: "eq.ativo", nr_cracha: `eq.${registro}` },
    limite: 1,
  });
  return linhas?.[0] ? mapFuncionarioBCNT(linhas[0]) : null;
}
