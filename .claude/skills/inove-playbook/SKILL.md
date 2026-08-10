---
name: inove-playbook
description: >
  Playbook vivo de convenções, gotchas e lições aprendidas do projeto INOVE (e do Farol).
  CONSULTE esta skill ANTES de agir em QUALQUER tarefa do INOVE — especialmente antes de
  criar/alterar tabela ou migration, mexer em RLS/policies/grants, dar deploy, lidar com
  datas/fuso horário, adicionar uma página nova, ou verificar uma mudança. Ela existe
  justamente para não repetir erros já cometidos (ex.: reabrir buraco de RLS concedendo a
  `anon`, ou gerar data errada com `toISOString()`). Use mesmo que o usuário não peça
  explicitamente — se a tarefa toca no banco, no deploy, no fuso ou na estrutura do app,
  leia a seção relevante primeiro. É um documento VIVO: sempre que descobrir uma nova
  convenção ou o usuário corrigir algo, adicione a lição aqui.
---

# INOVE — Playbook

Este é o conhecimento acumulado de trabalhar no INOVE. **Leia a seção relevante antes de agir**, não depois de errar. Cada regra tem o **porquê** — entenda a razão, não decore.

Projeto: app de gestão operacional (React + Vite + Supabase), usado pela operação de uma empresa de ônibus. Dono: Guilherme (não-técnico). Repo principal: `C:\Users\Guilh\Repositorios\Sistemas\INOVE`.

## Como usar esta skill

1. Identifique em qual área a tarefa cai (banco, deploy, fuso, página nova, verificação, segurança, Farol).
2. Leia a seção correspondente **antes** de escrever código ou rodar comando.
3. Ao terminar, se aprendeu algo novo (ou o usuário corrigiu você), **adicione a lição** na seção certa, com o porquê e a data. Ver "Registrando novas lições" no fim.

---

## 1. Banco, Migrations e RLS  ⚠️ (área que mais deu erro)

- **Migrations são aplicadas À MÃO, não por `db push`.** O histórico do CLI **não bate** com o banco (as tabelas já existem, aplicadas manualmente). Rodar `supabase db push` tentaria reaplicar 40+ migrations e daria conflito. **Nunca** use `db push`.
- **Para rodar DDL no banco remoto** (GRANT, POLICY, ALTER, etc.), use:
  ```bash
  echo "SEU SQL;" | "/c/Users/Guilh/AppData/Local/supabase-cli/node_modules/.bin/supabase" db query --linked
  ```
  `--linked` mira no projeto remoto usando o token da CLI, **sem pedir senha**. (`db query` sem `--linked` conecta no banco LOCAL — não é o que você quer.)
- **RLS: o acesso `anon` foi TRANCADO na "Fase 1".** A maioria das tabelas retorna 401 para a anon key. **NUNCA** conceda `anon` numa tabela nova — nem `grant ... to anon`, nem `policy ... to anon`. Isso **reabre buraco de segurança**. Já aconteceu 2x: `atestados` e `reservas_motoristas` (que eu mesmo criei copiando o padrão antigo) ficaram legíveis/graváveis sem login. Dado sensível (CID de atestado = LGPD).
- **⚠️ Tabela nova nasce com anon liberado (DEFAULT PRIVILEGES).** No Supabase, ao criar QUALQUER tabela no schema `public`, o Postgres concede grants a `anon` automaticamente (default privileges). Conceder só a `authenticated` **NÃO fecha o anon** — é preciso **revogar o anon explicitamente**, senão a tabela fica legível/gravável sem login (aconteceu com `atestados` E com `reservas_motoristas`, que eu criei "certo" e mesmo assim vazou). **Sempre teste depois** com a anon key: tem que dar 401.
- **Padrão correto de tabela nova:**
  ```sql
  alter table public.<tabela> enable row level security;
  drop policy if exists "auth <tabela>" on public.<tabela>;
  create policy "auth <tabela>" on public.<tabela>
    for all to authenticated using (true) with check (true);
  revoke all on public.<tabela> from anon;                                  -- ESSENCIAL
  grant select, insert, update, delete on public.<tabela> to authenticated;
  notify pgrst, 'reload schema';
  ```
  Só `authenticated`. Nunca `anon` — e o `revoke ... from anon` é obrigatório.
