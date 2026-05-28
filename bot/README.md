# Bot Estoque (GitHub Actions)

Dois workflows em `.github/workflows/`:

| Workflow | Arquivo | Quando roda |
|----------|---------|-------------|
| Diário | `bot-estoque-diaria.yml` | A cada 5 min (poll na fila `suprimentos_bot_jobs`) + manual |
| Semanal | `bot-estoque-semanal.yml` | Segunda 06:00 UTC (~03:00 BRT) + manual |

## Secrets a cadastrar em **Settings → Secrets and variables → Actions**

### Comuns aos dois workflows
| Secret | Conteúdo |
|--------|----------|
| `SUPABASE_URL` | `https://wboelthngddvkgrvwkbu.supabase.co` |
| `SUPABASE_SERVICE_KEY` | service_role key do projeto (usa pra `update` em `suprimentos_contagens` e `suprimentos_bot_jobs`) |
| `TRANSNET_URL` | URL completa de login (já tem default no código) |
| `TRANSNET_USER` | login TransNet |
| `TRANSNET_PASSWORD` | senha TransNet |
| `TRANSNET_ALMOXARIFADO` | código do almoxarifado (ex.: `046`) |

### Só semanal
| Secret | Conteúdo |
|--------|----------|
| `GOOGLE_CREDENTIALS_JSON` | JSON inteiro da service account do Google (mesmo arquivo `credenciais.json` que está em `C:\Projetos\Bot_Estoque_1`) |
| `SHEET_REF` | URL da planilha de contagens |
| `SHEET_TAB` | aba (ex.: `Contagem`) |
| `TELEGRAM_TOKEN` | token do bot |
| `TELEGRAM_CHAT_ID` | chat id pra onde manda o resumo |
| `BASE_XLSX_B64` *(opcional)* | conteúdo do `Base.xlsx` em base64 (`base64 -w0 Base.xlsx`) |

## Como funciona o diário
1. Usuário aperta **Conferir com ERP** na Central de Contagens.
2. App insere um job em `suprimentos_bot_jobs` (status=`pendente`, `data_alvo=YYYY-MM-DD`).
3. Workflow agendado roda `bot/bot_diaria.py`:
   - Pega até 5 jobs pendentes por execução.
   - Para cada job: baixa o CSV "Entradas e Saídas Acumuladas" no dia `D→D` do TransNet, lê coluna `Saldo`, atualiza `suprimentos_contagens.saldo_erp` e `diferenca` em cada linha daquele dia, marca o job como `concluido`.
4. App detecta `concluido` via polling e recarrega a Central.

Disparo imediato: aba **Actions → Bot Estoque · Conferência Diária → Run workflow** (pode passar `data_alvo` no campo).

## Como funciona o semanal
- Igual ao `main.py` original: pega C1/C2 da planilha do Google, baixa EV1/EV2/EV3, aplica fórmula do Excel, gera `auditoria_por_item.xlsx`, manda no Telegram e sobe o Excel como **artifact** do run (`auditoria-semanal`, retém 14 dias).

## Testando local (Windows)
```powershell
cd C:\...\INOVE_QUATAI\bot
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:SUPABASE_URL="..."
$env:SUPABASE_SERVICE_KEY="..."
$env:TRANSNET_USER="..."
$env:TRANSNET_PASSWORD="..."
python bot_diaria.py --data-alvo 2026-05-27
```
