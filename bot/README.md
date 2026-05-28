# Bot Estoque (GitHub Actions)

| Workflow | Arquivo | Quando roda |
|----------|---------|-------------|
| Diário | `.github/workflows/bot-estoque-diaria.yml` | Cron a cada 5 min + manual |
| Semanal | `.github/workflows/bot-estoque-semanal.yml` | Segunda 06h UTC + manual |

Os dois leem **tudo do Supabase**. Nada de Google Sheets ou Base.xlsx.

## Secrets a cadastrar (Settings → Secrets and variables → Actions)

| Secret | Diário | Semanal | Conteúdo |
|--------|:-:|:-:|---|
| `SUPABASE_URL` | ✅ | ✅ | `https://wboelthngddvkgrvwkbu.supabase.co` |
| `SUPABASE_SERVICE_KEY` | ✅ | ✅ | service_role do Supabase (Project Settings → API) |
| `TRANSNET_URL` | opc | opc | URL completa de login (tem default) |
| `TRANSNET_USER` | ✅ | ✅ | usuário TransNet |
| `TRANSNET_PASSWORD` | ✅ | ✅ | senha |
| `TRANSNET_ALMOXARIFADO` | ✅ | ✅ | ex.: `046` (QUATAÍ) |
| `TELEGRAM_TOKEN` | — | opc | só se quiser receber resumo no Telegram |
| `TELEGRAM_CHAT_ID` | — | opc | idem |

## Saídas
- **Diário**: atualiza `saldo_erp` + `diferenca` em cada linha de `suprimentos_contagens` do dia processado.
- **Semanal**: salva `auditoria_por_item.xlsx` no Supabase Storage (`bucket=suprimentos`, pasta `auditorias/`) e cria uma linha em `suprimentos_auditorias` com o resumo e a URL pública. O app puxa essa lista direto.

## Manual
- Diário: Actions → **Bot Estoque · Conferência Diária** → Run workflow → opcional `data_alvo=YYYY-MM-DD`.
- Semanal: Actions → **Bot Estoque · Auditoria Semanal** → Run workflow.

## Como funciona o diário
1. Usuário aperta "Conferir com ERP" na app.
2. App grava job em `suprimentos_bot_jobs` (`status=pendente`, `data_alvo=...`).
3. O cron de 5 min lê o job, baixa o CSV do dia D→D, escreve `saldo_erp` e `diferenca` em cada contagem, marca `concluido`.
4. App detecta `concluido` no polling e recarrega.
