# Governanca de Seguranca e Escalabilidade - INOVE_QUATAI

Data da revisao: 2026-04-28

## Escopo revisado

- Repositorio Git local: `C:\Users\Guilh\AppData\Local\Temp\INOVE_QUATAI`
- GitHub remoto: `guuimaximo/INOVE_QUATAI`
- Projeto Supabase vinculado: `wboelthngddvkgrvwkbu` (`INOVEQUATAI`)
- App frontend: React + Vite
- Banco revisado: schema `public`, RLS, policies, views, funcoes `SECURITY DEFINER`, storage buckets

## Resumo executivo

O sistema ainda nao esta pronto para ser ofertado para outras empresas com seguranca maxima.

Os dois maiores bloqueios sao:

1. O frontend ainda contem fluxo legado de autenticacao lendo `usuarios_aprovadores.senha` diretamente do banco.
2. A modelagem e a seguranca ainda nao estao preparadas para multiempresa real. Nao existe discriminador de tenant/empresa no schema `public`, e o codigo mistura pelo menos duas bases Supabase (`INOVE` e `BCNT`) direto no cliente.

Em paralelo, o repositorio GitHub e publico, o app preve uso de `VITE_GITHUB_TOKEN` no browser, e a maior parte da schema `public` esta exposta com grants amplos enquanto 49 de 54 tabelas publicas estao sem RLS ativo.

## O que foi revisado

### Supabase

- Inventario de tabelas do schema `public`
- Colunas de tabelas criticas de autenticacao, tratativas, SOS, avarias, preventivas e profiles
- Grants para `anon` e `authenticated`
- Policies e status de RLS
- Views expostas
- Funcoes `SECURITY DEFINER`
- Storage buckets e exposicao publica

### GitHub

- Visibilidade do repositorio
- Branches e PRs recentes
- Workflow de GitHub Actions
- Segredos e padrao de integracao com GitHub a partir do frontend

### Codigo / Vite

- Entry points
- Cliente Supabase principal e cliente secundario `supabaseBCNT`
- Fluxos de login e cadastro
- Uso de storage publico
- Arquivos duplicados e candidatos a codigo morto
- Acoplamentos com URLs externas publicas

## Findings criticos (P0)

### P0.1 - Login legado inseguro no frontend

Arquivo principal:

- `src/pages/auth/Login.jsx`

Problema:

- o login faz `select(*)` em `usuarios_aprovadores`
- compara `senha` direto no frontend
- grava sessao em `localStorage`
- o reset de senha nao usa o fluxo oficial do Supabase Auth

Impacto:

- vazamento de credenciais legadas
- impossibilidade de endurecer seguranca de auth de forma confiavel
- alta superficie para abuso via `anon`/`authenticated`

Decisao:

- bloquear o login legado
- migrar 100% para `supabase.auth.signInWithPassword`
- remover `senha` da tabela `usuarios_aprovadores`

### P0.2 - `usuarios_aprovadores` contem senha legada

Tabela:

- `public.usuarios_aprovadores`

Problema:

- coluna `senha` ainda existe
- a tabela e amplamente lida no app
- existem grants amplos e policies permissivas

Impacto:

- risco direto de exposicao de credenciais
- dificulta auditoria e LGPD
- inviabiliza oferta segura para outras empresas

Decisao:

- congelar qualquer novo uso da coluna `senha`
- migrar todos os usuarios para Auth
- remover `senha` do schema apos migracao controlada

### P0.3 - Exposicao sistemeica da schema `public`

Evidencia:

- 54 tabelas publicas
- 5 com RLS ativo
- 49 com RLS desligado
- 66 objetos em `public` com grants para `anon`

Impacto:

- acesso excessivo a leitura e escrita
- risco de vazamento transversal entre modulos
- alto risco se o app for replicado para outras empresas

Decisao:

- revisar grants da schema `public`
- ativar RLS por dominio
- trocar "allow all" por policies minimas por papel e por tenant

### P0.4 - `auth_emails_view` exposta

Objeto:

- `public.auth_emails_view`

Problema:

- a view faz `SELECT id, email FROM auth.users`
- advisors do Supabase marcaram isso como erro de seguranca

Impacto:

- exposicao indevida de dados de autenticacao

Decisao:

- remover a view ou restringir acesso imediatamente

### P0.5 - Segredo de GitHub no frontend

Arquivos:

- `src/components/desempenho/ModalCheckpointAnalise.jsx`
- `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx`
- `src/pages/desempenho-diesel/DesempenhoDieselAnalise.jsx`
- `src/pages/desempenho-diesel/DesempenhoLancamento.jsx`

Problema:

- o app espera `VITE_GITHUB_TOKEN`
- variaveis `VITE_*` sao embutidas no bundle do navegador
- o cliente monta chamada `fetch` para a API do GitHub com `Authorization: Bearer`

Impacto:

- se esse token estiver configurado na publicacao, ele fica exposto ao usuario final
- risco de abuso no repo e nos workflows

