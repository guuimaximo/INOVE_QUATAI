# INOVE — instruções do projeto

App de gestão operacional (React + Vite + Supabase) da operação de ônibus. Deploy: **tudo roda do `main`** (Render auto-deploy; Actions agendadas leem o branch default).

## Antes de agir, consulte a skill `inove-playbook`

Antes de **criar/alterar tabela ou migration, mexer em RLS/policies/grants, dar deploy,
lidar com datas/fuso horário, adicionar página nova, ou verificar uma mudança**, leia a
skill **`inove-playbook`** (`.claude/skills/inove-playbook/SKILL.md`). É um documento
**vivo** com as convenções do projeto e os erros já cometidos — e sempre que você
descobrir uma convenção nova ou o dono corrigir algo, **adicione a lição lá**.

## Regras críticas (rede de segurança, mesmo que a skill não dispare)

- **RLS:** nunca conceda `anon` em tabela/migration nova (`grant ... to anon` ou
  `policy ... to anon`) — o acesso anônimo foi trancado; conceda **só `authenticated`**.
  Reabrir isso expõe dados sem login (já aconteceu com `atestados` — CID/LGPD).
- **Datas:** nunca `new Date().toISOString()` para uma data local — devolve UTC e, depois
  das 21h BRT, vira o **dia seguinte**. Use helper de fuso local (`toISODateLocal`).
- **Deploy:** commite **só os arquivos da mudança**, via worktree a partir de
  `origin/main` — nunca `git add -A` (o working tree tem muita coisa não relacionada).
- **Migrations:** aplicam-se **à mão** (`supabase db query --linked`), nunca `db push`.

Detalhes, comandos exatos e o resto das convenções estão na skill `inove-playbook`.
