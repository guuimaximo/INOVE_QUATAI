# Domains

Cada pasta abaixo representa um cluster logico do banco.

Objetivo:

- facilitar handoff
- reduzir acoplamento
- organizar migrations
- preparar a futura separacao por schema

Cada dominio deve manter pelo menos:

- lista de tabelas/views/funcoes do dominio
- riscos de seguranca
- regras de RLS
- backlog de migracoes