Decisao:

- remover `VITE_GITHUB_TOKEN` do frontend
- mover qualquer disparo de workflow para backend seguro ou Edge Function

### P0.6 - Repositorio GitHub publico

Repositorio:

- `guuimaximo/INOVE_QUATAI`

Problema:

- o repositorio esta com visibilidade `public`

Impacto:

- qualquer padrao inseguro de integracao, fluxo de auth ou estrutura interna fica publicamente auditavel
- se existir deploy com secrets mal posicionados, o risco aumenta

Decisao:

- se o sistema vai escalar para uso comercial, considerar repositorio privado ou split entre app publico e modulos internos privados

## Findings altos (P1)

### P1.1 - Buckets publicos demais

Buckets atuais com `public = true`:

- `atas_diesel`
- `avarias`
- `avarias-chamados`
- `avarias-terceiros`
- `diesel`
- `diesel_tratativas`
- `embarcados`
- `estrutura_fisica`
- `relatorios`
- `tratativas`
- `tratativas-avarias`

Ha volume relevante de objetos, por exemplo:

- `tratativas`: 2642 objetos
- `relatorios`: 2340 objetos
- `avarias`: 271 objetos

Impacto:

- anexos, relatorios e evidencias ficam acessiveis por URL publica
- risco de vazamento operacional e pessoal

Decisao:

- revisar bucket por bucket
- tornar privados os buckets sensiveis
- emitir URLs assinadas quando necessario

### P1.2 - Views com `SECURITY DEFINER`

Views sinalizadas:

- `public.vw_sos_consolidado`
- `public.vw_sos_analitico`
- `public.v_embarcados_central`
- `public.v_diesel_acompanhamentos_ciclo`

Impacto:

- podem executar com privilegios do criador, nao do usuario consultante

Decisao:

- revisar se precisam mesmo de `SECURITY DEFINER`
- se mantidas, restringir grants e revisar RLS das tabelas base

### P1.3 - Integracao cross-base no frontend

Arquivos:

- `src/supabaseBCNT.js`
- `src/pages/checklists/ChecklistCentral.jsx`
- `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx`
- `src/pages/desempenho-diesel/DesempenhoDieselResumo.jsx`

Problema:

- o browser acessa uma segunda base Supabase via `VITE_SUPA_BASE_BCNT_URL`
- isso mistura dados de dominios/empresas no cliente

Impacto:

- acoplamento operacional
- dificuldade de governanca
- aumenta risco de vazamento cruzado entre empresas

Decisao:

- remover acesso cross-base do cliente
- centralizar integracao por backend, ETL ou camada de sync governada

### P1.4 - Workflow do GitHub Actions aparenta obsoleto/quebrado

Arquivo:

- `.github/workflows/etl-pipeline.yml`

Problemas:

- dispara em `pipeline/**`, mas o codigo atual esta em `src/pipeline/**`
- executa `python pipeline/etl_motorista_athena.py`, mas o arquivo atual esta em `src/pipeline/etl_motorista_athena.py`
- instala `requirements.txt` na raiz, mas o arquivo atual esta em `src/pipeline/requirements.txt`

Impacto:

- pipeline pode nao rodar
- falsa sensacao de automacao ativa

Decisao:

- corrigir caminhos ou arquivar o workflow

## Findings medios (P2)

### P2.1 - Codigo duplicado e provavel codigo morto

Arquivos candidatos:

- `src/AuthContext.jsx`
- `src/components/RequireAuth.jsx`
- `src/components/ProtectedRoute.jsx`
- `src/pages/auth/Cadastro.jsx`
- `src/pages/auth/Register.jsx`
- `src/pages/home/Landing.jsx`
- `src/pages/portal/PortalSistemas.jsx`
- `src/routes/premiacaoRoutes.js`

Observacoes:

- o app atual usa `src/context/AuthContext.jsx`
- o app atual usa `src/routes/RequireAuth.jsx`
- `src/routes/premiacaoRoutes.js` e codigo Express dentro de repo Vite frontend
- `Cadastro.jsx` e `Register.jsx` representam fluxos paralelos de cadastro, fora do fluxo principal

Decisao:

- classificar esses arquivos como `ativo`, `legado`, `migrar` ou `remover`
- retirar do repositorio produtivo o que nao participa do build e nao faz parte do roadmap

### P2.2 - Comentarios de refatoracao pendente no entrypoint

Arquivo:

- `src/main.jsx`

Problema:

- comentarios de "comentar AuthProvider" ainda ficaram no entrypoint

Impacto:

- baixo risco tecnico
- sinal de migracao incompleta

### P2.3 - Indices e constraints duplicados

Casos sinalizados:

- `diesel_acompanhamentos`
- `diesel_checklist_itens`
- `diesel_checklist_respostas`
- `motoristas`
- `tratativas_rh`
- `usuarios_aprovadores`

Impacto:

