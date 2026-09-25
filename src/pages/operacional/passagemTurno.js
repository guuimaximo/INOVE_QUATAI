// OPERACIONAL · PASSAGEM DE TURNO — as regras e as leituras, sem tela (25/09/2026).
//
// O "Fechamento de Turno" do plantão (a planilha verde), agora no INOVE: um registro por
// DIA, como o PCM, alimentado durante o dia. Tabelas (migration
// 202609251600_operacional_passagem_turno.sql):
//   · operacional_turnos           — o dia e os números do turno
//   · operacional_faltas           — falta de manhã/tarde, pela chapa, com o substituto
//   · operacional_intercorrencias  — o texto do plantão e as CHAPAS dos motoristas citados
//
// POR QUE A CHAPA É O CENTRO: dono, 25/09/2026 — "intercorrências têm que gravar a chapa
// do motorista, porque o DP360 vai precisar trazer a observação". Exemplo dele:
// "30060914 trouxe o veículo 222214 para a garagem porque o 30060916 passou mal" — é
// informação de DOIS motoristas, e ela subsidia a análise do ponto dos dois. O cartão
// do dia do DP360 lê `lerPlantaoDoMotorista` por chapa e dia.
import { supabase } from "../../supabase";

export const TABELA_TURNOS = "operacional_turnos";
export const TABELA_FALTAS = "operacional_faltas";
export const TABELA_INTERCORRENCIAS = "operacional_intercorrencias";

export const PERIODOS = [
  { id: "MANHA", label: "Manhã" },
  { id: "TARDE", label: "Tarde" },
];

/* Chapa só com dígitos e sem zero à esquerda: "03602042" e "3602042" são a mesma pessoa
   (as bases do ponto divergem no zero). É assim que ela é GRAVADA e assim que é BUSCADA. */
export function normChapa(v) {
  return String(v ?? "").replace(/\D/g, "").replace(/^0+/, "");
}

/* As chapas citadas num texto do plantão: números de 7 ou 8 dígitos ("30060914",
   "3602042"). Seis dígitos é prefixo de carro ("222214"), não chapa. Linha ("03TR.03")
   não casa porque tem letra. */
export function chapasNoTexto(texto) {
  const achadas = String(texto ?? "").match(/(?<![\d.])\d{7,8}(?![\d.])/g) || [];
  return [...new Set(achadas.map(normChapa).filter(Boolean))];
}

/* O carro citado: o primeiro número de 6 dígitos ("222214"). Só sugere — o campo é do
   plantão. */
export function veiculoNoTexto(texto) {
  const m = String(texto ?? "").match(/(?<![\d.])\d{6}(?![\d.])/);
  return m ? m[0] : "";
}

// NUNCA `new Date().toISOString()` para data LOCAL (playbook §3): depois das 21h BRT ele
// devolve o dia SEGUINTE.
export function isoLocal(d = new Date()) {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
}

export function somaDias(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}

