# Plano de Clusterizacao do Banco

## Resposta curta

Sim, conseguimos organizar o banco "igual ao codigo", mas tecnicamente isso sera feito por dominio e schema, nao por pasta real dentro do Postgres.

## Modelo recomendado

### Camada 1: dominios no repositrio

Usar `supabase/domains/*` para documentacao, ownership e backlog de migrations.

### Camada 2: schemas no banco

Target recomendado:

- `shared`
- `authz`
- `avarias`
- `checklists`
- `diesel`
- `embarcados`
- `estrutura_fisica`
- `intervencoes`
- `pcm`
- `tratativas`

Observacao:

- `auth` continua sendo schema do Supabase
- `public` deve ficar cada vez mais fino

### Camada 3: convencao de nomes

- tabela operacional: `diesel.acompanhamentos`
- view analitica: `diesel.v_acompanhamentos_ciclo`
- function: `diesel.fn_recalcular_snapshot`
- bucket: `diesel-tratativas` ou `tratativas`

## Ordem segura de implantacao

1. Classificar objetos existentes por dominio.
2. Congelar criacao aleatoria em `public`.
3. Criar schemas novos.
4. Mover primeiro views/functions de baixo risco.
5. Mover tabelas por lotes pequenos.
6. Ajustar policies, grants e codigo consumidor.
7. Adicionar `empresa_id` antes de escalar para terceiros.

## O que ja deixamos pronto no repo

- estrutura `supabase/domains`
- convencao de migrations
- plano-base de clusterizacao

## O que ainda precisa de execucao real

- migration para criar schemas
- mapa tabela -> dominio -> schema alvo
- revisao de grants e RLS por dominio
- migracao do frontend para novos paths de acesso
