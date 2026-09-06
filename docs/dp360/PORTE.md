# Porte do DP360 para dentro do INOVE — mapa de decisão

Levantado lendo o app atual (`Sistemas/PONTO`: `app/main.py` ~6.9k linhas,
`app/ui/app.js`, `ferramenta/`, `importador_supabase/sql_catalogo/`).
Objetivo final: o DP rodar 100% no INOVE para então **revogar a chave anon** da
base de importação (hoje ela lê E grava dados de ponto/RH com a anon pública).

---

## 1. Achado que muda o plano: a regra NÃO está no Python

A decisão de negócio do ponto vive em **views do Athena**, não no app:

- `sql_catalogo/3_vw_ponto_revisao_motorista.sql` (~1.620 linhas) e
  `4_vw_ponto_revisao_interno.sql` calculam `status_ponto`, `motivo`,
  `acao_sugerida`, `alvo_*`, `*_sug`, `almoco_*`, `classificacao`, `dsr_auto`.
- O resultado é importado para a tabela `ponto_diario` (e irmãs).
- O `main.py` **repassa** esse contrato e aplica só travas e sobreposições
  manuais (comentário explícito em `main.py:7079-7082`).

**Consequência boa:** o INOVE **não precisa reimplementar as regras**. Ele lê o
resultado já calculado. O porte é de **telas + fluxo de decisão**, não de motor.

**Consequência ruim:** qualquer mudança de régua continua sendo no Athena, fora
do INOVE. E constantes estão duplicadas de propósito entre SQL e Python
(tolerâncias 10/8 min) — `main.py:102-109` avisa: "mexeu aqui, mexe lá".

## 2. Bloqueador real: os bots não são portáveis

As AÇÕES do DP não são chamadas de API — são **robôs Selenium que dirigem o site
do Transnet**: `bot_ponto.py` (lançar ajuste), `bot_ocorrencia.py` (DSR/folga),
`bot_ajustes_app.py` (capturar/executar/conferir), `bot_comunicado.py`
(advertência). Um app web no navegador **não consegue** fazer isso.

Eles já rodam também em **GitHub Actions** (`_roda_na_nuvem`, `main.py:990-1055`,
`.github/workflows/ocorrencias.yml`, `concurrency: bots-transnet` — uma sessão
do Transnet por vez).

**Desenho recomendado:** INOVE = decidir e comprovar; robô = executar.
O INOVE grava a decisão (tabelas de estado) e dispara o workflow; o robô lê a
fila, executa no Transnet e grava o resultado de volta. É o que o app já faz —
só muda quem é a tela.

## 3. Contrato de dados (o que cada aba usa)

Gateway: Edge Function `dp360-api` (allowlist + admin) → cliente
`src/services/dp360Api.js`. Nenhuma credencial da base de ponto no navegador.

| Aba | Lê | Grava |
|---|---|---|
| **Início** | últimas atualizações por fonte | — |
| **Refeição** (P1) | `ponto_intervalo` (única fonte) | `ponto_importacoes` (log) + arquivo de importação |
| **Revisão** (P2) | `ponto_diario`, `ponto_real_manual`, `ponto_caso`, `ponto_ajustes`, `ponto_gps`, `gps_carro`, `ponto_intervalo`, `viagens_qh`, `ponto_gordura`, `app_config` | `ponto_real_manual`, `ponto_caso`, `ponto_ajustes`, `app_config` |
| **Folgas** (P3) | `ponto_diario`, `ponto_reservas`, `ponto_ocorrencias`, `app_config` | `app_config` (motivos), `ponto_reservas`, `ponto_ocorrencias` (via bot) |
| **Gordura** (P4) | `ponto_gordura`, `ponto_linha99`, `ponto_diario`, `ponto_real_manual`, `ponto_caso`, + `reservas_motoristas` (INOVE) | `ponto_caso`, `ponto_real_manual` |
| **Ocorrências** (P5) | `ponto_ajustes_app`, `ponto_caso`, `ponto_gordura`, `ponto_diario`, `ponto_intervalo`, `ponto_real_manual`, `ponto_ocorrencias`, `app_config` | `ponto_caso`, `ponto_ajustes_app`, `ponto_ocorrencias` |
| **Motorista** | `ponto_diario`, `ponto_gps`, `gps_carro`, `viagens_qh`, `ponto_caso`, `ponto_gordura`, `ponto_real_manual` | — (só pelo pop-up compartilhado) |

`ponto_ajustes_app_hist` é escrito só pelo bot de captura e **nunca exibido**.

## 4. Constantes que a tela precisa respeitar

| Constante | Valor | Onde vale |
|---|---|---|
| Tolerância entrada / saída | **10 / 8 min** | alvo, gordura, veredito |
| Refeição mínima | **27 min** | Refeição (Citatti→SST) |
| Jornada que dispensa refeição | **360 min (6 h)** | Refeição |
| Divergência cartão × sugestão | **10 min** (só no início) | Refeição |
| Concordância entre fontes | **20 min** | régua de fonte |
| Reserva (gordura na entrada) | **> 120 min** | nível RESERVA |
| Raio do veículo / local conhecido | **500 m / 100 m** | GPS "bateu fora" |
| Prazo de resposta do colaborador | **48 h** | Ocorrências |
| Jornada máxima da sugestão | **780 min (13 h)** | trava do bot |
| Janela de dados | **70 dias** | quase todas as leituras |

