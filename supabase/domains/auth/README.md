# Auth

Escopo:

- `profiles`
- `usuarios_aprovadores`
- functions de vinculo auth/profile
- onboarding, aprovacao e papeis

Riscos atuais:

- login legado com `usuarios_aprovadores.senha`
- dependencia de `localStorage`
- mistura entre auth real e fluxo legado

Objetivo:

- migrar 100% para Supabase Auth
- manter tabela legada apenas como transicao, se necessario
