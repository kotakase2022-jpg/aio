-- Run after the migration in one BEGIN / ROLLBACK transaction. Never COMMIT this fixture.
do $verify$
declare
  draft_id uuid := gen_random_uuid();
  payload jsonb;
  rejected boolean := false;
begin
  payload := jsonb_build_object(
    'id', draft_id, 'input_payload', '{}'::jsonb, 'ai_result', '{}'::jsonb,
    'fetched_references', '[]'::jsonb, 'fetched_competitors', '[]'::jsonb,
    'edited_title', 'Disposable atomicity probe', 'edited_slug', 'disposable-probe',
    'edited_body_html', '<p>Original</p>', 'faq_items', '[]'::jsonb,
    'tags', '[]'::jsonb, 'categories', '[]'::jsonb, 'generated_image_urls', '[]'::jsonb,
    'author_payload', '{}'::jsonb, 'status', 'draft', 'updated_at', now()
  );
  perform public.aio_save_draft(payload, '[]'::jsonb);
  begin
    perform public.aio_save_draft(payload || '{"status":"approved","edited_body_html":"changed"}',
      jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'draft_id', draft_id,
        'slot', 'invalid-slot', 'image_url', 'https://example.com/test.png', 'source', 'generated')));
  exception when check_violation then
    rejected := true;
  end;
  if not rejected or not exists (select 1 from public.article_drafts d
      where d.id = draft_id and d.status = 'draft' and d.edited_body_html = '<p>Original</p>') then
    raise exception 'Atomicity verification failed';
  end if;
  rejected := false;
  begin
    perform public.aio_save_draft(payload, '[]'::jsonb, '2000-01-01'::timestamptz);
  exception when serialization_failure then
    rejected := true;
  end;
  if not rejected then raise exception 'Revision verification failed'; end if;
  if has_function_privilege('anon', 'public.aio_save_draft(jsonb,jsonb,timestamptz)', 'execute')
    or has_function_privilege('authenticated', 'public.aio_save_draft(jsonb,jsonb,timestamptz)', 'execute')
    or not has_function_privilege('service_role', 'public.aio_save_draft(jsonb,jsonb,timestamptz)', 'execute') then
    raise exception 'Function privileges verification failed';
  end if;
end;
$verify$;
select 'PASS: atomic rollback, revision guard, service-role-only execution' as verification;