- custo extra de escrita
- ruido operacional
- historico de migracoes sobrepostas

## Candidatos a obsolescencia no banco

Objetos com `0` referencias diretas no `src/` atual do frontend:

- `auth_emails_view`
- `fato_kml_meta_ponderada_dia`
- `historico_tratativas`
- `ia_prompts`
- `metas_consumo`
- `monitoramento_limites`
- `sos_debug_insert_log`
- `tipos_acao`
- `tratativas_rh_eventos`
- `tratativas_rh_lancamentos`
- `tratativas_rh_lancamentos_itens`
- `v_diesel_fila_prontuarios`
- `v_embarcados_ativos`
- `v_embarcados_reserva`
- `v_pessoas_aprovadores`
- `vw_sos_analitico`
- `vw_sos_com_preventiva`
- `vw_sos_consolidado`

Importante:

- `0` referencia no frontend nao significa "pode apagar"
- esses objetos podem estar em uso por SQL, ETL, dashboards externos ou processos manuais

Acao correta:

- marcar como `sem referencia no frontend`
- confirmar dependencia por logs, queries, workflows, dashboards e usuarios internos antes de excluir

## Multiempresa e escalabilidade

### Diagnostico atual

Hoje o sistema esta mais proximo de um produto single-tenant customizado do que de uma plataforma multiempresa.

Evidencias:

- nao encontrei colunas como `tenant_id`, `empresa_id`, `filial_id` ou equivalente no schema `public`
- ha branding fixo de Quatai no frontend
- ha uso de uma segunda base (`BCNT`) direto no browser
- nao existe isolamento explicito por empresa em policies de RLS

### Conclusao

Se voces querem que a Quatai seja a empresa `046` e que outras empresas entrem depois, o correto e assumir isso como refatoracao estrutural, nao so como configuracao.

### Modelo recomendado

Criar uma camada de tenancy explicita:

- tabela `empresas`
- identificador estavel: `empresa_id` ou `codigo_empresa`
- tabela `users_empresas` ou coluna `empresa_id` em `profiles`
- todas as tabelas de negocio com `empresa_id`
- policies RLS sempre filtrando por `empresa_id`

Exemplo de regra alvo:

- usuario autenticado so enxerga linhas da propria empresa
- administradores globais so existem via papel separado
- anexos e buckets tambem respeitam `empresa_id`

## Roadmap recomendado

### Fase 0 - Contencao imediata

1. Remover qualquer uso de `VITE_GITHUB_TOKEN` do frontend
2. Tornar o repositorio privado ou revisar imediatamente o que esta publico
3. Desabilitar ou proteger `auth_emails_view`
4. Mapear e reduzir grants de `anon` na schema `public`
5. Congelar criacao de novos fluxos usando `usuarios_aprovadores.senha`

### Fase 1 - Migracao de autenticacao

1. Fechar o login legado
2. Migrar para Supabase Auth em 100% dos fluxos
3. Usar `profiles` como fonte principal de identidade e papeis
4. Eliminar `localStorage` como fonte de autorizacao
5. Remover `senha` de `usuarios_aprovadores`

### Fase 2 - Endurecimento do banco

1. Ativar RLS nas tabelas publicas sensiveis
2. Reescrever policies permissivas
3. Revisar `SECURITY DEFINER`
4. Revisar buckets publicos e trocar para signed URLs onde necessario
5. Limpar indices e constraints duplicados

### Fase 3 - Governanca de codigo

1. Classificar codigo `ativo / legado / remover`
2. Remover arquivos mortos e fluxos paralelos
3. Separar frontend de eventuais rotas backend
4. Corrigir workflow ETL e documentar ownership
5. Padronizar nomes de arquivos e dominios por modulo

### Fase 4 - Preparacao multiempresa

1. Introduzir `empresa_id` no modelo
2. Backfill dos dados da Quatai com codigo `046`
3. Ajustar RLS para isolamento por empresa
4. Remover integracoes cross-base do browser
5. Criar configuracao de branding por empresa

### Fase 5 - Operacao comercial

1. Ambientes separados por `dev`, `staging`, `prod`
2. Backups, auditoria e rotacao de secrets
3. revisao de storage e retention
4. observabilidade de auth, SQL e falhas de workflow
5. checklist de onboarding para nova empresa

## Ordem pratica sugerida

1. Auth e `usuarios_aprovadores`
2. Grants + RLS
3. GitHub token no frontend
4. Buckets publicos
5. Multiempresa (`empresa_id`)
6. Remocao de codigo morto
7. Workflow ETL e integracoes externas

## Proximos entregaveis recomendados

1. Matriz `tabela -> owner -> sensibilidade -> RLS -> uso no codigo`
2. Plano SQL de endurecimento
3. Plano de migracao `usuarios_aprovadores -> profiles/auth`
4. Plano de tenancy com `empresa_id = 046` para Quatai
5. Lista de remocao segura de codigo e objetos obsoletos
