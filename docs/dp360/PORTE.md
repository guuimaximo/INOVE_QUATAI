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
5. ~~Ligar a **execução** (disparo do workflow do robô)~~ **feito**, com as
   exceções da seção 7c. Falta a **leitura do resultado** — ver 7c.
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

## 7b. Fase 5 — como o robô ficou

O navegador não dirige o Transnet: isso é Selenium, no GitHub Actions do repo
**guuimaximo/DP360**, onde a credencial do Transnet já é secret. O INOVE decide,
o robô executa.

Ação `robo` no `dp360-api`, com três travas que não são burocracia:

1. **Allowlist de workflow E de input.** O que vem da tela não vira nome de
   arquivo nem input solto; são quatro workflows e cada um só aceita as chaves
   que declara. Sem isso, quem chamasse a função rodaria qualquer workflow do
   repo.
2. **`confirmar` nasce falso.** Nos quatro bots, sem `--confirmar` é ENSAIO:
   navega, acha o botão, não clica. Default invertido aqui é a diferença entre um
   teste e uma advertência de verdade na ficha de alguém. Na tela, ensaio e
   valendo são **dois botões**, nunca um checkbox.
3. **Trilha antes do disparo.** A linha em `dp360_auditoria` é gravada ANTES de
   chamar o GitHub, e se ela falhar o disparo não acontece. Disparo sem registro
   é o único resultado que não pode existir. O CSV nunca entra na trilha (tem
   crachá e nome) — só o tamanho.

Telas ligadas: **Folgas** (`ocorrencias.yml`), **Refeição** (`ponto.yml`),
**Revisão** e **Gordura** (`comunicado.yml`, pelo módulo
`src/pages/dp360/comunicadoTransnet.js`) e **Ocorrências** (`ajustes.yml`, modo
"executar decisoes", escopo de um crachá+dia).

Token: secret `DP360_GITHUB_TOKEN` da função; na falta dele cai no `GITHUB_TOKEN`
que já existe (mesmo dono dos dois repos).

## 7c. O que a fase 5 NÃO cobre (e por quê)

- **O resultado não volta — mas menos do que eu escrevi aqui antes.** Corrigido
  em 06/09 pela comparação da seção 9: o robô `ajustes`, no modo
  `conferir (so leitura)` COM confirmar, JÁ grava de volta (`conferido_em`,
  `aviso_conferido_em` e o veredito — `bot_ajustes_app.py:718`), e o workflow já
  carrega a credencial do Supabase (`ajustes.yml:50`). O caminho existe e está
  pronto: falta o INOVE disparar esse modo. Para os robôs `ponto`, `comunicado` e
  `ocorrencias` a frase continua valendo — quem preenche `ponto_ocorrencias` e
  carimba `advertencia_enviada_em` / `correcao_final_em` é o pós-processo da
  ferramenta desktop, que ESPERA o run.
- **"Advertir e corrigir" continua desligado.** Não é um robô: é uma corrente de
  três elos (`app.js:347`, comentário do próprio original) — `executar_decisoes`
  → `comunicado` motivo 103 → `ponto`. Ligar só o primeiro mandaria carta sem
  registro de que saiu e corrigiria cartão sem alvo.
- **"Cancelar no Transnet" continua desligado.** É `--cancelar-enviadas`, modo que
  o `ajustes.yml` não expõe: o `_nuvem_traduz` traduz só
  `conferir`/`capturar`/`executar`.
- **`alvo_etapa2`** (alvo manual do interno) ainda não tem campo na tela.

## 7d. Pendências que sobraram

- **Série por competência** no Resumo — no Python ela soma a gordura inteira antes
  do filtro; no navegador seriam ~10 mil linhas por competência, doze vezes. Fazer
  só a metade barata deixaria cada barra antiga MENOR que a da ferramenta. Caminho:
  ação de agregação no gateway.