export function dataBR(iso) {
  const s = String(iso ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—";
}

export function dataPorExtenso(iso) {
  const s = String(iso ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

/* A MESMA JANELA DE EDIÇÃO DO PCM (`canEditPCM`): o dia se edita até as 10h do dia
   seguinte — o plantão da noite ainda fecha o que ficou. Depois disso, só Administrador
   (o DP pode precisar corrigir uma chapa dias depois, na análise do ponto). */
export function podeEditarDia(dataIso, user) {
  if (String(user?.nivel ?? "").trim() === "Administrador") return true;
  const s = String(dataIso ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const limite = new Date(`${s}T10:00:00`);
  limite.setDate(limite.getDate() + 1);
  return Date.now() <= limite.getTime();
}

export function quemEsta(user) {
  return String(user?.nome || user?.nome_completo || user?.login || user?.email || "").trim() || "—";
}

/* O cadastro de motoristas do INOVE (`motoristas`: chapa, nome, cargo — 377 em
   25/09/2026). Uma leitura por tela; o mapa é por chapa normalizada. */
export async function lerMotoristas() {
  const { data, error } = await supabase.from("motoristas").select("chapa, nome, cargo");
  if (error) throw error;
  const mapa = new Map();
  for (const m of data || []) {
    const c = normChapa(m.chapa);
    if (c) mapa.set(c, { chapa: c, nome: String(m.nome ?? "").trim(), cargo: String(m.cargo ?? "").trim() });
  }
  return mapa;
}

/* ── AS OCORRÊNCIAS DO DIA, DO MÓDULO DE SOS (25/09/2026) ──────────────────────
   Dono: "vamos colocar as ocorrências do dia: SOS, avaria, troca, recolha, seguiu viagem,
   assalto — se tiver avarias, traz quais foram, linha a linha". As cinco primeiras são a
   `ocorrencia` do acionamento em `sos_acionamentos` (medido em setembro: SOS 54, AVARIA
   17, TROCA 22, RECOLHEU 56, SEGUIU VIAGEM 126 e 15 sem classificação). Acionamento sem
   classificação aparece à parte — não some, nem vira SOS. Assalto não tem módulo: é
   digitado no turno. */
export const TIPOS_OCORRENCIA = [
  { id: "sos", label: "SOS", valores: ["SOS"], cor: "#dc2626" },
  { id: "avaria", label: "Avaria", valores: ["AVARIA"], cor: "#ea580c" },
  { id: "troca", label: "Troca", valores: ["TROCA"], cor: "#d97706" },
  { id: "recolha", label: "Recolha", valores: ["RECOLHEU", "RECOLHA"], cor: "#475569" },
  { id: "seguiu_viagem", label: "Seguiu viagem", valores: ["SEGUIU VIAGEM"], cor: "#059669" },
];

const COLUNAS_SOS = "id, numero_sos, data_sos, hora_sos, veiculo, linha, tabela_operacional, motorista_id, motorista_nome, reclamacao_motorista, problema_encontrado, local_ocorrencia, ocorrencia, status";

export function tipoDaOcorrencia(ocorrencia) {
  const o = String(ocorrencia ?? "").trim().toUpperCase();
  return TIPOS_OCORRENCIA.find((t) => t.valores.includes(o))?.id || "sem_classificacao";
}

export async function lerOcorrenciasDoDia(dia) {
  const { data, error } = await supabase
    .from("sos_acionamentos")
    .select(COLUNAS_SOS)
    .eq("data_sos", dia)
    .order("hora_sos", { ascending: true });
  if (error) throw error;
  const porTipo = { sem_classificacao: [] };
  TIPOS_OCORRENCIA.forEach((t) => { porTipo[t.id] = []; });
  (data || []).forEach((a) => porTipo[tipoDaOcorrencia(a.ocorrencia)].push(a));
  const contagem = Object.fromEntries(Object.entries(porTipo).map(([k, v]) => [k, v.length]));
  return { porTipo, contagem, total: (data || []).length };
}

/* ── A FROTA PARADA, DO PCM DO DIA ─────────────────────────────────────────────
   Dono: "GNS pega do PCM, faixa amarela também". Os carros do PCM do dia nessas duas
   categorias que ainda não saíram (`data_saida` nulo) — o retrato que o painel do PCM
   mostra. Vem com o prefixo e a descrição, para o fechamento dizer QUAIS carros. */
export async function lerFrotaParadaDoDia(dia) {
  const vazio = { gns: [], faixa_amarela: [], temPcm: false };
  const pcm = await supabase.from("pcm_diario").select("id").eq("data_referencia", dia).maybeSingle();
  if (pcm.error) throw pcm.error;
  if (!pcm.data?.id) return vazio;
  const { data, error } = await supabase
    .from("veiculos_pcm")
    .select("frota, descricao, setor, categoria, data_entrada")
    .eq("pcm_id", pcm.data.id)
    .is("data_saida", null)
    .in("categoria", ["GNS", "FAIXA_AMARELA"])
    .order("frota", { ascending: true });
  if (error) throw error;
  const lista = data || [];
  return {
    gns: lista.filter((v) => String(v.categoria).toUpperCase() === "GNS"),
    faixa_amarela: lista.filter((v) => String(v.categoria).toUpperCase() === "FAIXA_AMARELA"),
    temPcm: true,
  };
}

/* Reservas manhã/tarde: o Controle de Reservas do dia, pela hora de entrada (antes do
   meio-dia = manhã). Só uma SUGESTÃO para o plantão — reserva de verdade é quem ficou à
   disposição, e isso o plantão confirma. */
export async function lerReservasDoDia(dia) {
  const { data, error } = await supabase.from("reservas_motoristas").select("hora_entrada").eq("data_referencia", dia);
  if (error) throw error;
  const horas = (data || []).map((r) => String(r.hora_entrada ?? "").slice(0, 5));
  return {
    reservas_manha: horas.filter((h) => h && h < "12:00").length,
    reservas_tarde: horas.filter((h) => h && h >= "12:00").length,
  };
}

/* O retrato que o turno guarda (a lista dos dias lê daqui, sem ler SOS e PCM de novo). */
export function retratoDoSistema(ocorrencias, frota) {
  const r = {};
  if (ocorrencias) {
    TIPOS_OCORRENCIA.forEach((t) => { r[t.id] = ocorrencias.contagem[t.id] || 0; });
    r.sem_classificacao = ocorrencias.contagem.sem_classificacao || 0;
  }
  if (frota?.temPcm) {
    r.gns = frota.gns.length;
    r.faixa_amarela = frota.faixa_amarela.length;
  }
  return r;
}

/* ── PARA O DP360 ────────────────────────────────────────────────────────────────
   O que o plantão registrou sobre UM motorista num dia: as faltas (dele, ou em que ele
   foi o substituto) e as intercorrências que citam a chapa dele. Degrada calado: sem
   tabela ou sem permissão, devolve vazio e o cartão do ponto segue. */
export async function lerPlantaoDoMotorista(cracha, dia) {
  const chapa = normChapa(cracha);
  const d = String(dia ?? "").slice(0, 10);
  if (!chapa || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { faltas: [], intercorrencias: [] };
  try {
    const [faltas, inter] = await Promise.all([
      supabase
        .from(TABELA_FALTAS)
        .select("id, periodo, chapa, operador, linha, substituto_chapa, substituto_nome, substituto_linha, observacao, criado_por, criado_em")
        .eq("data_referencia", d)
        .or(`chapa.eq.${chapa},substituto_chapa.eq.${chapa}`),
      supabase
        .from(TABELA_INTERCORRENCIAS)
        .select("id, periodo, hora, veiculo, texto, chapas, criado_por, criado_em")
        .eq("data_referencia", d)
        .contains("chapas", [chapa])
        .order("criado_em", { ascending: true }),
    ]);
    return {
      faltas: faltas.error ? [] : faltas.data || [],
      intercorrencias: inter.error ? [] : inter.data || [],
    };
  } catch {
    return { faltas: [], intercorrencias: [] };
  }
}
