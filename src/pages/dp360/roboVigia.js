import { useEffect, useState } from "react";
import { EVENTO_ROBO_DISPARADO, statusRoboDP360 } from "../../services/dp360Api";

/**
 * O VIGIA DO ROBÔ — uma leitura só, para a DP360 inteira.
 *
 * Quem pergunta "tem bot rodando?" não é uma tela: é o selo da Revisão, o aviso do topo, a
 * leitura do relatório das Folgas. Se cada um puxasse a sua, seriam três chamadas ao
 * GitHub a cada 20 segundos dizendo a mesma coisa — e o GitHub cobra isso de um teto por
 * hora que é da INSTALAÇÃO, não da tela. Então a leitura mora aqui, no módulo, e as telas
 * assinam.
 *
 * O RITMO SEGUE O QUE ESTÁ ACONTECENDO, e o caso que importa é o do disparo. O dono
 * disparou e o topo continuou dizendo "robô parado": o vigia estava no ritmo de descanso,
 * e a próxima leitura só viria dois minutos depois. Quem acabou de mandar o robô não espera
 * dois minutos para saber se ele foi. Então todo disparo ACORDA o vigia — ele lê na hora e
 * fica em ritmo curto por três minutos, porque o GitHub leva alguns segundos para registrar
 * o run recém-criado e uma leitura só, imediata, costuma chegar cedo demais.
 *
 * O aviso vem por evento do `dp360Api`, e não por chamada de cada tela: assim vale para
 * TODOS os disparos — Revisão, Folgas, Refeição, Ocorrências — sem depender de alguém
 * lembrar de avisar, e sem o serviço ter de importar este módulo (o contrário já existe).
 *
 * E o vigia DORME quando ninguém está olhando — sem assinante o timer é desarmado, para a
 * aba esquecida aberta não continuar batendo no GitHub a tarde inteira.
 *
 * Falha de leitura devolve lista VAZIA em vez de erro, de propósito: sem o GitHub a tela
 * volta a contar só o que o nosso banco sabe, que é o comportamento de antes desta leitura
 * existir. Ficar vermelho porque a consulta caiu seria acusar o robô do defeito da consulta.
 */
const JANELA_HORAS = 6;
const RITMO_ATIVO = 20000;
const RITMO_ESPERA = 8000;
const RITMO_PARADO = 120000;
const ESPERA_MS = 3 * 60000;

const assinantes = new Set();
let runs = [];
let esperando = false;
let esperandoAte = 0;
let timer = null;
let lendo = false;

export function rodando(lista) {
  return (lista || []).filter((r) => String(r.status || "") !== "completed");
}

function avisar() {
  const estado = { runs, esperando };
  for (const f of assinantes) f(estado);
}

async function ler() {
  if (lendo) return;
  lendo = true;
  try {
    runs = await statusRoboDP360(JANELA_HORAS);
  } catch {
    runs = [];
  } finally {
    lendo = false;
  }
  // A espera acaba sozinha quando o run aparece: ele é o que ela estava esperando.
  if (esperando && rodando(runs).length) esperandoAte = 0;
  esperando = Date.now() < esperandoAte;
  avisar();
  agendar();
}

function agendar() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!assinantes.size) return; // ninguém olhando: o vigia dorme
  const emEspera = Date.now() < esperandoAte;
  const ritmo = rodando(runs).length ? RITMO_ATIVO : emEspera ? RITMO_ESPERA : RITMO_PARADO;
  timer = setTimeout(ler, ritmo);
}

/** Alguém acabou de mandar um robô: lê agora e fica de olho curto por uns minutos. */
function acordar() {
  esperandoAte = Date.now() + ESPERA_MS;
  esperando = true;
  avisar(); // o topo já muda para "esperando o robô" antes mesmo da leitura voltar
  if (assinantes.size) ler();
}

if (typeof window !== "undefined") {
  window.addEventListener(EVENTO_ROBO_DISPARADO, acordar);
}

/**
 * `{ runs, esperando }`, vivo. `esperando` é o intervalo entre o disparo e o run aparecer
 * no GitHub — nem parado nem rodando, e dizer qualquer um dos dois ali seria mentira.
 */
export function useRoboDP360() {
  const [estado, setEstado] = useState(() => ({ runs, esperando }));

  useEffect(() => {
    assinantes.add(setEstado);
    // Quem chega encontra a leitura em curso ou o resultado da anterior; só dispara uma
    // nova se o vigia estava dormindo.
    if (!timer && !lendo) ler();
    return () => {
      assinantes.delete(setEstado);
      agendar();
    };
  }, []);

  return estado;
}

/** Só a lista, para quem não se importa com o intervalo do disparo. */
export function useVigiaDoRobo() {
  return useRoboDP360().runs;
}
