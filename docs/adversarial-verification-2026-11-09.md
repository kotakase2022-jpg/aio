# Adversarial Verification / Release Record

## Scope and Safety

The user authorized adversarial verification, fixes, PR merge, and production release on
2026-11-09. This extends the earlier review-only scope of PR #42. Existing production
articles must not be changed in bulk, WordPress must not be used for test publication,
and the customer explanation in `aizawa-content-integrity-review.md` remains unsent.

Baseline: branch `codex/loop9-aizawa-content-integrity`, HEAD `30e0ab3`, PR #42,
main `8c2a9b5`. Starting Vercel deployment: `dpl_HaGiMSgjDJ4ygs757JvsnNy7n5Pt`
(runtime `742370e`; baseline differences were documentation).

## Reproduced Defects and Fixes

| Area | Adversarial case | Protection / proof |
| --- | --- | --- |
| FAQ | Wrapped/multiple-paragraph old answers; unmatched edited questions; C++/C#, decimals, signs | Structural removal with source offsets, shared conservative canonicalization, editor-only content retained, repeated HTML assembly stable |
| Sources | Commented anchors, data-href, conflicting successful/unusable fetches of same canonical URL | Actual anchors parsed; unusable URL cannot return through legacy fallback in renderer or UI |
| Evidence | 1.5% supporting 9.5%; members-only benefit generalized to everyone | Decimal-preserving sentence boundaries and exclusive-condition checks |
| URL extraction | Listing cards classified as article; single replacement character; adjacent blocks merging numbers | Page-wide listing detection, reject replacement characters, preserve block separators |
| OpenAI | Headers arrive but JSON response body stalls forever | Deadline covers body consumption; transport failure is not silently converted to empty JSON |
| Persistence | Draft saved but image failure leaves body/approval committed | `aio_save_draft` transactional RPC; invalid image rolls back all changes |
| Jobs | Concurrent cancellation overwritten by worker completion | Conditional revision update with bounded retries, cancellation remains terminal |
| Jobs | Worker killed at Vercel's 300-second limit leaves endless progress | Status GET recovers queued/running jobs after six minutes; terminal states win CAS races and late workers cannot replace recovery |
| Logs | Draft save succeeds but embedded job copy fails to sync | Explicit auxiliary warning; restore reads canonical saved draft |
| Input | Null arrays / malformed form persisted before validation | Zod structural validation before generation/job persistence; old malformed log summary is safe |
| Images | Stale regeneration overwrites a later save; old published image deleted | Conditional final save and conservative asset cleanup; published assets retained |
| WordPress | Duplicate concurrent/retry posts; remote success followed by local persistence failure | Persistent pre-POST reservation, receipt-first bookkeeping, confirmed URL plus warnings; unknown outcome requires reconciliation |
| UI | Edits or another draft loaded while save/approval/image/post response is pending | Editor/mutating actions locked until acknowledgement; pending log-open response invalidated |
| Local fallback | Concurrent JSON writes or malformed store silently replaced | In-process serialized atomic rename; read errors propagate except ENOENT |
| Dependencies | Production runtime advisories | Next 16.4.5, updated compatible lockfile; production dependency audit is clean |

## Verification Evidence

- Regressions were added before fixes. Observed failures included URL extraction 3,
  OpenAI stalled body 1, server workflow 8, extended FAQ/content cases, WordPress 5xx
  uncertainty 1, conflicting-source and warning E2E, and delayed save/approval E2E 2.
- Earlier combined quality run: 510 unit/integration/contract tests, additional contract
  run 15, coverage S/B/F/L 87.16/77.65/92.56/87.90%, production Chromium E2E 54/54, build PASS.
- A restoration E2E initially read localStorage before async restore completed. Replaced
  the immediate assertion with `expect.poll`, retaining the same expected value. This
  corrects test timing; no production behavior or success condition was weakened.
- Windows sandbox denied Vite SSR temporary-cache rename (`EPERM`) before tests executed.
  The unchanged suite passes in the approved local execution environment.
- Live OpenAI structured text: PASS, one contract including three audience/structure
  cases, 147.96 seconds. Existing key reuse explicitly authorized; no saved article.
- Live OpenAI Image: PASS, one PNG response validated in memory, 57.28 seconds;
  no Storage/DB write and no image published.
- Final text API rerun after transport changes: PASS, 156.75 seconds.
- Stale-job recovery regressions: before fix 16 failed / 7 passed; after fix 23/23 PASS,
  related six suites 53/53 PASS. Recovery runs on the next authenticated status GET,
  not a scheduler, and cannot cancel already in-flight provider billing.
- Production smoke's CommonJS dependency import was corrected after Node reproduced a
  named-export failure; it does not change application behavior.
- Built browser assets: 12 files checked for configured server-secret values, 0 exposures
  (two secret types available locally; not proof about every remote environment variable).