- **`viagens_qh`** no pop-up da Revisão.
- **Corrida no `app_config`**: a marcação de "não bate ponto" é lista JSON lida e
  reescrita inteira; a tela relê imediatamente antes do upsert, o que encurta a
  janela mas não fecha (PostgREST não tem compare-and-set). Fechar exigiria coluna
  de versão que a ferramenta desktop também respeitasse. Hoje o que salva é a
  trilha: dá para reconstruir quem marcou o quê.
- **Bug no Python, não no porte:** `main.py:3777/3780` chama
  `self._ponta_conta(niv, gor, ponta)` com `ponta` indefinido no escopo →
  `NameError` → a caixa "ainda sem aviso" não aparece na ferramenta. O INOVE
  mostra; a ferramenta não.

## 8. Pendências de segurança já detectadas

- A base de importação hoje deixa a **anon ler as 40 tabelas** (inclui folha,
  férias, cartão, GPS) e **gravar/apagar** boa parte delas. Não dá para fechar
  antes da fase 6 porque o app atual depende disso.
- `supabase_gordura.sql` concede `all to anon using(true)` — mesmo padrão que o
  INOVE já proibiu no próprio banco.

## 9. Inventário ferramenta × INOVE (06/09/2026)

Comparação tela a tela das 13 da ferramenta contra o porte. Só entra buraco que
muda a vida de quem usa — diferença de cor, ícone ou ordem de coluna não conta,
salvo quando a cor **é** o veredito. O que não deu para confirmar está marcado
como suspeita.

**TODOS OS 15 FORAM FEITOS** (06-07/09/2026). O que cada um virou está no commit
correspondente; a lista fica aqui como registro do que existia:

1. Ocorrências · `conferir (so leitura)` — **feito**, dois escopos, escopo vazio recusado.
2. Ocorrências · `capturar a grade` — **removido**: a premissa era falsa (o importador
   diário substitui a captura ao vivo), não tem ensaio e não congela a prova.
3. Refeição · o robô reescrevia as pontas de um retrato velho — **travado**: dia já
   mexido no Transnet sai do lote.
4. Folgas · picker de motivo do dia `S/PONTO` — **feito**, os 14 códigos, `04` manual e
   fora da fila, na mesma chave `app_config` da ferramenta.
5. Gordura · cascata por ponta com iteração entrada × saída — **feito**. Medido: 509 de
   8.000 linhas só fecham por causa da iteração.
6. Folgas · seleção múltipla e lançamento em lote — **feito**, um montador de CSV só.
7. Cartão · faixa "Semana dele" — **feito**, acima das colunas (dentro de uma, cairia
   abaixo da dobra e a trava não travaria nada).
8. Revisão · "Lançar ajuste" (correção em lote) — **feito**, reusando `sugBloqueio` e o
   CSV da Refeição.
9. Ocorrências · fechar o caso à mão — **feito**, dois desfechos; `nao_da` não carimba
   `correcao_final_em` (dizer que corrigiu seria mentir no histórico).
10. Gordura · coluna "Status atual" do ciclo — **feito**, na ordem de testes do original.
11. Refeição · arquivo `.txt` de batidas PIS — **feito**, 34 caracteres conferidos byte a
    byte contra o `_monta_batida`.
12. Cartão · rota "pedir exclusão de batida" — **feito**, sem alvo e com o cartão CRU no
    retrato (o limpo descarta a batida que a exclusão vai apagar).
13. Banco de Horas · saldo "com a folha fechada" — **feito**, leitura própria. A
    separação vale 9.359,8 h e inverte o sinal do passivo.
14. Folgas · marcar o dia como reserva — **feito**, com o DELETE varrendo as duas grafias
    de crachá (o desktop grava cru, a tela grava com 8).
15. Gordura · cravar o Real sem sair da tela — **feito** pelo `CartaoDoDia` compartilhado.

