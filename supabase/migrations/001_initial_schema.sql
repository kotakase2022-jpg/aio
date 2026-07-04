create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null default 'AIO Article Project',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.article_inputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  input_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.competitor_research (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  research_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.authors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text,
  title text,
  bio text,
  image_url text,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.article_drafts (
  id uuid primary key,
  project_id uuid references public.projects(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  input_payload jsonb not null,
  fetched_references jsonb not null default '[]'::jsonb,
  fetched_competitors jsonb not null default '[]'::jsonb,
  competitor_research jsonb,
  ai_result jsonb not null,
  edited_title text not null,
  edited_slug text not null,
  edited_meta_description text,
  edited_body_html text not null,
  faq_items jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  categories text[] not null default '{}',
  generated_image_urls text[] not null default '{}',
  author_payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'approved', 'posted', 'failed')),
  wordpress_post_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.article_images (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.article_drafts(id) on delete cascade,
  slot text not null check (slot in ('featured', 'inline-1', 'inline-2')),
  image_url text not null,
  storage_path text,
  prompt text,
  alt_text text,
  source text not null default 'generated' check (source in ('generated', 'uploaded')),
  created_at timestamptz not null default now()
);

create table if not exists public.wordpress_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  site_url text not null,
  username text not null,
  encrypted_application_password text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wordpress_posts (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.article_drafts(id) on delete cascade,
  connection_id uuid not null references public.wordpress_connections(id) on delete cascade,
  post_url text,
  post_status text not null check (post_status in ('draft', 'publish')),
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.article_inputs enable row level security;
alter table public.competitor_research enable row level security;
alter table public.article_drafts enable row level security;
alter table public.article_images enable row level security;
alter table public.authors enable row level security;
alter table public.wordpress_connections enable row level security;
alter table public.wordpress_posts enable row level security;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.projects to authenticated, service_role;
grant select, insert, update, delete on public.article_inputs to authenticated, service_role;
grant select, insert, update, delete on public.competitor_research to authenticated, service_role;
grant select, insert, update, delete on public.article_drafts to authenticated, service_role;
grant select, insert, update, delete on public.article_images to authenticated, service_role;
grant select, insert, update, delete on public.authors to authenticated, service_role;
grant select, insert, update, delete on public.wordpress_connections to authenticated, service_role;
grant select, insert, update, delete on public.wordpress_posts to authenticated, service_role;

create policy "users manage own projects"
on public.projects
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users manage own article inputs"
on public.article_inputs
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users manage own competitor research"
on public.competitor_research
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users manage own drafts"
on public.article_drafts
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users read images for own drafts"
on public.article_images
for select
to authenticated
using (
  exists (
    select 1 from public.article_drafts
    where article_drafts.id = article_images.draft_id
    and article_drafts.user_id = (select auth.uid())
  )
);

create policy "users manage own authors"
on public.authors
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users manage own wordpress connections"
on public.wordpress_connections
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users read own wordpress posts"
on public.wordpress_posts
for select
to authenticated
using (
  exists (
    select 1 from public.article_drafts
    where article_drafts.id = wordpress_posts.draft_id
    and article_drafts.user_id = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public)
values ('article-assets', 'article-assets', true)
on conflict (id) do nothing;

create policy "authenticated users upload article assets"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'article-assets');

create policy "public read article assets"
on storage.objects
for select
to public
using (bucket_id = 'article-assets');
