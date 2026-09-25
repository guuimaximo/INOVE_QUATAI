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

/* ── O QUE O SISTEMA JÁ SABE DO DIA ─────────────────────────────────────────────
   Dono: "boa parte, como SOS e GNS, nós já temos". A tela oferece "puxar do sistema" e o
   plantão confirma — o número gravado é o do fechamento, não uma consulta viva.
   · SOS / Troca / Avaria: `sos_acionamentos` do dia pela `ocorrencia` (medido em
     setembro: SEGUIU VIAGEM, RECOLHEU, SOS, TROCA, AVARIA e vazio). Troca e Avaria têm
     linha própria no fechamento; o resto é SOS.
   · GNS / Faixa amarela: os carros do PCM do dia nessas categorias, que ainda não saíram
     (o retrato do momento em que o plantão puxa — por isso o botão, e não conta viva).
   · Reservas manhã/tarde: o Controle de Reservas do dia, pela hora de entrada (antes do
     meio-dia = manhã). */
export async function numerosDoSistema(dia) {
  const out = {};
  const [sos, pcm, reservas] = await Promise.all([
    supabase.from("sos_acionamentos").select("ocorrencia").eq("data_sos", dia),
    supabase.from("pcm_diario").select("id").eq("data_referencia", dia).maybeSingle(),
    supabase.from("reservas_motoristas").select("hora_entrada").eq("data_referencia", dia),
  ]);
  if (!sos.error) {
    const tipos = (sos.data || []).map((r) => String(r.ocorrencia ?? "").trim().toUpperCase());
    out.troca = tipos.filter((t) => t === "TROCA").length;
    out.avaria = tipos.filter((t) => t === "AVARIA").length;
    out.sos = tipos.length - out.troca - out.avaria;
  }
  if (!pcm.error && pcm.data?.id) {
    const { data, error } = await supabase
      .from("veiculos_pcm")
      .select("categoria")
      .eq("pcm_id", pcm.data.id)
      .is("data_saida", null); // os que ESTÃO parados agora, como no painel do PCM
    if (!error) {
      const cats = (data || []).map((v) => String(v.categoria ?? "").toUpperCase());
      out.gns = cats.filter((c) => c === "GNS").length;
      out.faixa_amarela = cats.filter((c) => c === "FAIXA_AMARELA").length;
    }
  }
  if (!reservas.error) {
    const horas = (reservas.data || []).map((r) => String(r.hora_entrada ?? "").slice(0, 5));
    out.reservas_manha = horas.filter((h) => h && h < "12:00").length;
    out.reservas_tarde = horas.filter((h) => h && h >= "12:00").length;
  }
  return out;
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
