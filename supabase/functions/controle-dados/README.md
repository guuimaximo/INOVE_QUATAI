# controle-dados

Edge Function que consolida uso dos Supabases que pagamos (Inove + Farol)
para a tela **Configurações → Controle de Dados**.

## Endpoints

`GET /controle-dados?source=`
- `all` (padrão) — devolve os dois
- `supabase-inove` — RPC `controle_dados_metricas` no projeto Inove
- `supabase-farol` — RPC `controle_dados_metricas` no projeto Farol

## Setup

### 1. Migration nos dois projetos
Rode `supabase/migrations/202606081200_controle_dados_metricas.sql` no
Inove **e** no Farol (mesmo SQL — cria a função `controle_dados_metricas`).

### 2. Secrets no projeto Inove
Project Settings → Edge Functions → Secrets:

| Secret | Origem |
|---|---|
| `FAROL_PROJECT_URL` | URL do projeto Farol, `https://<ref>.supabase.co` |
| `FAROL_SERVICE_ROLE_KEY` | Service role do Farol (Settings → API) |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já vêm prontos do projeto Inove.

### 3. Deploy
```bash
supabase functions deploy controle-dados
```

## Observação

Custos de IA (Gemini/Vertex) não estão incluídos. O Gemini roda no servidor
do Farol no Render e o billing fica no Google Cloud — sem API simples para
puxar valores em tempo real (precisaria habilitar BigQuery billing export).
Se for o caso, adicionar isso depois.
