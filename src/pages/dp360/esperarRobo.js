// esperarRobo.js — ESPERAR O RUN DO ROBÔ TERMINAR ANTES DE DAR O TRABALHO POR FEITO.
//
// O GitHub ACEITAR o disparo não quer dizer que o robô fez o trabalho. Em 16/09/2026 quatro
// avisos de 09/09 (17 pessoas) foram aceitos e morreram no primeiro passo do workflow, antes
// de abrir o Transnet — e a Revisão já tinha gravado os 17 como AVISADOS, com o prazo de
// 48 h correndo para uma mensagem que ninguém recebeu. Daí viria advertência.
//
// Quem marca "avisado" ou "advertido" espera aqui e só grava quando o run não FALHOU.
import { statusRoboDP360 } from "../../services/dp360Api";

const txt = (v) => String(v ?? "").trim();

export const ESPERA_PASSO_MS = 15000;
export const ESPERA_MAX_MIN = 14;

/**
 * Espera o run terminar e devolve a conclusão do GitHub ("success", "failure"...), ou
 * "tempo_esgotado" quando passou do limite. `dizendo` recebe "na fila do GitHub" /
 * "rodando no Transnet" só quando o estado muda.
 *
 * O ID DO RUN NEM SEMPRE VEM. O gateway casa o disparo com a execução logo depois do
 * dispatch, e o run pode não ter nascido ainda ("nao_encontrado") ou dois caírem na mesma
 * janela ("ambiguo"). O plano B é o que uma pessoa faria: olhar o run DAQUELE robô que
 * começou depois do clique (`desde`).
 */
export async function esperarRunDoRobo({ runId, robo, desde }, dizendo) {
  const limite = Date.now() + ESPERA_MAX_MIN * 60000;
  let visto = "";
  while (Date.now() < limite) {
    await new Promise((r) => setTimeout(r, ESPERA_PASSO_MS));
    let runs = [];
    try {
      runs = await statusRoboDP360(2);
    } catch {
      continue; // falha de leitura não é falha do run: tenta de novo
    }
    const meu = runId
      ? (runs || []).find((x) => String(x.id) === String(runId))
      : (runs || [])
          .filter(
            (x) =>
              txt(x.nome).toLowerCase().includes(txt(robo).toLowerCase()) &&
              Date.parse(txt(x.comecou_em)) >= (desde || 0) - 60000,
          )
          .sort((a, b) => Date.parse(txt(b.comecou_em)) - Date.parse(txt(a.comecou_em)))[0];
    if (!meu) continue;
    if (txt(meu.status) !== "completed") {
      if (txt(meu.status) !== visto) {
        visto = txt(meu.status);
        dizendo?.(visto === "queued" ? "na fila do GitHub" : "rodando no Transnet");
      }
      continue;
    }
    return txt(meu.conclusao) || "sem_conclusao";
  }
  return "tempo_esgotado";
}

// o run ACABOU e não fez o trabalho — o que ele ia gravar não aconteceu
const NAO_FEZ = new Set(["failure", "cancelled", "timed_out", "startup_failure", "action_required", "skipped", "stale"]);

/** O run terminou sem fazer o trabalho: nada do que ele ia fazer pode ser gravado como feito. */
export const runNaoFez = (fim) => NAO_FEZ.has(txt(fim));

/** Não deu para saber o fim (passou do tempo, ou o GitHub não disse a conclusão). */
export const runIncerto = (fim) => txt(fim) !== "success" && !runNaoFez(fim);
