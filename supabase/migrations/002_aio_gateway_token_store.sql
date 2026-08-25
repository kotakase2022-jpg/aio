create table if not exists public.aio_gateway_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.aio_gateway_tokens enable row level security;
revoke all on public.aio_gateway_tokens from anon, authenticated;
grant select, insert, update, delete on public.aio_gateway_tokens to service_role;

create policy "deny client gateway token access"
on public.aio_gateway_tokens
for all
to anon, authenticated
using (false)
with check (false);