- **Teste de fechamento (sempre):** `curl` na tabela com a **anon key** pública → deve dar **401**; com a **service key** → 200. Se anon der 200, tem buraco: `revoke all on public.<tabela> from anon`.
- **`ENABLE ROW LEVEL SECURITY` sem policy = tabela trava** (nem o dono logado acessa). Sempre criar a policy junto.
- **Dívida estrutural conhecida:** todas as policies são `using(true)` → qualquer usuário logado lê/escreve **tudo** (sem filtro por perfil/empresa). O `canUserAccessPath` do frontend é só cosmético; o banco não o aplica. O fix de verdade (server-side / JWT com claims) é projeto à parte — ver memória `inove-rls-auth-bloqueio`.
- **Consultar dados para auditoria/simulação:** REST com a **service_role key** (bypassa RLS). Projeto Supabase: `wboelthngddvkgrvwkbu.supabase.co`. Para **testar exposição** (o que um estranho vê), use a **anon key** pública.
- **Nunca** colar service_role key no repo/bundle. Ela já está em texto puro no `.claude/settings.local.json` e `.bat` (dívida pendente de rotacionar).
- Tabela de usuários = `usuarios_aprovadores` (senha em texto puro, mas não legível por anon — ver memória).

## 2. Deploy

- **Tudo roda do branch `main`** (Render faz auto-deploy; as GitHub Actions agendadas leem o branch default = `main`). Para uma correção entrar em produção, precisa estar no `main`.
- **Fluxo de deploy seguro (worktree isolado):** o working tree local tem MUITAS mudanças não relacionadas — **nunca** `git add -A` / commit de tudo. Faça:
  ```bash
  git fetch origin main --quiet
  git worktree add <tmp>/wt-x -b deploy/x origin/main --quiet
  cp <arquivo alterado> <tmp>/wt-x/<mesmo caminho>   # só os arquivos da mudança
  cd <tmp>/wt-x && git add <arquivos> && git commit -m "..." && git push origin HEAD:main
  # depois: git worktree remove <tmp>/wt-x --force && git branch -D deploy/x
  ```
- **Push abre janela de autenticação** (Git Credential Manager) — rode o push com `run_in_background: true` e espere a notificação; confirme lendo o arquivo de output (`f...a HEAD -> main`).
- `origin/main` pode avançar entre o fetch e o push (outros commits) — o push fast-forward acomoda; só confirme o range depois.
- Fechar o commit com: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Migrations: subir o **arquivo** SQL no repo NÃO cria a tabela — é preciso aplicar no banco (`db query --linked`, seção 1) ou o dono roda. Diga isso claramente ao entregar.

## 3. Datas e Fuso Horário  ⚠️

- **Nunca use `new Date().toISOString()` para uma data local.** Ele devolve **UTC**; como o Brasil é **UTC-3**, das ~21h à meia-noite a data "de hoje" vira a de **amanhã**. Isso já bugou o PCM (nascia no dia seguinte e a herança vinha vazia).
- **Helper de fuso local (BRT):**
  ```js
  function toISODateLocal(d) {
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60 * 1000);
    return local.toISOString().slice(0, 10);
  }
  ```
- O bug de UTC ainda existe em **~40 pontos** do código. Ao mexer em qualquer coisa com data, cheque se está usando o helper local.
- Ao exibir timestamps: `toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })`.

## 4. Adicionar uma página / módulo novo

Para uma página aparecer e ser gated corretamente, mexa em **3 lugares** (o Atestados/Reservas são bons moldes):
1. **`src/utils/accessCatalog.js`** — registre a página (`{ key, label, category, path, patterns }`) e adicione a `key` nos perfis que devem ver (ex.: onde tem `pessoas_atestados`). Sem registrar, o gating fica inconsistente.
2. **`src/App.jsx`** — import lazy + `<Route path="/x" element={<X/>} />`.
3. **`src/components/Sidebar.jsx`** — item no submenu certo + incluir no `path.startsWith(...)` que abre o grupo.
- Rotas são protegidas por `RequireAuth` (exige login). Migration da tabela: seção 1.

## 5. Verificação (como testo sem conseguir logar)

