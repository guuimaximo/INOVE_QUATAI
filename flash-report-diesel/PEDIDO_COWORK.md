# Pedido para o Cowork — deixar o Flash Report 100% ao vivo

**Objetivo:** hoje o Flash Report Diesel tem quase tudo com número **fixo** no código (extração
manual de 05/07/2026). Só a **Página 11 (Instrutores)** busca dados ao vivo. Quero que **todas as
páginas** passem a buscar os dados **ao vivo do Supabase** quando o bot rodar, e me entregue o PDF
pronto. Você roda dentro do GitHub e tem acesso aos secrets — eu não preciso te passar chave.

## O que fazer

Converter as páginas fixas para consulta ao vivo, **seguindo o padrão que já existe** na Página 11
(`_carregar_instrutores_junho()` em `gen_flash_diesel_v3.py`):
`supabase_creds(projeto)` → `_sb_get(...)` com **paginação** → agrega em Python → sobrescreve a
constante fixa. **Sempre manter a constante fixa como fallback** (o relatório não pode quebrar se
uma chave faltar).

Leia primeiro **`flash-report-diesel/IMPLEMENTACAO.md`** — tem o schema da `indicadores_diesel`,
as fontes de cada página, os filtros de qualidade e as decisões já tomadas.

## Ordem sugerida (do mais fácil ao mais complexo)

1. **Página 17 (aderência)** e **Página 16 (divergência)** — só a tabela `indicadores_diesel`
   (Base_transnet), sem join. Comece por elas.
2. **Páginas 2 e 3** (KM/L mensal/semanal e cluster) — `indicadores_diesel` + `veiculos_ativos`
   (BCNT) para o mapa veículo→cluster.
3. **Páginas 4–9 e 15** — BCNT (`premiacao_diaria_atualizada`, `premiacao_atualizada`).
4. **Páginas 10, 12, 13, 14** — INOVE (`diesel_acompanhamentos` / `diesel_tratativas`), no mesmo
   padrão da 11.

## Regras que não podem ser esquecidas

- **Filtro de qualidade NÃO esconde problema:** dado de sensor bugado (`km_l_sst`=0 ou absurdo tipo
  9,68) sai **da média**, mas o veículo entra numa **lista de "consertar"** (Págs. 16/17), separando
  o defeito: 0 = não transmite; absurdo = descalibrado; `km_litro_transnet` vazio = falha Transnet.
- **KM/L sempre ponderado** (soma km ÷ soma litros), nunca média de médias.
- **Paginação** obrigatória (PostgREST corta em 1.000 linhas/requisição).
- **Nenhuma chave em texto puro** — tudo via `supabase_creds()` (secrets).
- **Mês de referência = Junho/2026** (`JUNHO_INICIO`/`JUNHO_FIM`). Se algum dado não existir no
  mês, deixar claro no relatório em vez de mostrar número errado.

## Como validar e entregar

- Rodar o workflow (`workflow_dispatch`) com os secrets reais.
- Conferir se os números batem, em ordem de grandeza, com a versão fixa anterior (pequenas
  diferenças são esperadas — a base cresce).
- Me entregar o **PDF gerado** para eu revisar antes de aprovar o merge na branch principal.
