import { useEffect, useState } from "react";
import { statusRoboDP360 } from "../../services/dp360Api";

/**
 * O VIGIA DO ROBÔ — uma leitura só, para a DP360 inteira.
 *
 * Quem pergunta "tem bot rodando?" não é uma tela: é o selo da Revisão, o aviso do topo e
 * o que vier depois. Se cada um puxasse a sua, seriam três chamadas ao GitHub a cada 20
 * segundos dizendo a mesma coisa — e o GitHub cobra isso de um teto por hora que é da
 * INSTALAÇÃO, não da tela. Então a leitura mora aqui, no módulo, e as telas assinam.
 *
 * O ritmo muda com o que está acontecendo: 20 s enquanto houver run em pé (é o intervalo
 * em que um `AJUSTADO` prematuro seria percebido) e 2 min quando não houver. E o vigia
 * DORME quando ninguém está olhando — sem assinante o timer é desarmado, para a aba
 * esquecida aberta não continuar batendo no GitHub a tarde inteira.
 *
 * Falha de leitura devolve lista VAZIA em vez de erro, de propósito: sem o GitHub a tela
 * volta a contar só o que o nosso banco sabe, que é o comportamento de antes desta
 * leitura existir. Ficar vermelho porque a consulta caiu seria acusar o robô do defeito
 * da consulta.
 */
const JANELA_HORAS = 6;
const RITMO_ATIVO = 20000;
const RITMO_PARADO = 120000;

const assinantes = new Set();
let runs = [];
let timer = null;
let lendo = false;

export function rodando(lista) {
  return (lista || []).filter((r) => String(r.status || "") !== "completed");
}

function avisar() {
  for (const f of assinantes) f(runs);
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
  avisar();
  agendar();
}

function agendar() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!assinantes.size) return; // ninguém olhando: o vigia dorme
  timer = setTimeout(ler, rodando(runs).length ? RITMO_ATIVO : RITMO_PARADO);
}

/** A lista de runs recentes, viva. Devolve o que já está em mãos na primeira pintura. */
export function useVigiaDoRobo() {
  const [lista, setLista] = useState(runs);

  useEffect(() => {
    assinantes.add(setLista);
    // Quem chega encontra a leitura em curso ou o resultado da anterior; só dispara uma
    // nova se o vigia estava dormindo.
    if (!timer && !lendo) ler();
    return () => {
      assinantes.delete(setLista);
      agendar();
    };
  }, []);

  return lista;
}