- **Não entro com senha** → rotas protegidas não abrem para mim. Então verifico assim:
  1. **Sintaxe/compilação** por arquivo: `node node_modules/esbuild/bin/esbuild <file> --loader:.jsx=jsx --jsx=automatic --format=esm --outfile=/dev/null`.
  2. **Lógica** contra o banco real: puxo os mesmos dados com a service key e **reproduzo a lógica** em Python/Node (ex.: validei a aba Recapados assim — os 4 fogos e o carro 222410 bateram).
  3. **Build/console** via dev server: `preview_start` (name do `.claude/launch.json`) → `preview_logs level=error` + `read_console_messages onlyErrors`. A tela em si fica no login, mas pega erro de import/build.
- Seja honesto no relato: "compila e a lógica bate no banco; teste visual logado não fiz".

## 6. Componentes grandes (cuidado ao editar)

- `src/pages/pcm/PCMControlePneus.jsx` (~1700 linhas) e o `Copiloto.jsx` do Farol (~2000) são enormes. No Controle de Pneus, cada **aba** se ramifica em ~6 lugares (KPIs, filtro de status, contador "Exibindo", tabela, export Excel). Adicionar aba nova = tocar em **todos** — faça branches cirúrgicos e confira cada ternário.

## 6.1. Preventivas (PCM) — lógica de cálculo  ⚠️

- **Arquivos:** `src/pages/pcm/PCM_PreventivasPlano.jsx` (página) + `src/pages/pcm/preventivasLogic.js` (cálculo puro, porta do gerador Python). Os dados vêm de `ultimo_plano` do **outro** projeto Supabase (IMPORTACAO_DADOS) via `puxarUltimoPlano()` de `../../supabaseDados` — não é o projeto INOVE.
- **⚠️ Sinal do `km_para_proxima` (`kmp`) é invertido:** **`v >= 0` = JÁ VENCIDO**; `v < 0` = **faltam `-v` km**. Igual para planos por prazo (`dias_vencido`): `>= 0` vencido. Errar esse sinal inverte toda a lógica de "vencido/falta".
- **km/dia do carro** = mediana de `km_rodado / dias_vencido` só de planos com `dias_vencido > 30` (ritmo real). **Odômetro** = `nr_hodometro + km_rodado` (máx entre planos).
- **"O que trocar junto na revisão" (regra do dono):** entra todo satélite **vencido OU a ≤ `WINDOW_KM` (3.000) km** de vencer → condição `v >= -WINDOW_KM`. Tacógrafo (plano por prazo) entra se **≤ 15 dias** (`v >= -15`). **Não** é "só vencido" — já corrigimos isso no `duePorCarro` (antes usava só `c.venc`). O `precisa()` da `montarProgramacao` é a referência da regra.
- **A Programação da Semana virou MANUAL** (tabela `preventivas_programacao`, projeto INOVE). A `montarProgramacao` (fila automática 3×10k + 3×5k/dia) ainda existe em `preventivasLogic.js` mas **não é mais usada pela tela** — serve de referência da regra. O "feito" é automático (casa com a tabela `preventivas` realizada por prefixo+data).
- **Gap de dado conhecido:** "Pastilha/Fluido Freio" está na regra do dono mas **não tem coluna** em `GERENCIAL_COLS` (sem `id_plano`), então não entra no "o que trocar" até mapearem o id.

## 7. Farol (app separado, embutido no INOVE)

- Repo próprio: `C:\Users\Guilh\Repositorios\Sistemas\FAROL`, remote `github.com/GuilhermeCSC13/FAROL_TATICO` (**conta diferente** da do INOVE). `web/` (React+Vite) + `server/` (Express+TS). Embutido no INOVE via iframe (`FAROL_URL` em `Layout.jsx`). Detalhes: memória `farol-repo`.
- Push do Farol usa as credenciais da conta `GuilhermeCSC13`.

## Registrando novas lições (documento vivo)

Sempre que:
- o usuário te **corrigir** ("não é assim, é assado"),
- você **descobrir** uma convenção/gotcha (um comando que funciona, um padrão do banco, um bug recorrente),
- ou perceber que **repetiu um erro** que já tinha aparecido,

→ **adicione a lição aqui**, na seção certa, em 1-2 linhas, com o **porquê**. Se for específico de uma data/decisão, date. O valor desta skill é crescer: cada erro vira uma regra que evita o próximo.
