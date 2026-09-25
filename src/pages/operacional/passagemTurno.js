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
import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import { lerDP360, lerTudoDP360 } from "../../services/dp360Api";

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

/* A JANELA DO DIA (dono, 25/09/2026: "a passagem do dia 25/09 fica disponível até as 10h
   do dia 26/09, e a partir da 00:00 já pode abrir o dia novo 26/09"). A mesma do PCM
   (`canEditPCM`): o plantão da noite ainda fecha o que ficou. Três situações:
     · futuro  — o dia ainda não começou (só abre à 00:00 dele);
     · aberto  — da 00:00 do dia até as 10h do dia seguinte;
     · fechado — depois disso, somente leitura. Só o Administrador altera (o DP pode
                 precisar corrigir uma chapa dias depois, na análise do ponto).
   `agora` vem do relógio da tela, para ela travar e virar o dia sem recarregar. */
export function prazoDoDia(dataIso) {
  const limite = new Date(`${String(dataIso ?? "").slice(0, 10)}T10:00:00`);
  limite.setDate(limite.getDate() + 1);
  return limite;
}

export function situacaoDoDia(dataIso, agora = Date.now()) {
  const s = String(dataIso ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "fechado";
  if (s > isoLocal(new Date(agora))) return "futuro";
  return agora <= prazoDoDia(s).getTime() ? "aberto" : "fechado";
}

export function podeEditarDia(dataIso, user, agora = Date.now()) {
  const situacao = situacaoDoDia(dataIso, agora);
  if (situacao === "futuro") return false;
  return situacao === "aberto" || String(user?.nivel ?? "").trim() === "Administrador";
}

/* O relógio da tela: o plantão deixa a Passagem aberta a noite toda. Sem ele, o botão do
   dia novo não aparecia à 00:00 e o dia seguia editável depois das 10h até alguém
   recarregar a página. */
export function useRelogio(intervaloMs = 30000) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => window.clearInterval(t);
  }, [intervaloMs]);
  return agora;
}

export function quemEsta(user) {
  return String(user?.nome || user?.nome_completo || user?.login || user?.email || "").trim() || "—";
}

/* OS NOMES VÊM DO CADASTRO DE FUNCIONÁRIOS — o mesmo de Pessoas, Controle de Reservas, SOS,
   Checklists e Diesel (`utils/funcionariosBCNT.js`: tabela `funcionarios` da base de
   importação, pelo gateway). Nasceu lendo a tabela `motoristas` do INOVE, que parou em
   abril de 2026: em 25/09 faltavam nela 30 motoristas ativos, todos contratados desde 13/04,
   e o fechamento de 24/09 saiu com chapa sem nome (dono: "ajusta para pegar da tabela onde
   todos pegam"). Vem a base inteira — ativo, afastado e inativo — para o nome aparecer
   também no dia antigo de quem já saiu; chapa repetida fica com o registro ativo. */
const PESO_STATUS = { ativo: 0, afastado: 1 };
const pesoDoStatus = (s) => PESO_STATUS[String(s ?? "").trim().toLowerCase()] ?? 2;

function nomesPorChapa(linhas) {
  const mapa = new Map();
  for (const l of linhas || []) {
    const c = normChapa(l.nr_cracha);
    if (!c) continue;
    const peso = pesoDoStatus(l.status);
    if (mapa.has(c) && mapa.get(c).peso <= peso) continue;
    mapa.set(c, { chapa: c, nome: String(l.nm_funcionario ?? "").trim(), cargo: String(l.nm_funcao ?? "").trim(), peso });
  }
  return mapa;
}

/* A MESMA TABELA do `linhasDoCadastro`, mas lida direto: a base inteira passa de 1000
   linhas (1.468 em 25/09/2026) e vem em duas páginas, e a ordem por NOME dele não é estável
   entre páginas — dois homônimos na virada podiam sumir ou repetir. `id_funcionario` é
   único. */