Matriz de refeição do motorista (sobre o cartão corrigido): `<4h` nada ·
`4–6h` 15 min · `≥6h` 30 min (60 se não operou). Teto do miolo 120 min.

## 5. Regras que não podem ser "reinventadas" na tela

- **Recusar ≠ advertir.** Advertência só existe depois de aviso registrado.
  Recusa sem aviso encerra; com aviso pode advertir/corrigir.
- **Decidir ≠ executar.** O pop-up grava a decisão; quem dispara o robô é uma
  ação separada, com escopo explícito (um clique sem escopo já processou 34
  casos indevidos).
- **Congelar a prova.** O `antes`/`depois` e o alvo do aviso são congelados e
  nunca reescritos por um segundo aviso.
- **Ponta independente.** Entrada e saída são julgadas separadamente; uma nunca
  anula a outra. Dia "misto" obriga abrir o caso (não entra em lote).
- **"Sem base" é resposta válida** — não force veredito quando só há escala.
- **Alvo é da Revisão.** Desde 03-04/09/2026 a Gordura usa o alvo publicado pela
  Revisão. Régua é uma só.

## 6. Fases

1. ~~Gateway com allowlist + cliente~~ **feito**.
2. ~~Cluster dividido em um componente por aba~~ **feito**.
3. ~~Abas de leitura (Motorista, Gordura, Refeição, Folgas)~~ **feito**.
4. ~~Fluxo de decisão (Revisão, Ocorrências): pop-up do cartão, congelamento da
   prova, decisão por ponta~~ **feito** — grava em `ponto_real_manual`,
   `ponto_caso` e `ponto_ajustes_app`.
5. Ligar a **execução** (disparo do workflow do robô + leitura do resultado).
   **É o que falta.** Hoje todo botão de robô é `disabled` dizendo por quê.
6. **Lockdown**: revogar `anon` na base de importação e manter só o gateway.

## 7. O que já saiu da lista (fases 3/4)

Ficam registradas porque explicam decisões do código — não são mais pendências.

1. ~~GPS na Revisão dava falso "bateu fora"~~ — `regrasGps.js` devolve
   `fora: true|false|null`, e **null é "não medido"**, nunca "junto". Dia de
   reserva não desenha ônibus nem cobra distância até ele.
2. ~~Gordura sem a reserva lançada pelo gestor~~ — `reservas_motoristas` fica no
   **projeto do INOVE**, então é lida pelo cliente `supabase` normal, fora da
   `dp360-api`. Crachá com reserva e sem linha de gordura entra no contexto assim
   mesmo (senão o dia sumia).
3. ~~O simulador não foi portado~~ — `regrasPonto.js` porta o julgamento inteiro
   e foi validado por **teste diferencial contra o Python real** (1.120 pares
   crachá×dia): `julgaRef` 518/518, `julgaAcoes` 1090/1090, `simulaCartao`
   1316/1316, `refPonta` 1616/1616. Controle negativo: 10 de 11 constantes
   mutadas foram detectadas. O `verdict` do lake é retrato, não juiz.
4. ~~Gravação desligada~~ — liberada em Revisão e Ocorrências, com as travas do
   trabalhador da seção 5 conferidas no código. O que **continua** desligado é a
   execução (robô), que é outra coisa: decidir não é executar.
5. ~~Mapa (Leaflet) não portado~~ — `MapaBatidas.jsx`: cercas, pinos por papel,
   ônibus e a régua pessoa↔ônibus (verde sólida junto, vermelha tracejada fora).
6. ~~Gateway sem `distinct`~~ — ação `datas` no gateway + cache de 10 min no
   navegador (isolate de Edge Function não guarda estado entre chamadas: medido,
   dois misses seguidos).

## 7b. Pendências que sobraram

- **Robô do Transnet** (fase 5) — precisa de decisão sobre credencial, disparo e
  escopo por execução.
- **Camadas da gordura** ainda vivem dentro de `Gordura.jsx`; o Resumo repete o
  cálculo. Extrair para módulo compartilhado.
- **`viagens_qh`** no pop-up da Revisão.
- Marcação de "não bate ponto" nos Abandonos é lista JSON em `app_config`, **sem
  autor nem carimbo** — se virar prova de alguma coisa, precisa de tabela.

## 8. Pendências de segurança já detectadas

- A base de importação hoje deixa a **anon ler as 40 tabelas** (inclui folha,
  férias, cartão, GPS) e **gravar/apagar** boa parte delas. Não dá para fechar
  antes da fase 6 porque o app atual depende disso.
- `supabase_gordura.sql` concede `all to anon using(true)` — mesmo padrão que o
  INOVE já proibiu no próprio banco.
