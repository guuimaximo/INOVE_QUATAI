# Flash Report Diesel — Briefing de implementação (dados ao vivo)

> Documento de handoff. Objetivo: transformar as páginas que hoje usam **dados fixos** em
> consultas **ao vivo** ao Supabase, mantendo sempre um **fallback fixo** para o relatório
> nunca quebrar se a credencial faltar. A Página 11 (Instrutores) **já foi feita** e serve de
> modelo — siga o mesmo padrão.

## Estado atual (o que já está pronto)

- **Página 11 (Instrutores)** — dinâmica, lê `diesel_acompanhamentos` do INOVE ao vivo.
  Ver `gen_flash_diesel_v3.py`: `_carregar_instrutores_junho()` + `supabase_creds("inove")`.
- **Helper de credenciais** `supabase_creds(projeto)` em `gen_flash_diesel_v3.py` — lê tudo de
  variáveis de ambiente (secrets). **Nunca** colocar chave em texto puro no código.
- **Workflow** `.github/workflows/bot-flash-report-diesel.yml` — já injeta os 6 secrets no passo
  "Gerar graficos + HTML".

## Os 6 secrets (já criados no repo INOVE_QUATAI)

| Projeto | Secret URL | Secret chave | Uso |
|---|---|---|---|
| INOVE | `SUPABASE_URL` | `SUPABASE_SERVICE_KEY` | `diesel_acompanhamentos` (Pág. 11) |
| BCNT | `SUPABASE_BCNT_URL` | `SUPABASE_BCNT_KEY` | cluster (`veiculos_ativos`), premiação |
| Base_transnet | `SUPABASE_TRANSNET_URL` | `SUPABASE_TRANSNET_KEY` | `indicadores_diesel` (KM/L, divergência, aderência) |

No código: `supabase_creds("inove" | "bcnt" | "transnet")` devolve `(url, key)` ou `(None, None)`.

## Padrão a seguir (obrigatório)

1. Função `_carregar_<coisa>()` que:
   - chama `supabase_creds("<projeto>")`; se `(None, None)` → `return None` (usa fallback fixo);
   - consulta via `_sb_get(url, key, tabela, params)`;
   - agrega em Python e devolve a mesma estrutura das constantes fixas.
2. Logo após a constante fixa: `_live = _carregar_<coisa>(); if _live: CONSTANTE = _live`.
3. **Sempre manter a constante fixa como fallback** (última extração conhecida).
4. **Paginação:** o PostgREST devolve no máx. **1.000 linhas por requisição**. Para a
   `indicadores_diesel` (meses × ~110 veículos = milhares de linhas) é obrigatório paginar com
   header `Range` (`Range: 0-999`, `1000-1999`, …) ou `?limit=&offset=` até esvaziar.

## Fontes por página

| Página | Conteúdo | Fonte(s) |
|---|---|---|
| 2 | KM/L mensal (7 meses) + semanal | `indicadores_diesel` (Transnet) — agregar por mês/semana |
| 3 | KM/L por cluster (4 meses) | `indicadores_diesel` (KM/L) **+** BCNT `veiculos_ativos` (mapa veículo→cluster) |
| 16 | Divergência Transnet × Telemetria por carro | **só** `indicadores_diesel` |
| 17 | Aderência da frota | **só** `indicadores_diesel` |
| 15 | Meritocracia (R$) | BCNT `premiacao_atualizada` |
| 4/5/6/7/8/9 | Linhas, motoristas, velocidade | BCNT `premiacao_diaria_atualizada` (Telemetria) |

> **Sugestão de ordem:** começar por **17 (aderência)** e **16 (divergência)** — dependem só de
> uma tabela, sem join. Depois **2** e **3** (histórico + cluster do BCNT).

## Schema — `indicadores_diesel` (Base_transnet), por veículo/dia

CSV de amostra: `C:\Users\Guilh\Downloads\indicadores_diesel_rows.csv` (cópia fiel das colunas;
o export do editor vem **cortado em ~1.500 linhas / 2 semanas** — a tabela real tem o histórico
completo, então **use a consulta ao vivo com paginação**, não o CSV).

| Coluna | Significado |
|---|---|
| `data_consolidada` | data (YYYY-MM-DD) |
| `id_transnet` | id da linha no Transnet |
| `veiculo` | número do veículo (chave p/ join com cluster) |
| `km_litro_transnet` | **KM/L oficial Transnet** |
| `km_transnet` | km rodado (Transnet) |
| `combustivel_transnet` | litros (Transnet) |
| `placa` | placa |
| `label_sst` | rótulo telemetria/SST |
| `km_sst` | km (telemetria/SST) |
| `combustivel_sst` | litros (telemetria/SST) |
| `km_l_sst` | **KM/L telemetria (SST)** |
| `km_operacional_gps` | km operacional (GPS) |
| `km_ocioso_gps` | km ocioso (GPS) |
| `km_total_gps` | km total (GPS) |

### KM/L ponderado (não fazer média de médias)
Agregar somando km e litros e dividindo:
`kml = Σ km_transnet / Σ combustivel_transnet` (idem para SST com `km_sst`/`combustivel_sst`).

### Filtros de qualidade (obrigatórios)
- Descartar linhas sem dado: `km_litro_transnet` vazio (para aderência) etc.
- **Telemetria com lixo:** ignorar `km_l_sst` = 0 ou fora de faixa realista (vi `9,683` e `0,0`
  nos dados). Recomendo aceitar só `0,5 ≤ km_l_sst ≤ 6` ao computar divergência.
- **Divergência (Pág. 16):** só carros com volume mínimo (o relatório usa **≥ 500 km** no
  período) e recorte **≥ 10%**. Fórmula: `(kml_sst − kml_transnet) / kml_transnet × 100`.
- **Aderência (Pág. 17):** por dia, `% = veículos com km_litro_transnet válido / total da frota`.
  Frota de referência no relatório atual = **111**. Fins de semana caem naturalmente (~30%).

## BCNT — tabelas necessárias (confirmar schema ao vivo)
- `veiculos_ativos` — precisa da coluna que mapeia **veículo → cluster** (o relatório usa
  `per_cluster`; confirmar nome exato). Clusters usados: C6, C8, C9, C10, C11.
- `premiacao_diaria_atualizada` — KM/L e velocidade por linha/veículo/dia (Telemetria).
- `premiacao_atualizada` — valor R$ da meritocracia (junho), já calculado pela regra.

## Decisões já tomadas (não reabrir sem motivo)
- **Página 11 (feita):** recorte **híbrido** de Junho/2026 — "novos" por `dt_inicio_monitoramento`
  no mês; desfechos OK/ATA por `prontuario_30_gerado_em` no mês (porque `dt_fim_real` é sempre
  nulo). `taxa_atingiu_meta` = % com `metadata.kpis.kml_real ≥ kml_meta`.
- O relatório é do mês **Junho/2026**. Ao consultar, filtrar pelo mês de referência
  (`JUNHO_INICIO`/`JUNHO_FIM` em `gen_flash_diesel_v3.py`). Se um dia virar rolling, parametrizar
  o mês em um único ponto.

## Como validar
`python gen_html_v3.py` com os secrets no ambiente gera gráficos + HTML; o passo seguinte do
workflow gera o PDF via WeasyPrint. Conferir se os números batem com a extração fixa anterior
(pequenas diferenças são esperadas: a base cresce). Rodar `workflow_dispatch` para testar
ponta-a-ponta com os secrets reais.
