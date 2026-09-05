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
3. Portar as abas de **leitura** (Motorista, Gordura, Refeição, Folgas) — só
   renderizam o que a view já calculou. Menor risco.
4. Portar o **fluxo de decisão** (Revisão, Ocorrências): pop-up do cartão,
   congelamento da prova, decisão por ponta.
5. Ligar a **execução** (disparo do workflow do robô + leitura do resultado).
6. **Lockdown**: revogar `anon` na base de importação e manter só o gateway.

## 7. Pendências conhecidas das telas portadas (fase 3/4)

Levantadas pelos próprios agentes durante o porte. Nenhuma bloqueia o uso em
leitura, mas as duas primeiras precisam sair antes de destravar gravação.

1. **GPS na Revisão pode dar falso "bateu fora".** A régua real (`_regua_local`,
   `main.py:191`) trata dois casos que a versão portada não cobre:
   - âncora do veículo **sem coordenada** → o original marca "não medido", e isso
     nunca pode contar como "junto";
   - **dia de reserva** → nesse dia a pessoa não tem carro; batida em local
     conhecido vale por si.
   Sem isso, um motorista de reserva aparece como "fora" sem ter batido fora.
2. **Gordura sem a reserva lançada pelo gestor.** `_aplica_reserva`
   (`main.py:4844`) depende de `reservas_motoristas`, que fica no **projeto do
   INOVE** e não na base de importação — por isso não está na allowlist do
   gateway. Solução: ler direto pelo cliente `supabase` normal (mesma sessão),
   sem passar pela `dp360-api`. A reserva por GPS e o nível RESERVA já funcionam.
3. **Ocorrências: o simulador não foi portado.** `ferramenta/simulador.py` /
   `_simula` (âncora de meia-noite, batida fantasma, projeção do cartão) ficou de
   fora; o "depois" exibido é o `ponto_depois` congelado no lake. **Conferir
   linha a linha contra `get_conferencia` antes de liberar a gravação.**
4. **Gravação desligada de propósito** em Revisão e Ocorrências (botões
   `disabled` + banner). São as telas que produzem advertência; liberar só depois
   de validar o veredito contra o app atual.
5. **Mapa (Leaflet) não portado** — a lista de GPS com distância está lá; falta o
   mapa com as cercas e a linha pessoa↔ônibus.
6. **Gateway sem `distinct`** — listar as datas de uma aba pagina milhares de
   linhas. Vale uma ação `datas` que deduplica no servidor.

## 8. Pendências de segurança já detectadas

- A base de importação hoje deixa a **anon ler as 40 tabelas** (inclui folha,
  férias, cartão, GPS) e **gravar/apagar** boa parte delas. Não dá para fechar
  antes da fase 6 porque o app atual depende disso.
- `supabase_gordura.sql` concede `all to anon using(true)` — mesmo padrão que o
  INOVE já proibiu no próprio banco.
