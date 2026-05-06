import { supabaseBCNT } from "../supabaseBCNT";

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
    telefone: cleanText(row?.nr_telefone_celular),
    dtInicioAtividade: row?.dt_inicio_atividade || null,
  };
}

export async function listarFuncionariosAtivos({
  from = 0,
  to = 999,
  columns = "id_funcionario, nr_cracha, nm_funcionario, nm_funcao, nr_telefone_celular, dt_inicio_atividade, status",
} = {}) {
  const { data, error } = await supabaseBCNT
    .from("funcionarios_atualizada")
    .select(columns)
    .eq("status", "ativo")
    .range(from, to);

  if (error) throw error;
  return (data || []).map(mapFuncionarioBCNT);
}

export async function buscarFuncionariosAtivos(termo, { limit = 10, excluirMotoristas = false } = {}) {
  const busca = cleanText(termo);
  if (busca.length < 2) return [];

  let query = supabaseBCNT
    .from("funcionarios_atualizada")
    .select("id_funcionario, nr_cracha, nm_funcionario, nm_funcao, status")
    .eq("status", "ativo")
    .not("nr_cracha", "is", null)
    .or(`nm_funcionario.ilike.%${busca}%,nr_cracha.ilike.%${busca}%`)
    .order("nm_funcionario", { ascending: true })
    .limit(limit);

  if (excluirMotoristas) {
    query = query.not("nm_funcao", "ilike", "MOTORISTA%");
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapFuncionarioBCNT);
}

export async function buscarCargoFuncionarioAtivo(cracha) {
  const registro = cleanText(cracha);
  if (!registro) return null;

  const { data, error } = await supabaseBCNT
    .from("funcionarios_atualizada")
    .select("nr_cracha, nm_funcao, status")
    .eq("status", "ativo")
    .eq("nr_cracha", registro)
    .maybeSingle();

  if (error) throw error;
  return data ? mapFuncionarioBCNT(data) : null;
}
