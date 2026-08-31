import { supabase } from "../supabase";

export async function carregarResumoDP360() {
  const { data, error } = await supabase.functions.invoke("dp360-api", {
    body: { action: "overview" },
  });

  if (error) throw new Error(error.message || "Não foi possível consultar a base DP360.");
  if (!data?.ok) throw new Error(data?.error || "Não foi possível consultar a base DP360.");
  return data;
}

export async function carregarRefeicaoDP360() {
  const { data, error } = await supabase.functions.invoke("dp360-api", {
    body: { action: "refeicao" },
  });

  if (error) throw new Error(error.message || "Não foi possível consultar a refeição.");
  if (!data?.ok) throw new Error(data?.error || "Não foi possível consultar a refeição.");
  return data;
}
