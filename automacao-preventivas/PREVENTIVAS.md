# Programação de Preventivas — Documento de Design (vivo)

> **Status:** 🟡 estruturando (só entendimento — nada construído ainda)
> **Início:** 17/07/2026 · Grupo CSC / Quatai
> **Regra desta fase:** só estruturar o pensamento. Não codar até a planta estar aprovada.
> Este arquivo é atualizado a cada conversa — é a "planta baixa" antes de qualquer código.

---

## 1. Objetivo (a preencher com o pensamento do usuário)

Montar uma **tabela/ferramenta de programação de preventivas**: decidir **quais carros chamar, para qual plano, em qual dia** — sem deixar vencer e sem estourar a oficina.

> ⏳ _Aguardando o usuário descrever a dor atual e como pensa a programação (ver seção 6)._

---

## 2. O que já sabemos: a base de planos (trazido pelo Claude)

Fonte: tabela **`ultimo_plano`** — Supabase Transnet (o mesmo "Supabase A" do flash report).
É um snapshot: **1 linha por veículo × plano**, com o estado atual de cada plano.

| Campo | O que é | Uso |
|---|---|---|
| `nr_ordem` | veículo (frota/prefixo: W541, 222207…) | quem |
| `ds_plano` | tipo do plano (ver lista abaixo) | o quê |
| `qt_km_intervalo` | de quantos em quantos km repete (5.000, 10.000…) `0` = plano por tempo | natureza |
| `qt_dia_intervalo` | intervalo em dias (planos por tempo, ex: TCO) | natureza |
| `km_para_proxima` | **quanto falta.** negativo = faltam \|x\| km · `>= 0` = já venceu por x km | **o gatilho** |
| `dias_vencido` | dias vencidos (só planos por tempo) | gatilho (tempo) |
| `cs_ativo` | ativo? (`N` = ignorar) | filtro |

### Tipos de plano (`ds_plano`) observados
Inspeção 5.000 · Preventiva 10.000 · Revisão Pesada · Limpeza Geral · Limpeza Tanque ARLA ·
Óleo Caixa de Marcha · Óleo Diferencial · Filtro de Ar · Aferição Tacógrafo (TCO, por tempo) ·
_(Concessionária = garantia Euro6, tratada à parte — não entra na programação in-house)_

### Regra de vencimento (validada no flash report)
- **Plano por KM** (`qt_km_intervalo > 0`): venceu quando `km_para_proxima >= 0`.
- **Plano por TEMPO** (`qt_km_intervalo = 0` e `qt_dia_intervalo > 0`, ex: TCO): venceu quando `dias_vencido > 0`.
  _(Não usar km_para_proxima nesses — a importação grava km_rodado ali e falsearia o vencimento.)_

### 🔑 O pulo do gato: projeção de vencimento
Como sabemos o **KM/dia que cada carro roda** (TransNet — já usado no MKBF do flash report):

```
dias_até_vencer  ≈  (−km_para_proxima)  ÷  km_por_dia_do_carro
```

Isso transforma a base de "**o que já venceu**" em "**o que VAI vencer e quando**" — a matéria-prima de uma programação preditiva (chamar o carro *antes* de estourar).

### Números de referência (flash report, jul/2026)
- ~1.784 planos ativos in-house · ~29–33 vencidos · acuracidade ~98%.
- Vencidos concentram em Inspeção 5.000, Limpeza Geral, Revisão Pesada.

---

## 2.1 Acessos / como conectar (para o chat da pasta PREVENTIVAS)
As credenciais estão em **`.env`** nesta pasta (LOCAL, protegido pelo `.gitignore` — nunca commitar).
Helper pronto: **`conexao.py`** (lê o `.env`, sem chave no código).

```python
from conexao import fetch_all, SB_A, SB_B
# SB_A = TRANSNET (ultimo_plano, indicadores_diesel, solicitacao_reparo, eventos_regeneracao)
# SB_B = INOVE (sos_acionamentos, veiculos_pcm, pcm_diario, preventivas)
planos = fetch_all(SB_A, "ultimo_plano",
                   "nr_ordem,ds_plano,qt_km_intervalo,qt_dia_intervalo,km_para_proxima,dias_vencido,cs_ativo",
                   "&cs_ativo=neq.N")
```
Teste de conexão: `python conexao.py` (deve dar HTTP 200 nas duas bases). Validado 17/07 ✓.

## 3. Fontes de dados disponíveis
- `ultimo_plano` (Transnet/A) — estado dos planos (acima).
- `indicadores_diesel` (Transnet/A) — km por veículo/dia → **km/dia médio** por carro.
- `preventivas` (INOVE/B) — preventivas **já realizadas** (prefixo, data_realizacao, tipo, mecânico) → fechar o loop (o que foi feito vs programado).
- _(possível) veículos parados/GNS (PCM) — carro parado não pode ser programado._

---

## 4. Estrutura da tabela — _a definir juntos_

> ⏳ Formato (calendário dias×carros? fila priorizada? grade semanal?) — depende da seção 6.

---

## 5. Regras de negócio — _a preencher_

> ⏳ Capacidade da oficina/dia · agrupamento de planos do mesmo carro · prioridades ·
> o que fazer com carro parado · janela de antecedência (chamar com quantos km/dias antes).

---

## 6. Pensamento do usuário (a fonte da verdade) — _a capturar_

> ⏳ Perguntas abertas enquanto conversamos:
> 1. Dor atual: como programa hoje e o que dá errado?
> 2. O que a tabela precisa responder?
> 3. Capacidade/limite da oficina por dia (e leve vs pesada)?
> 4. Visão: calendário, fila, ou outra coisa?

---

## 7. Decisões tomadas (log)
- 17/07: pasta `PREVENTIVAS` criada isolada dos repos de relatório. Doc de design vivo escolhido (vs skill) para a fase de estruturação.

## 8. Perguntas em aberto
- _(nada decidido ainda — tudo em aberto)_
