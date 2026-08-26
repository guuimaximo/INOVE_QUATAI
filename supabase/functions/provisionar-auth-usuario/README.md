# provisionar-auth-usuario

Provisiona a conta no Supabase Auth (`auth.users`) de **um** usuário legado de
`usuarios_aprovadores`, para que ele consiga logar como `authenticated` e a RLS
libere os dados.

## Por que existe

Todo usuário novo nasce só em `usuarios_aprovadores` com `auth_user_id = null`.
Sem conta no Auth, o login cai no modo de contingência (`anon`) e, com a RLS
Fase 1 trancando o anon, **não carrega nada** (telas vazias / 401). Antes isso
era corrigido rodando `scripts/migrar_auth_legados.mjs` na mão; esta função faz
o mesmo, automaticamente, quando o admin **aprova/ativa** o usuário.

## Como é chamada

`src/pages/configuracoes/Usuarios.jsx` → `garantirContaAuth(row)` →
`supabase.functions.invoke("provisionar-auth-usuario", { body: { usuario_id } })`
ao marcar o cadastro como **Aprovado** ou ao **ativar** o usuário.

Idempotente: se já tem `auth_user_id`, responde `status: "ja_vinculado"` e não
faz nada.

## Segurança

- `verify_jwt` ON (default): só roda com caller autenticado.
- Usa a `service_role` (injetada) **só no servidor**.
- Cria a conta com o **mesmo e-mail e a mesma senha** que o usuário já usa,
  `email_confirm: true` → **não dispara e-mail**.
- Só provisiona quem tem e-mail real (não `@inove.local`) e senha ≥ 6.

## Deploy

```bash
"/c/Users/Guilh/AppData/Local/supabase-cli/node_modules/.bin/supabase" \
  functions deploy provisionar-auth-usuario --project-ref wboelthngddvkgrvwkbu
```

Nenhum secret extra: `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` já vêm do projeto.
