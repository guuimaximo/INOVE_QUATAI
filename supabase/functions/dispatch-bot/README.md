# Edge Function: dispatch-bot

Dispara o workflow do GitHub Actions sob demanda (sem esperar o cron de 5 min).

## Setup uma vez

### 1) Criar Personal Access Token no GitHub
- GitHub → Settings → **Developer settings → Personal access tokens → Fine-grained tokens** → New token
- Repository access: **Only select repositories** → escolhe `INOVE_QUATAI`
- Permissions → Repository permissions → **Actions: Read and write**
- Expiração: 1 ano (ou o que preferir; precisa renovar depois)
- Cria e copia o token (começa com `github_pat_…`).

### 2) Configurar secrets do Supabase
No Dashboard → **Project Settings → Edge Functions → Manage secrets** adiciona:

| Nome | Valor |
|------|-------|
| `GITHUB_TOKEN` | o PAT criado acima |
| `GITHUB_REPO_OWNER` | `guuimaximo` |
| `GITHUB_REPO_NAME` | `INOVE_QUATAI` |
| `GITHUB_REF` | branch que vai rodar (ex.: `main` ou `codex/diesel-organograma-highlights`) |

### 3) Deploy da função
```bash
cd C:\Users\Guilh\OneDrive\Documentos\INOVE_LOCAL\INOVE_QUATAI
supabase functions deploy dispatch-bot
```

(Precisa estar logado: `supabase login` se ainda não estiver.)

## Como o app usa
Em `SuprimentosContagemDia.jsx`, depois de inserir o job em `suprimentos_bot_jobs`, o app chama:
```js
supabase.functions.invoke("dispatch-bot", {
  body: { tipo: "diaria", data_alvo: "2026-05-28" },
});
```
- Se der certo, o workflow `bot-estoque-diaria.yml` roda agora.
- Se der errado (token expirado, sem rede, etc.), o cron de 5 min ainda vai pegar o job.

## Teste manual
```bash
curl -X POST \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"tipo":"diaria","data_alvo":"2026-05-28"}' \
  https://wboelthngddvkgrvwkbu.functions.supabase.co/dispatch-bot
```
