-- Run after the migrations in one BEGIN / ROLLBACK transaction. Never COMMIT this fixture.
-- Verifies aio_complete_generation_job on a real PostgreSQL: a completion commits only while its
-- job is running and younger than 6 minutes, a late or slowed-down one writes nothing, and the
-- editor's own save path (aio_save_draft) is not affected.
create function pg_temp.seed_job(job_status text, age interval) returns public.article_inputs
language sql as $$
  insert into public.article_inputs (id, input_payload, created_at, updated_at)
  select seed.id,
    jsonb_build_object('kind', 'article_generation_job', 'id', seed.id, 'status', job_status, 'steps', '[]'::jsonb),
    clock_timestamp() - age, clock_timestamp() - age + interval '1 second'
  from (select gen_random_uuid() as id) seed
  returning *;
$$;

create function pg_temp.job_row(job public.article_inputs, draft uuid) returns jsonb
language sql as $$
  select jsonb_build_object('id', job.id, 'updated_at', clock_timestamp(),
    'input_payload', job.input_payload || jsonb_build_object('status', 'completed', 'draftId', draft));
$$;

create function pg_temp.draft_row(draft uuid) returns jsonb
language sql as $$
  select jsonb_build_object(
    'id', draft, 'input_payload', '{}'::jsonb, 'ai_result', '{}'::jsonb,
    'fetched_references', '[]'::jsonb, 'fetched_competitors', '[]'::jsonb,
    'edited_title', 'Disposable completion probe', 'edited_slug', 'disposable-completion-probe',
    'edited_body_html', '<p>Generated</p>', 'faq_items', '[]'::jsonb,
    'tags', '[]'::jsonb, 'categories', '[]'::jsonb, 'generated_image_urls', '[]'::jsonb,
    'author_payload', '{}'::jsonb, 'status', 'draft', 'updated_at', clock_timestamp());
$$;

create function pg_temp.image_rows(draft uuid, slot text) returns jsonb
language sql as $$
  select jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'draft_id', draft, 'slot', slot,
    'image_url', 'https://example.com/probe.png', 'source', 'generated'));
$$;

-- Returns 'committed' or the SQLSTATE the call raised (its writes are rolled back with it).
create function pg_temp.complete(job public.article_inputs, draft uuid, expected timestamptz, images jsonb, job_override jsonb default null)
returns text language plpgsql as $$
begin
  perform public.aio_complete_generation_job(coalesce(job_override, pg_temp.job_row(job, draft)), expected, pg_temp.draft_row(draft), images);
  return 'committed';
exception when others then
  return sqlstate;
end;
$$;

-- True when the call left the job row exactly as seeded and created no article.
create function pg_temp.untouched(job public.article_inputs, draft uuid) returns boolean
language sql as $$
  select exists (select 1 from public.article_inputs i
      where i.id = job.id and i.input_payload = job.input_payload and i.updated_at = job.updated_at)
    and not exists (select 1 from public.article_drafts d where d.id = draft)
    and not exists (select 1 from public.article_images m where m.draft_id = draft);
$$;

create function pg_temp.slow_draft_insert() returns trigger language plpgsql as $$
begin
  perform pg_sleep(1.0);
  return new;
end;
$$;

do $verify$
declare
  job public.article_inputs;
  stored public.article_inputs;
  probe uuid;
  other uuid;
  outcome text;
