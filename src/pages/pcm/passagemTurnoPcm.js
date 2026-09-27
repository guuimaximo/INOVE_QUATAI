// PCM · PASSAGEM DE TURNO DA MANUTENÇÃO — as regras e as leituras, sem tela (27/09/2026).
//
// O "Relatório de Passagem de Turno" que a manutenção fazia no Word, agora no PCM: um
// registro por DIA e TURNO (migration 202609271200_pcm_passagem_turno.sql):
//   · pcm_passagens_turno      — o turno: responsáveis, alerta, desvios, previsto x atendido
//   · pcm_passagem_liberacoes  — o carro liberado e O QUE FOI FEITO
//   · pcm_passagem_ausencias   — quem da equipe faltou, pela chapa
// O que o sistema já sabe entra sozinho, lido ao vivo na janela do turno: os carros que o
// PCM liberou (sugestão para as liberações) e as etiquetas do SOS.
import { supabase } from "../../supabase";
import { emAberto } from "../operacional/passagemTurno";

export const TABELA_PASSAGENS = "pcm_passagens_turno";
export const TABELA_LIBERACOES = "pcm_passagem_liberacoes";
export const TABELA_AUSENCIAS = "pcm_passagem_ausencias";

/* A manutenção vira a noite: dois turnos por dia. O noturno de 26/09 é o que COMEÇA em
   26/09 às 19:00 e vai até 27/09 às 07:00. Os horários são o padrão; cada passagem guarda
   os seus (a tela deixa mudar). */
export const TURNOS = [
  { id: "DIURNO", label: "Diurno", inicio: "07:00", fim: "19:00" },
  { id: "NOTURNO", label: "Noturno", inicio: "19:00", fim: "07:00" },
];
export const turnoPorId = (id) => TURNOS.find((t) => t.id === String(id || "").toUpperCase()) || TURNOS[0];

export const MOTIVOS_AUSENCIA = ["Falta", "Atestado", "Férias", "Folga", "Afastamento", "Treinamento", "Outro"];

const isoDe = (d) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
};

/* O turno de AGORA — que é o que o botão "turno atual" abre. Antes das 07:00 ainda é o
   noturno que começou ONTEM. */
export function turnoAgora(agora = Date.now()) {
  const d = new Date(agora);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (hm >= "07:00" && hm < "19:00") return { dia: isoDe(d), turno: "DIURNO" };
  if (hm >= "19:00") return { dia: isoDe(d), turno: "NOTURNO" };
  const ontem = new Date(d);
  ontem.setDate(ontem.getDate() - 1);
  return { dia: isoDe(ontem), turno: "NOTURNO" };
}

/* A janela do turno em instantes (hora local). Fim antes do início = vira a meia-noite. */
export function janelaDoTurno(dia, inicio, fim) {
  const ini = new Date(`${dia}T${inicio || "07:00"}:00`);
  const f = new Date(`${dia}T${fim || "19:00"}:00`);
  if (f <= ini) f.setDate(f.getDate() + 1);
  return { ini, fim: f };
}

/* A JANELA DE EDIÇÃO É A DO PCM (`canEditPCM`) e a da passagem do Operacional: do começo do
   turno até as 10h do dia seguinte. O diurno de 26/09 e o noturno de 26/09 (que acaba 27/09
   às 07:00) fecham os dois em 27/09 às 10:00 — o noturno ainda tem 3 horas para terminar o
   relatório. Depois disso, só o Administrador. Turno que ainda não começou não abre. */
export function situacaoDaPassagem(dia, turno, agora = Date.now()) {
  const t = turnoPorId(turno);
  const { ini } = janelaDoTurno(dia, t.inicio, t.fim);
  if (agora < ini.getTime()) return "futuro";
  const limite = new Date(`${dia}T10:00:00`);
  limite.setDate(limite.getDate() + 1);
  return agora <= limite.getTime() ? "aberto" : "fechado";
}

export function podeEditarPassagem(dia, turno, user, agora = Date.now()) {
  const s = situacaoDaPassagem(dia, turno, agora);
  if (s === "futuro") return false;
  return s === "aberto" || String(user?.nivel ?? "").trim() === "Administrador";
}

export const prazoDaPassagem = (dia) => {
  const limite = new Date(`${dia}T10:00:00`);
  limite.setDate(limite.getDate() + 1);
  return limite;
};

/* OS CARROS QUE O PCM LIBEROU NO TURNO — sugestão para as liberações. O PCM sabe o
   defeito (`descricao`) e quem liberou; o que foi FEITO só a manutenção sabe, e é o que a
   liberação da passagem guarda. Medido em 26/09: o PCM liberou 9 carros no diurno e o
   documento da manutenção listou outros 7 — por isso a lista é sugestão, não a verdade. */
export async function lerLiberadosDoPcm(ini, fim) {
  const { data, error } = await supabase
    .from("veiculos_pcm")
    .select("id, frota, descricao, setor, categoria, observacao, liberado_por, data_saida")
    .gte("data_saida", ini.toISOString())
    .lt("data_saida", fim.toISOString())
    .order("data_saida", { ascending: true });
  if (error) throw error;
  return data || [];
}

/* AS ETIQUETAS DO SOS NO TURNO (a "gestão de etiquetas" do relatório): as que ABRIRAM na
   janela, as que a manutenção FECHOU e as que TRATOU, e a fila que passa para o próximo
   turno — em aberto pela mesma regra do Dashboard do SOS (`emAberto`) e em andamento.
   Etiqueta excluída na Central não conta. */
const COLUNAS_ETIQUETA = "id, numero_sos, data_sos, hora_sos, veiculo, reclamacao_motorista, ocorrencia, status, created_at, fechamento_em, fechamento_por_nome, tratamento_em, tratamento_por_nome";

export async function lerEtiquetasDoTurno(ini, fim) {
  const a = ini.toISOString();
  const b = fim.toISOString();
  const [abertas, fechadas, tratadas, fila] = await Promise.all([
    supabase.from("sos_acionamentos").select(COLUNAS_ETIQUETA).gte("created_at", a).lt("created_at", b).neq("status", "EXCLUIDA"),
    supabase.from("sos_acionamentos").select(COLUNAS_ETIQUETA).gte("fechamento_em", a).lt("fechamento_em", b).neq("status", "EXCLUIDA"),
    supabase.from("sos_acionamentos").select(COLUNAS_ETIQUETA).gte("tratamento_em", a).lt("tratamento_em", b).neq("status", "EXCLUIDA"),
    supabase.from("sos_acionamentos").select(COLUNAS_ETIQUETA).neq("status", "EXCLUIDA").neq("status", "Fechado")
      .order("data_sos", { ascending: true }),
  ]);
  for (const r of [abertas, fechadas, tratadas, fila]) if (r.error) throw r.error;
  const pendentes = fila.data || [];
  return {
    abertas: abertas.data || [],
    fechadas: fechadas.data || [],
    tratadas: tratadas.data || [],
    emAberto: pendentes.filter(emAberto),
    emAndamento: pendentes.filter((e) => !emAberto(e)),
  };
}

export function aderencia(previsto, atendido) {
  const p = Number(previsto);
  const a = Number(atendido);
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(a)) return null;
  return Math.round((a / p) * 100);
}
