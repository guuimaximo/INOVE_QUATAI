// valorHora.js — O VALOR DA HORA DO MOTORISTA, do jeito que o Python lê e grava.
//
// Mora em `app_config.valor_hora_motorista` e converte hora em dinheiro nos cartões
// "Valor gerencial" e "Potencial aberto" do Resumo. É número de dissídio: muda por acordo.
// A ferramenta desktop lê a MESMA chave (main.py `set_valor_hora`, :3814).
//
// Saiu de dentro do Resumo em 16/09/2026: a página própria do Resumo deixou o menu (ele
// vive na aba Início), e o campo que grava este valor foi para a aba Config.

export const CHAVE_VALOR_HORA = "valor_hora_motorista";

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/* Mesmo saneamento do original — tira "R$", tira o ponto de MILHAR e troca a vírgula
 * decimal —, mesma faixa (0 a 10.000, fora disso "Valor fora do razoável."). Campo vazio
 * vale 0, como no Python (`float(... or 0)`): é assim que se APAGA o valor e os cartões
 * de dinheiro somem de novo. */
export function lerValorHora(bruto) {
  const limpo = String(bruto ?? "").replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
  const v = parseFloat(limpo || "0");
  if (!Number.isFinite(v) || v < 0 || v > 10000) return { erro: "Valor fora do razoável." };
  return { valor: v };
}

// app.js `dvh`: 38.5 -> "38,5" na caixinha (o usuário digita em pt-BR).
export const horaParaCampo = (v) => (num(v) > 0 ? String(num(v)).replace(".", ",") : "");

// Quatro casas, como o `f"{v:.4f}"` do Python: quem lê do outro lado é a ferramenta
// desktop, com float() em cima do que estiver gravado.
export const valorHoraParaGravar = (v) => num(v).toFixed(4);

export const valorHoraNum = num;
