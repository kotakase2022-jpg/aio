-- For a disposable local PostgreSQL only (never a Supabase project): minimal stand-ins for the
-- Supabase-managed roles and schemas that supabase/migrations reference, so the migrations and
-- the SQL fixtures in this directory can run on a plain PostgreSQL. See docs/testing.md.
do $$
begin
  if exists (select 1 from pg_namespace where nspname in ('auth', 'storage')) then
    raise exception 'supabase-stub.sql is only for a disposable local database';
  end if;
  -- Roles are shared by every database of the cluster.
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