- Live Supabase initial disposable CRUD/image replacement: 2/2 PASS before the new RPC.
- Real PostgreSQL `BEGIN; migration; fixture; ROLLBACK;`: PASS for atomic rollback,
  stale revision rejection and service_role-only EXECUTE. Temporary function/rows
  confirmed absent afterward. Permanent migration and final live suite are release steps.
- `npm audit --omit=dev`: 0 vulnerabilities. Full audit retains 8 moderate dev-only
  reports in the typescript-eslint/minimatch chain. No force-downgrade was applied.
- Live WordPress readiness: NOT READY (dedicated sandbox credentials absent).
  WP API/media/failure paths have contract/integration/E2E coverage, not live proof.

Final combined gate, PR CI, CodeRabbit findings and deployment IDs are recorded in
`AI_HANDOFF.md`; intermediate green runs do not substitute for that final gate.

Final local `npm run quality` after the follow-up fixes: PASS. 54 files / 544 tests,
15 separately rerun contract tests, coverage S/B/F/L 87.37/78.19/92.61/88.08%,
56/56 Chromium E2E, integrity 59 files, Next 16.4.5 build 19 routes.

## CodeRabbit Follow-up

Review of `4fcb514` completed in 13m41s with six inline and one outside-diff finding.
The prior additional conflicting-URL fallback finding was reproduced and fixed.

- Update historic Next version labeling and remove outdated `next dev` E2E description.
- Reject slash-backslash external-looking links in publication validation.
- Do not replace a corrupted local job store with an empty object on non-ENOENT errors.
- RPC failure tests explicitly assert no table-level bypass calls; PostgreSQL rollback
  is proven by SQL/live tests, not simulated atomicity in JavaScript mocks.
- Preserve whole prioritized numeric/condition sentences when compacting long input;
  common standalone kanji must not fill the evidence budget.
- **Intentional non-adoption:** silently returning `job.draft` after canonical draft
  read failure can restore stale edits/approval and overwrite the newer saved draft.
  Keep the visible failure/retry behavior. The canonical-read integration regression
  confirms no stale job is returned and retry restores the latest untouched draft.
- Generic docstring-coverage warning remains separate from executable quality gates.

## Release Order

1. Pass the combined local quality gate and required PR CI; review CodeRabbit findings.
2. Merge through protected PR #42. Do not push directly to main or bypass rules.
3. Apply additive `20261109125814_atomic_draft_save.sql`. Keep RLS and service_role-only
   execution. The old application is compatible with the added function.
4. Deploy updated `aio-store` gateway with existing custom token authentication and
   previous `verify_jwt=false` setting. Old actions stay available.
5. Run the guarded disposable Supabase suite; confirm cleanup.
6. Stage the reviewed main commit with Vercel `--prod --skip-domain`, then run
   `node scripts/production-smoke.mjs` against that deployment and promote the same build.
7. Repeat read-only smoke on the canonical production URL. The smoke permits login but
   blocks application mutation requests and does not generate, save or post an article.

If an old WordPress posting worker is still running, let it finish before release;
old versions do not acquire the new duplicate-post reservation.

### Release Checkpoint

- PR #42 merged through protected squash merge to `e150927d7e5ddc5c82b54d946a9b21db49e8c4c5`.
- Required PR CI run `42628456722` and main CI run `42629017490`: PASS.
- All 13 review threads resolved; the latest CodeRabbit re-review was skipped because
  of the OSS hourly limit. It is not represented as a fresh review pass.
- Supabase `apply_migration` confirmation expired twice. The migration list still
  contains only the three pre-existing migrations. No permanent RPC/gateway/app
  rollout took place. Do not deploy the new app until RPC and gateway are ready.
- Remaining release verification: permanent RPC permissions, guarded three-case live
  Supabase suite and cleanup, staged Vercel smoke, promotion and canonical smoke.
- The app remains on previous production deployment `dpl_HaGiMSgjDJ4ygs757JvsnNy7n5Pt`.

## Remaining Limits / Human Checks

- This is reproducible evidence, not a claim that every possible input is bug-free.
- Fact/condition checks are conservative heuristics, not semantic proof of correctness.
  An editor must verify numbers, exclusions, medical/financial claims and actual sources.
- Large semantic FAQ paraphrases may require manual review. Ambiguous unwrapped trailing
  prose is preserved to avoid destroying editor content.
- WordPress unknown outcomes retain a reservation. An administrator must reconcile the
  actual remote post before any retry; never blindly delete reservations. Exactly-once
  distributed delivery is not claimed.
- Browser `updatedAt` is not a full cross-session version token. Image completion uses
  conditional persistence, but full multi-tab optimistic concurrency is not claimed.
- Local JSON locking is process-scoped; Vercel requires durable Supabase persistence.
- Shared demo access code is the existing product specification, not per-user isolation.
- Dev dependency moderate advisories need a compatible upstream update. Production
  dependency audit is clear at verification time, not a perpetual security guarantee.
