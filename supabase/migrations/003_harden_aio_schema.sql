drop policy if exists "public read article assets" on storage.objects;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public;
    revoke execute on function public.rls_auto_enable() from anon;
    revoke execute on function public.rls_auto_enable() from authenticated;
  end if;
end $$;

create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists article_inputs_project_id_idx on public.article_inputs(project_id);
create index if not exists article_inputs_user_id_idx on public.article_inputs(user_id);
create index if not exists competitor_research_project_id_idx on public.competitor_research(project_id);
create index if not exists competitor_research_user_id_idx on public.competitor_research(user_id);
create index if not exists authors_user_id_idx on public.authors(user_id);
create index if not exists article_drafts_project_id_idx on public.article_drafts(project_id);
create index if not exists article_drafts_user_id_idx on public.article_drafts(user_id);
create index if not exists article_images_draft_id_idx on public.article_images(draft_id);
create index if not exists wordpress_connections_user_id_idx on public.wordpress_connections(user_id);
create index if not exists wordpress_posts_draft_id_idx on public.wordpress_posts(draft_id);
create index if not exists wordpress_posts_connection_id_idx on public.wordpress_posts(connection_id);
