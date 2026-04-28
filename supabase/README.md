# Supabase Organization

Este diretório organiza o banco por dominio de negocio, da forma mais proxima possivel de "pastas" no Supabase.

## Limite real do Supabase/Postgres

No banco nao existe pasta de tabela como no frontend. O equivalente correto e:

- `schemas` para separar dominios grandes
- convencao de nomes para tabelas, views, functions e buckets
- `migrations` pequenas e previsiveis
- documentacao por dominio

## Estrutura proposta

- `domains/shared`: objetos comuns e lookup tables
- `domains/auth`: identidade, perfis, onboarding e permissao
- `domains/avarias`: avarias, cobrancas e chamados
- `domains/checklists`: checklists e itens
- `domains/diesel`: acompanhamento diesel, tratativas e analytics
- `domains/embarcados`: ativos embarcados, movimentacoes e reparos
- `domains/estrutura_fisica`: solicitacoes e historico de estrutura fisica
- `domains/intervencoes`: SOS, km rodado e manutencao associada
- `domains/pcm`: preventivas, pcm diario e veiculos pcm
- `domains/tratativas`: tratativas gerais e RH
- `domains/multiempresa`: empresa, tenancy e isolamento por empresa

## Como usar

1. Toda mudanca nova no banco deve nascer com um dominio definido.
2. Cada migration deve mencionar o dominio no nome do arquivo.
3. Cada tabela existente deve ser mapeada para um dominio antes de refactor ou exclusao.
4. Quando fizer sentido, tabelas devem sair de `public` e migrar para `schemas` por dominio.
5. RLS, grants, views e functions devem ser revisados por dominio, nunca de forma aleatoria.

## Convencao de migration

Formato recomendado:

`YYYYMMDDHHMMSS_<dominio>_<acao_curta>.sql`

Exemplos:

- `202604281130_auth_profiles_hardening.sql`
- `202604281145_diesel_split_public_views.sql`
- `202604281200_multiempresa_add_empresa_id.sql`

## Proximos passos

- Classificar as 54 tabelas/views mapeadas no inventario por dominio.
- Definir o que continua em `public` e o que vai para schema dedicado.
- Criar uma migration-base de organizacao por schemas.
- Migrar o acesso do frontend para uma camada mais previsivel por dominio.
