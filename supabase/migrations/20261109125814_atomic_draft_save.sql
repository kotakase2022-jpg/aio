-- One request commits the draft, approval state, and image records together.
create or replace function public.aio_save_draft(
  draft_row jsonb,
  image_rows jsonb,
  expected_updated_at timestamptz default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  draft public.article_drafts;
  existing_updated_at timestamptz;
begin
  draft := jsonb_populate_record(null::public.article_drafts, draft_row);
  if draft.id is null or jsonb_typeof(image_rows) is distinct from 'array' then
    raise exception 'Invalid draft or image payload' using errcode = '22023';
  end if;

  select updated_at into existing_updated_at
    from public.article_drafts where id = draft.id for update;
  if expected_updated_at is not null and existing_updated_at is distinct from expected_updated_at then
    raise exception 'Draft changed; reload the latest revision' using errcode = '40001';
  end if;

  if exists (
    select 1 from jsonb_populate_recordset(null::public.article_images, image_rows) i
    where i.draft_id is distinct from draft.id
  ) or exists (
    select 1 from jsonb_populate_recordset(null::public.article_images, image_rows) i
    join public.article_images saved on saved.id = i.id
    where saved.draft_id <> draft.id
  ) then
    raise exception 'Image belongs to another draft' using errcode = '22023';
  end if;

  insert into public.article_drafts (
    id, input_payload, fetched_references, fetched_competitors, competitor_research,
    ai_result, edited_title, edited_slug, edited_meta_description, edited_body_html,
    faq_items, tags, categories, generated_image_urls, author_payload, status,
    wordpress_post_url, updated_at
  ) values (
    draft.id, draft.input_payload, draft.fetched_references, draft.fetched_competitors, draft.competitor_research,
    draft.ai_result, draft.edited_title, draft.edited_slug, draft.edited_meta_description, draft.edited_body_html,
    draft.faq_items, draft.tags, draft.categories, draft.generated_image_urls, draft.author_payload, draft.status,
    draft.wordpress_post_url, draft.updated_at
  ) on conflict (id) do update set
    input_payload = excluded.input_payload,
    fetched_references = excluded.fetched_references,
    fetched_competitors = excluded.fetched_competitors,
    competitor_research = excluded.competitor_research,
    ai_result = excluded.ai_result,
    edited_title = excluded.edited_title,
    edited_slug = excluded.edited_slug,
    edited_meta_description = excluded.edited_meta_description,
    edited_body_html = excluded.edited_body_html,
    faq_items = excluded.faq_items,
    tags = excluded.tags,
    categories = excluded.categories,
    generated_image_urls = excluded.generated_image_urls,
    author_payload = excluded.author_payload,
    status = excluded.status,
    wordpress_post_url = excluded.wordpress_post_url,
    updated_at = excluded.updated_at;

  insert into public.article_images (id, draft_id, slot, image_url, storage_path, prompt, alt_text, source)
    select id, draft_id, slot, image_url, storage_path, prompt, alt_text, source
    from jsonb_populate_recordset(null::public.article_images, image_rows)
  on conflict (id) do update set
    slot = excluded.slot, image_url = excluded.image_url, storage_path = excluded.storage_path,
    prompt = excluded.prompt, alt_text = excluded.alt_text, source = excluded.source
    where article_images.draft_id = excluded.draft_id;

  if exists (
    select 1 from jsonb_populate_recordset(null::public.article_images, image_rows) i
    join public.article_images saved on saved.id = i.id
    where saved.draft_id <> draft.id
  ) then
    raise exception 'Image belongs to another draft' using errcode = '22023';
  end if;

  delete from public.article_images saved
    where saved.draft_id = draft.id
    and not exists (
      select 1 from jsonb_populate_recordset(null::public.article_images, image_rows) retained
      where retained.id = saved.id
    );
end;
$$;

revoke all on function public.aio_save_draft(jsonb, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.aio_save_draft(jsonb, jsonb, timestamptz) to service_role;
