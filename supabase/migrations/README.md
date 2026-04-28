# Migrations

Todas as migrations devem seguir uma logica de dominio.

Formato:

- `YYYYMMDDHHMMSS_<dominio>_<acao>.sql`

Exemplos:

- `202604281300_avarias_hardening_rls.sql`
- `202604281315_tratativas_private_storage.sql`
- `202604281330_multiempresa_create_empresas.sql`

Checklist minimo por migration:

- objetivo claro
- dominio unico
- impacto em RLS/grants
- rollback mental ou plano de contingencia
