-- A generation run commits its article (draft and images) and the job's completion in one
-- transaction, and only if the job row is still running and younger than the generation
-- deadline when this function checks it. A save or completion request that the database
-- processes after the deadline therefore changes nothing. The checks run inside the
-- transaction, not at its commit: a commit that stalls for longer than the margin to the
-- browser's 7-minute hold can still land after the browser has stopped holding the job.
-- Additive only: aio_save_draft and every existing object stay unchanged, so the deployed
-- application and gateway keep working while this function is rolled out.
create or replace function public.aio_complete_generation_job(
  job_row jsonb,
  expected_updated_at timestamptz,
  draft_row jsonb,
  image_rows jsonb
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  -- Same limit as GENERATION_JOB_EXPIRY_MS in src/lib/server/generation-jobs.ts. A browser that
  -- cannot read the job keeps holding it for 7 minutes; the minute between is the margin for
  -- clock differences and for the commit that follows the last check.
  completion_deadline constant interval := interval '6 minutes';
  job_payload jsonb := job_row -> 'input_payload';
  job_id uuid;
  draft_id uuid;
  job_updated_at timestamptz;
  stored public.article_inputs;
begin
  if jsonb_typeof(job_row) is distinct from 'object'
    or jsonb_typeof(job_payload) is distinct from 'object'
    or jsonb_typeof(draft_row) is distinct from 'object'
    or jsonb_typeof(image_rows) is distinct from 'array'
    or expected_updated_at is null
    or job_row ->> 'updated_at' is null
    -- The new record must describe this job, finished, with this draft.
    or job_payload ->> 'kind' is distinct from 'article_generation_job'
    or job_payload ->> 'status' is distinct from 'completed'
    or job_payload ->> 'id' is distinct from job_row ->> 'id'
    or job_payload ->> 'draftId' is distinct from draft_row ->> 'id' then
    raise exception 'Invalid generation completion payload' using errcode = '22023';
  end if;
  job_id := (job_row ->> 'id')::uuid;
  draft_id := (draft_row ->> 'id')::uuid;
  job_updated_at := (job_row ->> 'updated_at')::timestamptz;

  -- The row lock orders this completion against a concurrent cancel or recovery write.
  select * into stored from public.article_inputs where id = job_id for update;
  if not found
    or stored.input_payload ->> 'kind' is distinct from 'article_generation_job'
    or stored.input_payload ->> 'status' is distinct from 'running' then
    raise exception 'Generation job is no longer running' using errcode = 'JOB01';
  end if;
  if clock_timestamp() >= stored.created_at + completion_deadline then
    raise exception 'Generation job passed its completion deadline' using errcode = 'JOB01';
  end if;
  if stored.updated_at is distinct from expected_updated_at then
    raise exception 'Generation job changed; reload it' using errcode = '40001';
  end if;
  -- A completion only ever creates its article; it never replaces an existing one.
  if exists (select 1 from public.article_drafts d where d.id = draft_id) then
    raise exception 'Generated draft already exists' using errcode = '23505';
  end if;

  perform public.aio_save_draft(draft_row, image_rows, null);

  update public.article_inputs
    set input_payload = job_payload, updated_at = job_updated_at
    where id = job_id;

  -- Checked again after the writes: a transaction slowed down on its way (lock wait, I/O) past
  -- the deadline is rolled back as a whole instead. The commit itself comes after this check.
  if clock_timestamp() >= stored.created_at + completion_deadline then
    raise exception 'Generation job passed its completion deadline' using errcode = 'JOB01';
  end if;
end;
$$;

comment on function public.aio_complete_generation_job(jsonb, timestamptz, jsonb, jsonb) is
  'Saves a generated draft and marks its job completed in one transaction, only while the job is running and less than 6 minutes old; otherwise raises SQLSTATE JOB01 and writes nothing.';

revoke all on function public.aio_complete_generation_job(jsonb, timestamptz, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.aio_complete_generation_job(jsonb, timestamptz, jsonb, jsonb) to service_role;