begin
  -- 1. In time: the article, its images and the job's completion commit together.
  job := pg_temp.seed_job('running', interval '1 minute');
  probe := gen_random_uuid();
  outcome := pg_temp.complete(job, probe, job.updated_at, pg_temp.image_rows(probe, 'featured'));
  select * into stored from public.article_inputs where id = job.id;
  if outcome <> 'committed'
    or stored.input_payload ->> 'status' <> 'completed'
    or stored.input_payload ->> 'draftId' <> probe::text
    or stored.updated_at <= job.updated_at
    or not exists (select 1 from public.article_drafts d where d.id = probe)
    or (select count(*) from public.article_images m where m.draft_id = probe) <> 1 then
    raise exception 'In-time completion verification failed (%)', outcome;
  end if;

  -- 2. The same completion again (a retry after a lost response) finds the job completed.
  other := gen_random_uuid();
  outcome := pg_temp.complete(stored, other, stored.updated_at, '[]'::jsonb);
  if outcome <> 'JOB01' or exists (select 1 from public.article_drafts d where d.id = other) then
    raise exception 'Repeated completion verification failed (%)', outcome;
  end if;

  -- 3. Delayed completion: the request reaches the database after the 6-minute deadline.
  job := pg_temp.seed_job('running', interval '6 minutes 1 second');
  probe := gen_random_uuid();
  outcome := pg_temp.complete(job, probe, job.updated_at, pg_temp.image_rows(probe, 'featured'));
  if outcome <> 'JOB01' or not pg_temp.untouched(job, probe) then
    raise exception 'Delayed completion verification failed (%)', outcome;
  end if;

  -- 4. Slowed-down completion: in time when it starts, past the deadline once its writes are
  --    done. The final check rolls the whole transaction back.
  create trigger completion_probe_slow_insert before insert on public.article_drafts
    for each row execute function pg_temp.slow_draft_insert();
  job := pg_temp.seed_job('running', interval '5 minutes 59.5 seconds');
  probe := gen_random_uuid();
  outcome := pg_temp.complete(job, probe, job.updated_at, '[]'::jsonb);
  drop trigger completion_probe_slow_insert on public.article_drafts;
  if outcome <> 'JOB01' or not pg_temp.untouched(job, probe) then
    raise exception 'Slowed-down completion verification failed (%)', outcome;
  end if;

  -- 5. A job that was canceled, failed (for example by the status recovery) or is not a
  --    generation job can no longer be completed, however recent it is.
  foreach outcome in array array['canceled', 'failed', 'queued'] loop
    job := pg_temp.seed_job(outcome, interval '1 minute');
    probe := gen_random_uuid();
    if pg_temp.complete(job, probe, job.updated_at, '[]'::jsonb) <> 'JOB01' or not pg_temp.untouched(job, probe) then
      raise exception 'Completion of a % job was not rejected', outcome;
    end if;
  end loop;
  job := pg_temp.seed_job('running', interval '1 minute');
  update public.article_inputs set input_payload = input_payload || '{"kind":"other"}' where id = job.id
    returning * into job;
  probe := gen_random_uuid();
  if pg_temp.complete(job, probe, job.updated_at, '[]'::jsonb,
      pg_temp.job_row(job, probe) || jsonb_build_object('input_payload',
        (pg_temp.job_row(job, probe) -> 'input_payload') || '{"kind":"article_generation_job"}')) <> 'JOB01'
    or not pg_temp.untouched(job, probe) then
    raise exception 'Completion of a non-job row was not rejected';
  end if;

  -- 6. A job that does not exist.
  job := pg_temp.seed_job('running', interval '1 minute');
  delete from public.article_inputs where id = job.id;
  probe := gen_random_uuid();
  if pg_temp.complete(job, probe, job.updated_at, '[]'::jsonb) <> 'JOB01'
    or exists (select 1 from public.article_drafts d where d.id = probe) then
    raise exception 'Completion of a missing job was not rejected';
  end if;

  -- 7. A job written since it was read (compare-and-set on updated_at) is a retryable conflict.
  job := pg_temp.seed_job('running', interval '1 minute');
  probe := gen_random_uuid();
  outcome := pg_temp.complete(job, probe, job.updated_at - interval '1 millisecond', '[]'::jsonb);
  if outcome <> '40001' or not pg_temp.untouched(job, probe) then
    raise exception 'Revision verification failed (%)', outcome;
  end if;

  -- 8. An invalid image rolls back the draft and the completion with it.
  job := pg_temp.seed_job('running', interval '1 minute');
  probe := gen_random_uuid();
  outcome := pg_temp.complete(job, probe, job.updated_at, pg_temp.image_rows(probe, 'invalid-slot'));
  if outcome <> '23514' or not pg_temp.untouched(job, probe) then
    raise exception 'Atomic rollback verification failed (%)', outcome;
  end if;

  -- 9. A completion never replaces an existing article.
  job := pg_temp.seed_job('running', interval '1 minute');
  probe := gen_random_uuid();
  perform public.aio_save_draft(pg_temp.draft_row(probe) || '{"edited_title":"Existing article"}', '[]'::jsonb);
  outcome := pg_temp.complete(job, probe, job.updated_at, '[]'::jsonb);
  if outcome <> '23505'
    or (select d.edited_title from public.article_drafts d where d.id = probe) <> 'Existing article'
    or not exists (select 1 from public.article_inputs i where i.id = job.id and i.updated_at = job.updated_at) then
    raise exception 'Existing draft verification failed (%)', outcome;
  end if;

  -- 10. The new record must be this job's completion with this draft.
  job := pg_temp.seed_job('running', interval '1 minute');
  probe := gen_random_uuid();
  if pg_temp.complete(job, probe, job.updated_at, '[]'::jsonb,
      jsonb_set(pg_temp.job_row(job, probe), '{input_payload,status}', '"running"')) <> '22023'
    or pg_temp.complete(job, probe, job.updated_at, '[]'::jsonb,
      jsonb_set(pg_temp.job_row(job, probe), '{input_payload,draftId}', to_jsonb(gen_random_uuid()::text))) <> '22023'
    or pg_temp.complete(job, probe, null, '[]'::jsonb) <> '22023'
    or not pg_temp.untouched(job, probe) then
    raise exception 'Payload validation verification failed';
  end if;

  -- 11. The editor's save path keeps working on an article whose job finished long ago.
  job := pg_temp.seed_job('running', interval '1 day');
  update public.article_inputs set input_payload = input_payload || '{"status":"completed"}' where id = job.id;
  probe := gen_random_uuid();
  perform public.aio_save_draft(pg_temp.draft_row(probe), '[]'::jsonb);
  perform public.aio_save_draft(pg_temp.draft_row(probe) || '{"edited_title":"Edited later"}', '[]'::jsonb,
    (select d.updated_at from public.article_drafts d where d.id = probe));
  if (select d.edited_title from public.article_drafts d where d.id = probe) <> 'Edited later' then
    raise exception 'Editor save verification failed';
  end if;

  -- 12. Only the service role may run it, and it works with the service role's own privileges.
  if has_function_privilege('anon', 'public.aio_complete_generation_job(jsonb,timestamptz,jsonb,jsonb)', 'execute')
    or has_function_privilege('authenticated', 'public.aio_complete_generation_job(jsonb,timestamptz,jsonb,jsonb)', 'execute')
    or not has_function_privilege('service_role', 'public.aio_complete_generation_job(jsonb,timestamptz,jsonb,jsonb)', 'execute') then
    raise exception 'Function privileges verification failed';
  end if;
  job := pg_temp.seed_job('running', interval '1 minute');
  probe := gen_random_uuid();
  declare
    completion jsonb := pg_temp.job_row(job, probe);
    draft jsonb := pg_temp.draft_row(probe);
    images jsonb := pg_temp.image_rows(probe, 'inline-1');
  begin
    set local role service_role;
    perform public.aio_complete_generation_job(completion, job.updated_at, draft, images);
    reset role;
  end;
  if not exists (select 1 from public.article_inputs i where i.id = job.id and i.input_payload ->> 'status' = 'completed')
    or not exists (select 1 from public.article_images m where m.draft_id = probe and m.slot = 'inline-1') then
    raise exception 'Service-role completion verification failed';
  end if;
end;
$verify$;
select 'PASS: in-time commit, delayed and slowed completions rejected, job state and revision guards, atomic rollback, create-only draft, editor save unaffected, service-role-only execution' as verification;
