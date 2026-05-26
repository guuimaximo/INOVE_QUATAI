-- Serviço Externo: rastreamento de itens que saem da empresa para terceiros
-- com nota de saída (simples remessa) e nota de retorno.

create sequence if not exists public.servico_externo_seq;

create table if not exists public.suprimentos_servico_externo (
  id uuid primary key default gen_random_uuid(),
  numero_saida text not null unique default (
    'SE-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.servico_externo_seq')::text, 5, '0')
  ),
  status text not null default 'Em posse do terceiro'
    check (status in ('Em posse do terceiro', 'Retornado', 'Cancelado')),

  -- Nota de saída (simples remessa)
  nota_saida_numero    text,
  nota_saida_data      date,

  -- Nota de retorno
  nota_retorno_numero  text,
  nota_retorno_data    date,

  -- Terceiro
  terceiro_nome        text not null,
  terceiro_cpf_cnpj    text,
  terceiro_telefone    text,
  terceiro_endereco    text,

  -- Itens enviados (array JSON: [{descricao, quantidade, unidade, numero_serie, obs}])
  itens                jsonb not null default '[]'::jsonb,

  -- Motivo / observações
  motivo               text not null,
  observacao           text,

  -- Cancelamento / retorno
  cancelado_motivo     text,
  cancelado_em         timestamptz,
  retornado_em         timestamptz,
  retornado_obs        text,

  -- Auditor
  criado_por_id        text,
  criado_por_login     text,
  criado_por_nome      text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists se_status_idx
  on public.suprimentos_servico_externo (status, created_at desc);

create index if not exists se_terceiro_idx
  on public.suprimentos_servico_externo (terceiro_nome);

create or replace function public.set_servico_externo_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_se_updated_at on public.suprimentos_servico_externo;
create trigger trg_se_updated_at
  before update on public.suprimentos_servico_externo
  for each row execute function public.set_servico_externo_updated_at();

alter table public.suprimentos_servico_externo enable row level security;

drop policy if exists "se_select" on public.suprimentos_servico_externo;
create policy "se_select"
  on public.suprimentos_servico_externo for select
  to anon, authenticated using (true);

drop policy if exists "se_insert" on public.suprimentos_servico_externo;
create policy "se_insert"
  on public.suprimentos_servico_externo for insert
  to anon, authenticated with check (true);

drop policy if exists "se_update" on public.suprimentos_servico_externo;
create policy "se_update"
  on public.suprimentos_servico_externo for update
  to anon, authenticated using (true) with check (true);

drop policy if exists "se_delete" on public.suprimentos_servico_externo;
create policy "se_delete"
  on public.suprimentos_servico_externo for delete
  to anon, authenticated using (true);

notify pgrst, 'reload schema';