export async function lerMotoristas() {
  return nomesPorChapa(
    await lerTudoDP360("funcionarios", {
      colunas: "id_funcionario,nr_cracha,nm_funcionario,nm_funcao,status",
      ordem: "id_funcionario.asc",
    }),
  );
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

/* ETIQUETA EM ABERTO (dono, 25/09/2026: "só a quantidade de etiquetas em aberto naquele
   dia"). A MESMA regra do card "Etiquetas em aberto" do Dashboard do SOS
   (SOSDashboard.jsx `abertas`): status "Aberto" OU ocorrência ainda não preenchida. Regra
   própria aqui faria o fechamento e o dashboard darem números diferentes para a mesma
   pergunta. A ocorrência só é preenchida no fechamento — os 15 "sem classificação" de
   setembro eram todos Abertos. */
export function emAberto(acionamento) {
  return String(acionamento?.status ?? "").trim().toLowerCase() === "aberto" || !acionamento?.ocorrencia;
}

export async function lerOcorrenciasDoDia(dia) {
  const { data, error } = await supabase
    .from("sos_acionamentos")
    .select(COLUNAS_SOS)
    .eq("data_sos", dia)
    .neq("status", "EXCLUIDA") // etiqueta excluída na Central não é ocorrência do dia
    .order("hora_sos", { ascending: true });
  if (error) throw error;
  const porTipo = { sem_classificacao: [] };
  TIPOS_OCORRENCIA.forEach((t) => { porTipo[t.id] = []; });
  (data || []).forEach((a) => porTipo[tipoDaOcorrencia(a.ocorrencia)].push(a));
  const contagem = Object.fromEntries(Object.entries(porTipo).map(([k, v]) => [k, v.length]));
  const abertos = (data || []).filter(emAberto);
  contagem.em_aberto = abertos.length;
  return { porTipo, contagem, abertos, total: (data || []).length };
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

/* ── AS RESERVAS DO DIA, DO CONTROLE DE RESERVAS ──────────────────────────────────
   Uma leitura serve para duas coisas: os números "Reservas manhã/tarde" (só uma SUGESTÃO
   para o plantão, que confirma) e a lista de quem FICOU NA RESERVA. O período é pela hora
   de entrada: antes do meio-dia é manhã (as reservas da tarde entram 12:30 ou depois). */
export async function lerReservistasDoDia(dia) {
  const { data, error } = await supabase
    .from("reservas_motoristas")
    .select("id, funcionario_cracha, funcionario_nome, hora_entrada, hora_saida, cobertura, observacao")
    .eq("data_referencia", dia)
    .order("hora_entrada", { ascending: true });
  if (error) throw error;
  return (data || []).map((r) => {
    const entrada = String(r.hora_entrada ?? "").slice(0, 5);
    return {
      id: r.id,
      chapa: normChapa(r.funcionario_cracha),
      nome: String(r.funcionario_nome ?? "").trim(),
      entrada,
      saida: String(r.hora_saida ?? "").slice(0, 5),
      periodo: entrada ? (entrada < "12:00" ? "MANHA" : "TARDE") : "",
      cobertura: String(r.cobertura ?? "").trim(),
      observacao: String(r.observacao ?? "").trim(),
    };
  });
}

export function contarReservas(lista) {
  return {
    reservas_manha: (lista || []).filter((r) => r.periodo === "MANHA").length,
    reservas_tarde: (lista || []).filter((r) => r.periodo === "TARDE").length,
  };
}

/* QUEM SUBSTITUIU (dono, 25/09/2026: "os motoristas que ficarem em reserva e não
   substituírem não aparecem — puxa do Controle de Reservas"). Quem substituiu já aparecia
   nas faltas, como substituto; quem ficou à disposição sem assumir nada sumia do fechamento.
   Substituir é assumir uma TABELA, e no Controle de Reservas ela vai no campo "Onde/o que
   cobriu": medido em 25/09/2026, 116 dos 118 preenchidos são tabela ("19TR.5A", "04TR 08A",
   "19VP3A", "34TR"). Os outros dois são texto — "Ajudou em 2 SOS.", "Reserva de apoio no
   terminal tereza" — e o campo vazio (48) é quem ficou na garagem: esses NÃO substituíram.
   Também conta quem o plantão lançou como substituto de uma falta do dia, mesmo sem a
   tabela no Controle. */
const TABELA_NA_COBERTURA = /\d{1,2}\s*(TR|VP)/i;

export function reservaSubstituiu(reserva, faltas = []) {
  if (TABELA_NA_COBERTURA.test(String(reserva?.cobertura ?? ""))) return true;
  const chapa = normChapa(reserva?.chapa);
  return !!chapa && (faltas || []).some((f) => normChapa(f.substituto_chapa) === chapa);
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
   TUDO o que a passagem de turno tem sobre UM motorista num dia (dono, 25/09/2026:
   "todas as observações da passagem de turno do motorista precisam aparecer no DP360"):
     · faltas    — a dele, ou a de alguém que ele substituiu;
     · intercorrências que citam a chapa dele (e os nomes dos outros citados);
     · anotações — as linhas das "Observações do turno" e dos "Malotes" que citam a chapa;
     · sos       — os acionamentos do SOS com ele no dia (as ocorrências que o fechamento
                   mostra; etiqueta excluída não conta).
   `temTurno` diz se houve passagem lançada no dia — "nada sobre ele" e "não houve
   passagem" são coisas diferentes para quem analisa o ponto. Degrada calado: sem tabela
   ou sem permissão, cada parte volta vazia e o cartão do ponto segue. */
const PLANTAO_VAZIO = { temTurno: false, faltas: [], intercorrencias: [], anotacoes: [], sos: [], nomes: {} };

function linhasQueCitam(texto, chapa) {
  return String(texto ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && chapasNoTexto(l).includes(chapa));
}

export async function lerPlantaoDoMotorista(cracha, dia) {
  const chapa = normChapa(cracha);
  const d = String(dia ?? "").slice(0, 10);
  if (!chapa || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return PLANTAO_VAZIO;
  const dados = (r) => (r.status === "fulfilled" && !r.value?.error ? r.value.data : null);
  try {
    const [turno, faltas, inter, sos] = await Promise.allSettled([
      supabase.from(TABELA_TURNOS).select("id, observacoes, malotes").eq("data_referencia", d).maybeSingle(),
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
        .order("hora", { ascending: true, nullsFirst: true }),
      // o SOS guarda a chapa com ou sem o zero da frente ("03602042" e "3602042")
      supabase
        .from("sos_acionamentos")
        .select(COLUNAS_SOS)
        .eq("data_sos", d)
        .in("motorista_id", [chapa, `0${chapa}`])
        .neq("status", "EXCLUIDA")
        .order("hora_sos", { ascending: true }),
    ]);
    const t = dados(turno);
    const intercorrencias = dados(inter) || [];
    const anotacoes = t
      ? [
        ...linhasQueCitam(t.observacoes, chapa).map((texto) => ({ tipo: "observacao", texto })),
        ...linhasQueCitam(t.malotes, chapa).map((texto) => ({ tipo: "malote", texto })),
      ]
      : [];
    // os nomes dos OUTROS motoristas citados nas intercorrências (quem analisa o ponto
    // quer saber quem é o "30060916" do texto sem abrir outra tela)
    const outros = [...new Set(intercorrencias.flatMap((i) => i.chapas || []))].filter((c) => c && c !== chapa);
    // (o cadastro guarda a chapa com ou sem o zero da frente: "03602042")
    const nomes = {};
    if (outros.length) {
      const linhas = await lerDP360("funcionarios", {
        colunas: "nr_cracha,nm_funcionario,status",
        filtros: { nr_cracha: `in.(${outros.flatMap((c) => [c, `0${c}`]).join(",")})` },
        limite: 100,
      }).catch(() => []);
      nomesPorChapa(linhas).forEach((m, c) => { nomes[c] = m.nome; });
    }
    return {
      temTurno: !!t,
      faltas: dados(faltas) || [],
      intercorrencias,
      anotacoes,
      sos: dados(sos) || [],
      nomes,
    };
  } catch {
    return PLANTAO_VAZIO;
  }
}