Menores, também feitos: Banco de Horas por mês; Resumo com "todas as competências" e
drill-down sem teto cego; valor da hora editável; Config com "↩ Padrão" e o teste de
modelos (que pega `{Nome}` minúsculo — no INOVE isso é pior que na ferramenta, porque a
minúscula sai literal na carta); Refeição com "incluir Abaixo 27min".

Suspeitas (não confirmadas): categoria em branco some das Folgas (o pivô da
ferramenta trata vazio como INTERNO); o seletor do Motorista para no teto de
páginas sem sinalizar, ao contrário do Abandonos, que avisa "leitura truncada".

### Divergências docstring × código no original (vale o código)

- `main.py:2340` diz que `tipo='fora'` não cria `ponto_caso`; o código cria (`:2434`).
- `main.py:8905` diz "recusa o 05"; recusa o `102` (`:8909`).
- `main.py:3829` diz "gordura congelada"; o código prefere `captura_min` (`:3668`).
- `processar_intervalo.py:126` diz "força 30 min"; grava o gap real (`:121`).
- `main.py:3567` diz "menos almoço curto/longo"; tira **seis** motivos (`:3557`).
- `main.py:4389` diz "registra quem mandou"; grava `usuario="bot"` fixo (`:4485`) —
  aqui o porte está à frente: `dp360_auditoria` guarda autor, workflow e escopo.

### Existe na ferramenta, mas morto (não portar)

`corrigir_ponto_invertido` (`main.py:8374`) recusa sempre que a linha traz
`acao_sugerida`, e a view atual sempre traz — além de não ser chamado de lugar
nenhum no `app.js`. `_filtra_gordura_cartao_valido` (`main.py:4683`) é definido e
nunca chamado. `run_etapa3` (`main.py:1577`) está marcado OBSOLETO no próprio código.

## 10. Credencial do Transnet — o estado e a decisão (07/09/2026)

**Estado:** os secrets `TRANSNET_USER` / `TRANSNET_PASSWORD` do repo `guuimaximo/DP360`
**não existem**. Existiam até 03/09 (o log do run daquele dia mostra `STEP login →
logado`). Sem eles, todo run morre no login em ~16 s com `Usuario Transnet:` — que é o
prompt de terminal do bot, disparado quando a variável de ambiente chega vazia.

Isso derruba os dois caminhos, não só o do INOVE: quando a **ferramenta desktop**
despacha para a nuvem (`_roda_na_nuvem`), o run lê os mesmos secrets — e ela só cai
para o modo local quando não consegue despachar, não quando o run falha.

**Conserto imediato, sem código:** recriar os dois secrets com a credencial
compartilhada, como estava.

**O desenho por pessoa ficou PARA DEPOIS, por decisão do dono (07/09):** os bots do
repo `DP360` são os mesmos que a ferramenta desktop usa, e mexer em como eles leem a
credencial quebraria o desktop junto. Não é a hora.

Quando for, o que ficou levantado:

- **Input de workflow não serve.** O GitHub imprime o bloco `run:` com o input já
  substituído — verificado no log do run 34073577523, que mostra
  `CASOS='[{"cracha":"30060937",…}]'` em texto puro. Uma senha ali ficaria legível no
  histórico, para sempre.
- **Secret de repositório não serve para "por pessoa".** É um só: a Gabi salva, o Josué
  dispara, e o Transnet registra a Gabi como autora da advertência que o Josué mandou.
- **Caminho recomendado — bilhete.** A credencial vai cifrada para uma linha da própria
  pessoa, com validade curta, apagada ao sair do INOVE; o disparo leva só um bilhete
  opaco de uso único, e o bot troca o bilhete pela credencial na hora de logar. A
  alternativa (cifrar no input) esconde do log mas deixa o texto cifrado eterno no
  histórico do run — vazou a chave um dia, vazou tudo que já passou.
- **A mudança no bot pode ser compatível:** ler o bilhete quando ele existir e cair na
  variável de ambiente quando não — assim o desktop continua funcionando como hoje.
