# Quality Audit

This audit tracks progress toward the active 100/100 goal:

1. Functional reliability and correct PC screen transitions.
2. Daily-use UX value for article creation work.
3. Non-commodity generated article quality.

It is a working document for Codex, Claude Code, and CodeRabbit review. It does not replace
`npm run quality`, live sandbox checks, or manual PC browser review.

## Feature Inventory

Primary user-facing areas:

- Demo authentication: access-code login and return-path preservation.
- Article creation form: reference URLs, reference text, reference files, competitor URLs,
  competitor text, competitor files, theme/keywords, primary information, closing CTA, author
  fields, author image, visual tone, uploaded visual-tone image, image count, and target length.
- AI assistance: competitor research, theme candidate generation, article generation, article
  regeneration, image generation, bulk image regeneration, and single-image regeneration.
- Draft review: preview/edit switching, fullscreen preview, title/slug/meta/body/FAQ/tags/categories
  editing, generated image review, author block rendering, quality checklist, save, approve, copy,
  HTML export, and generation log reopening.
- Persistence: local fallback storage, Supabase-backed generation jobs/logs when configured, draft
  save/approve, previous closing text reuse, and previous author reuse.
- WordPress: connection validation, encrypted credential handling, draft/publish status selection,
  media/post payload creation, success URL display, and recoverable posting errors.
- Error and recovery states: URL fetch failure, file extraction failure/retry, theme candidate
  failure/retry, competitor research failure/retry, generation start/failure/cancel/reload recovery,
  save/approve/post/export/copy failures, and stale generation job cleanup.

## Current Mechanical Evidence

Latest Codex pass on 2026-07-08 16:33 +09:00:

- Tightened OpenAI article-generation instructions for non-commodity output:
  - primary information must be broken into observed problem, affected reader, operational cause,
    decision criterion, and caveat instead of being pasted as long clauses.
  - FAQ items must visibly reuse concrete input terms while explaining them through a decision,
    condition, caveat, field example, or source boundary.
  - target reader role phrases must appear in the opening and at least one heading, example, or
    FAQ item.
  - visible body length now targets 90-110% of the requested length with a 130% hard maximum buffer.
  - body HTML should include concrete anchors such as decision criteria, caveats, failure examples,
    field observations, sources, conditions, cost, timing, or owners.
- Focused verification passed:
  - `npx.cmd vitest run tests/unit/article-generation.test.ts`
  - `npm.cmd run typecheck`
- `npm.cmd run quality` passed:
  - typecheck passed
  - lint passed
  - test integrity passed, 48 files
  - unit/integration tests passed, 44 files / 343 tests
  - contract tests passed, 3 files / 13 tests
  - coverage passed: statements 88.4%, branches 76.46%, functions 92.35%, lines 88.84%
  - E2E passed, 49 Chromium PC tests
  - build passed, Next.js 16.2.9 production build
- Re-ran OpenAI live generation with artifact writing enabled:
  - `AIO_LIVE_OPENAI_WRITE_ARTIFACTS=1`
  - `AIO_LIVE_OPENAI_ARTIFACT_DIR=test-results/live-openai`
- `npm.cmd run test:live:openai` passed after the final prompt update, 1 file / 1 test, in 191.28s.
- Latest live article artifact scores:
  - one-person contractor workers compensation: 88
  - SaaS onboarding operations: 90
  - AIO content operations: 88
- Latest deterministic artifact review details:
  - one-person contractor workers compensation: article body 88, title 100, FAQ 100, meta 100
    - remaining body issue: `unsupported-claims`
  - SaaS onboarding operations: article body 100, title 100, FAQ 100, meta 100
  - AIO content operations: article body 92, title 100, FAQ 100, meta 100
    - remaining body issue: `concrete-detail`
- The previous AIO content failures for `target-length-alignment`, `numeric-claim-support`, and
  `target-reader-reflection` did not recur in the latest live run.
- The live quality samples remain above the configured minimum score, but they are not yet a human
  editorial 100/100 claim.

Latest Codex pass on 2026-07-08 15:54 +09:00:

- Added deterministic quality review output to OpenAI live artifacts:
  - JSON artifacts now include `qualityReview` entries for article body, title, FAQ, and meta
    description.
  - Each quality review entry stores the deterministic score and failed check ids/details.
  - HTML artifacts now include a `Deterministic Quality Checks` section before the reader/structure
    snapshot.
- Focused verification passed:
  - `npx.cmd vitest run tests/unit/openai-live-artifacts.test.ts`
  - `npm.cmd run typecheck`
- `npm.cmd run quality` passed:
  - typecheck passed
  - lint passed
  - test integrity passed, 48 files
  - unit/integration tests passed, 44 files / 343 tests
  - contract tests passed, 3 files / 13 tests
  - coverage passed: statements 88.4%, branches 76.46%, functions 92.35%, lines 88.84%
  - E2E passed, 49 Chromium PC tests
  - build passed, Next.js 16.2.9 production build
- Re-ran OpenAI live generation with artifact writing enabled after provider quota was restored:
  - `AIO_LIVE_OPENAI_WRITE_ARTIFACTS=1`
  - `AIO_LIVE_OPENAI_ARTIFACT_DIR=test-results/live-openai`
- `npm.cmd run test:live:openai` passed, 1 file / 1 test, in 197.19s.
- Live article artifact scores:
  - one-person contractor workers compensation: 88
  - SaaS onboarding operations: 88
  - AIO content operations: 82
- Deterministic artifact review details:
  - one-person contractor workers compensation: article body 98, title 100, FAQ 100, meta 100
  - SaaS onboarding operations: article body 98, title 100, FAQ 100, meta 100
  - AIO content operations: article body 82, title 100, FAQ 100, meta 100
  - AIO content operations still flagged `target-length-alignment` and `numeric-claim-support` in
    the article body, so it remains useful for editorial follow-up even though it passed the live
    minimum score.
- Re-ran the explicitly approved production Supabase write/delete contract path:
  - `AIO_LIVE_CONFIRM_PRODUCTION_WRITE=1`
- `npm.cmd run test:live:supabase` passed, 1 file / 1 test. The test created and cleaned up a
  disposable generation-job record.
- `npm.cmd run test:live:readiness:wordpress` failed closed before live calls because sandbox
  WordPress credentials and explicit post/media/delete/non-production allow flags are not configured.

Latest Codex pass on 2026-07-08 15:32 +09:00:

- Improved OpenAI live article artifacts for human editorial review:
  - JSON artifacts now include a stable `reviewChecklist`.
  - HTML artifacts now include an `Editorial Review Checklist` section.
  - HTML artifacts now include a `Reader And Structure Snapshot` with target reader, search
    intent, headings, and FAQ answers.
- The checklist is designed to make non-commodity review reproducible instead of relying only on a
  numeric quality score.
- Focused verification passed:
  - `npx.cmd vitest run tests/unit/openai-live-artifacts.test.ts`
  - `npm.cmd run typecheck`
- `npm.cmd run quality` passed:
  - typecheck passed
  - lint passed
  - test integrity passed, 48 files
  - unit/integration tests passed, 44 files / 343 tests
  - contract tests passed, 3 files / 13 tests
  - coverage passed: statements 88.4%, branches 76.46%, functions 92.35%, lines 88.84%
  - E2E passed, 49 Chromium PC tests
  - build passed, Next.js 16.2.9 production build
- `npm.cmd run test:live:readiness:wordpress` failed closed before live calls because sandbox
  WordPress credentials and explicit post/media/delete/non-production allow flags are not configured.
- Pushed implementation commit `d3e202a` and watched PR #1 automation:
  - CodeRabbit: success
  - GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m42s

Latest Codex pass on 2026-07-08 15:09 +09:00:

- Split OpenAI 429 error guidance into two clearer product-facing paths:
  - `insufficient_quota` / `billing_hard_limit_reached`: tells the operator to check OpenAI
    Platform Billing/Usage and the API-key project used by the app.
  - transient rate limits: tells the operator to wait or reduce image count / input size.
- Updated unit and contract coverage for the new OpenAI error classification.
- Adjusted the live OpenAI test so generated JSON/HTML artifacts are written before quality
  assertions. If a future sample falls below the quality threshold, the failed output remains
  available for editorial diagnosis.
- Focused verification passed:
  - `npx.cmd vitest run tests/unit/openai.test.ts tests/contract/openai.contract.test.ts`
  - `npm.cmd run typecheck`
- Re-ran artifact-producing OpenAI live generation:
  - `AIO_LIVE_CONTRACT_TESTS=1`
  - `AIO_LIVE_OPENAI_WRITE_ARTIFACTS=1`
  - `AIO_LIVE_OPENAI_ARTIFACT_DIR=test-results/live-openai`
- `npm.cmd run test:live:openai` passed, 1 file / 1 test, in 196.88s.
- Live article artifact scores:
  - one-person contractor workers compensation: 88
  - SaaS onboarding operations: 84
  - AIO content operations: 90
- Ignored live artifacts were written under `test-results/live-openai/` for human editorial review.
- `npm.cmd run quality` passed:
  - typecheck passed
  - lint passed
  - test integrity passed, 48 files
  - unit/integration tests passed, 44 files / 343 tests
  - contract tests passed, 3 files / 13 tests
  - coverage passed: statements 88.4%, branches 76.46%, functions 92.35%, lines 88.84%
  - E2E passed, 49 Chromium PC tests
  - build passed, Next.js 16.2.9 production build
- Pushed implementation commit `9538ffa` and watched PR #1 automation:
  - CodeRabbit: success
  - GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m54s

Latest Codex pass on 2026-07-08 14:47 +09:00:

- Re-checked PR #1 at head `e3022f7` before this pass:
  - CodeRabbit: success
  - GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m40s
- Ran the explicitly approved production Supabase write/delete contract path:
  - `AIO_LIVE_CONTRACT_TESTS=1`
  - `AIO_LIVE_SUPABASE_ALLOW_WRITE=1`
  - `AIO_LIVE_CONFIRM_PRODUCTION_WRITE=1`
- `npm.cmd run test:live:readiness:supabase` passed.
- `npm.cmd run test:live:supabase` passed, 1 file / 1 test. The test created, read, listed,
  updated, and deleted a disposable generation-job record.
- Re-ran OpenAI live readiness and artifact-producing generation:
  - `AIO_LIVE_CONTRACT_TESTS=1`
  - `AIO_LIVE_OPENAI_WRITE_ARTIFACTS=1`
  - `AIO_LIVE_OPENAI_ARTIFACT_DIR=test-results/live-openai`
- `npm.cmd run test:live:readiness:openai` passed.
- `npm.cmd run test:live:openai` failed at the initial minimal Responses API health call.
- A direct non-secret diagnostic call confirmed the provider response was HTTP 429
  `insufficient_quota` for the app default model `gpt-5.5`. No generated JSON/HTML artifacts were
  produced.
- Pushed the live-verification docs update as `06028d0` and watched PR #1 automation:
  - CodeRabbit: success
  - GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m29s
- No runtime code changed in this pass.

Latest Codex pass on 2026-07-08 14:36 +09:00:

- Retried OpenAI live generation with artifact writing enabled:
  - `AIO_LIVE_CONTRACT_TESTS=1`
  - `AIO_LIVE_OPENAI_WRITE_ARTIFACTS=1`
  - `AIO_LIVE_OPENAI_ARTIFACT_DIR=test-results/live-openai`
- `npm.cmd run test:live:readiness:openai` passed.
- `npm.cmd run test:live:openai` failed at the initial Responses API health call with the app's
  Japanese OpenAI quota/rate-limit error. No generated JSON/HTML artifacts were produced.
- Tightened generic AI-filler detection and regeneration guidance for:
  - `一般的に`
  - `多くの場合`
  - `効率化につながります`
  - `品質向上につながります`
- Updated generation instructions to discourage those phrases before drafting, and updated the
  quality-regeneration action so the UI repair instruction tells users exactly what to replace.
- Added unit coverage for the new filler pattern and updated the E2E assertion for the regenerated
  instruction text.
- Focused Vitest passed: 3 files / 113 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run lint` passed.
- Focused Playwright rerun for `tests/e2e/aio-workflow.spec.ts:454` passed.
- `npm.cmd run quality` passed after updating the E2E assertion:
  - typecheck passed
  - lint passed
  - test integrity passed, 48 files
  - unit/integration tests passed, 44 files / 342 tests
  - contract tests passed, 3 files / 13 tests
  - coverage passed: statements 88.39%, branches 76.39%, functions 92.35%, lines 88.83%
  - E2E passed, 49 Chromium PC tests
  - build passed, Next.js 16.2.9 production build

Latest Codex pass on 2026-07-08 14:20 +09:00:

- Hardened `tests/live/wordpress.live.test.ts` cleanup so the disposable WordPress post deletion
  and featured-media deletion are both attempted even when one cleanup step fails or throws.
- Cleanup failures are collected and reported together with resource type, id, HTTP status or thrown
  error, and bounded response details. This reduces the chance that one cleanup failure leaves the
  second disposable resource unattempted.
- `npm.cmd run typecheck` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run test:live:readiness:wordpress` failed closed before any live calls because local
  sandbox WordPress credentials and allow flags are not configured.
- `npm.cmd run quality` passed:
  - typecheck passed
  - lint passed
  - test integrity passed, 48 files
  - unit/integration tests passed, 44 files / 341 tests
  - contract tests passed, 3 files / 13 tests
  - coverage passed: statements 88.39%, branches 76.39%, functions 92.35%, lines 88.83%
  - E2E passed, 49 Chromium PC tests
  - build passed, Next.js 16.2.9 production build

Latest Codex pass on 2026-07-08 14:09 +09:00:

- Added an explicit WordPress live delete permission flag:
  - `AIO_LIVE_WORDPRESS_ALLOW_DELETE=1`
- The WordPress live contract test creates a disposable post and media item, then deletes both in
  cleanup. Readiness now requires explicit post, media, and delete permissions so cleanup-capable
  live tests cannot run by accident.
- Updated `.env.live.example`, `docs/testing.md`, the readiness script, and the WordPress live spec.
- Added readiness unit coverage proving WordPress live checks fail closed when the delete flag is
  missing and pass only when post/media/delete/sandbox flags are all present.
- `npx.cmd vitest run tests/unit/live-readiness-script.test.ts` passed, 1 file / 10 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run test:live:readiness:wordpress` failed closed before any live calls because local
  sandbox WordPress credentials and all allow flags are not configured.
- `npm.cmd run quality` passed:
  - typecheck passed
  - lint passed
  - test integrity passed, 48 files
  - unit/integration tests passed, 44 files / 341 tests
  - contract tests passed, 3 files / 13 tests
  - coverage passed: statements 88.39%, branches 76.39%, functions 92.35%, lines 88.83%
  - E2E passed, 49 Chromium PC tests
  - build passed, Next.js 16.2.9 production build

Latest Codex pass on 2026-07-08 13:50 +09:00:

- Hardened optional OpenAI live artifact capture so `AIO_LIVE_OPENAI_ARTIFACT_DIR` must resolve
  inside `test-results` or the OS temp directory. This prevents generated review JSON/HTML from
  being written accidentally into tracked repository paths such as `docs/` or the repo root.
- The live OpenAI test now validates the artifact directory before `vi.resetModules()` and before
  any provider call when artifact writing is enabled.
- Added unit coverage for allowed/default artifact paths and rejected tracked paths.
- `npx.cmd vitest run tests/unit/openai-live-artifacts.test.ts` passed, 1 file / 3 tests.
- `npm.cmd run typecheck` passed.
- Expected fail-fast verification passed: running the live OpenAI spec with
  `AIO_LIVE_OPENAI_WRITE_ARTIFACTS=1` and `AIO_LIVE_OPENAI_ARTIFACT_DIR=docs/live-openai` failed in
  about 5ms with a local artifact-directory validation error, before any OpenAI API call.
- `npm.cmd run quality` passed:
  - typecheck passed
  - lint passed
  - test integrity passed, 48 files
  - unit/integration tests passed, 44 files / 339 tests
  - contract tests passed, 3 files / 13 tests
  - coverage passed: statements 88.39%, branches 76.39%, functions 92.35%, lines 88.83%
  - E2E passed, 49 Chromium PC tests
  - build passed, Next.js 16.2.9 production build
- `npm.cmd run test:live:readiness:wordpress` failed closed because sandbox WordPress site URL,
  username, application password, post/media allow flags, and non-production confirmation are not
  configured. No WordPress live call was made.

Latest Codex pass on 2026-07-08 13:34 +09:00:

- Added optional OpenAI live artifact capture for representative generated article review:
  - `AIO_LIVE_OPENAI_WRITE_ARTIFACTS=1`
  - `AIO_LIVE_OPENAI_ARTIFACT_DIR=test-results/live-openai`
- When enabled, `npm run test:live:openai` writes ignored JSON and HTML outputs for each live
  generation sample, so a human reviewer can inspect the actual generated article body, score,
  input theme, primary information, and improvement notes without exposing provider secrets.
- Added unit coverage for the artifact helper.
- `npm.cmd run quality` passed:
  - typecheck passed
  - lint passed
  - test integrity passed, 48 files
  - unit/integration tests passed, 44 files / 338 tests
  - contract tests passed, 3 files / 13 tests
  - coverage passed: statements 88.39%, branches 76.39%, functions 92.35%, lines 88.83%
  - E2E passed, 49 Chromium PC tests
  - build passed, Next.js 16.2.9 production build
- `npm.cmd run test:live:readiness:openai` passed.
- `AIO_LIVE_OPENAI_WRITE_ARTIFACTS=1 npm.cmd run test:live:openai` was attempted, but failed at
  the initial Responses API health call with the app's Japanese OpenAI quota/rate-limit error.
  No artifact files were produced. This is an external provider-state blocker, not a code-path proof
  of generated article quality.

The latest local full gate passed on 2026-07-08 09:37 +09:00 after strengthening English conclusion
boilerplate detection and regeneration guidance. The quality checklist now flags obvious
AI-written English endings such as `in conclusion`, `it is worth noting that`, and
`at the end of the day`, while keeping the previous image-recovery and English opening/generic
phrase protections:

- `npm.cmd run quality`
  - `npm run typecheck`: passed
  - `npm run lint`: passed
  - `npm run test:integrity`: passed, 47 files
  - `npm run test`: passed, 43 files / 329 tests
  - `npm run test:contract`: passed, 3 files / 13 tests
  - `npm run test:coverage`: passed, statements 88.2%, branches 76.19%, functions 92.13%,
    lines 88.64%
  - `npm run test:e2e`: passed, 49 Chromium PC tests
  - `npm run build`: passed, Next.js 16.2.9 production build

The current local branch includes implementation commit `96ef26b`, which respects saved
`imageCount` when showing missing-image recovery prompts and adds E2E coverage for extra prompts
beyond the requested image count.

The latest pushed head containing that image-recovery prompt-scope pass and handoff update was
checked:

- Commit: `df451fe`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m30s

Later status-only handoff commits should be re-checked on the current PR head; they do not change
runtime code.

The current local branch also includes implementation commit `712cdc4`, which detects English
conclusion boilerplate, aligns generation/regeneration instructions, and adds focused unit coverage.
The latest pushed head containing that conclusion-boilerplate pass and handoff update was checked:

- Commit: `2634144`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m34s

Later status-only handoff commits should be re-checked on the current PR head; they do not change
runtime code.

The latest verified pushed PR head before the image-alt HTML sync pass was:

- Commit: `e955605`
- PR: https://github.com/kotakase2022-jpg/aio/pull/1
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success
- Merge state: clean

The latest code-bearing PR head after the image-alt HTML sync pass is also green:

- Commit: `2142e47`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m45s

Later status-only handoff commits should be re-checked on the current PR head; they do not change
runtime code.

The current local branch also includes implementation commit `d80a080`, which writes featured image
`altText` to WordPress media `alt_text` metadata after upload. Hosted CodeRabbit and Actions must be
re-checked after the handoff/docs update is pushed.

The latest pushed head containing that implementation and handoff update was also checked:

- Commit: `cbbf633`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: first run failed while installing Playwright
  Chromium because the runner could not fetch signed Microsoft apt repository metadata; rerun of the
  same workflow succeeded in 3m04s.

The current local branch also includes test commit `15f2b65`, which adds route-level regression
coverage proving `/api/wordpress/post` preserves WordPress publishing `ApiError` status, Japanese
error text, and recovery detail. Hosted CodeRabbit and Actions must be re-checked after the
handoff/docs update is pushed.

The latest pushed head containing that route coverage and handoff update was also checked:

- Commit: `a7f8f5b`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m46s

The latest pushed status-only head before this pass was also checked:

- Commit: `847ad77`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m37s

The current branch also includes implementation commit `c4d81ed`, which detects repeated
"必要があります" / "必要です" style phrasing in generated articles, wires that quality check into
edit guidance and regeneration instructions, and adds regression coverage.

The latest pushed head containing that article-quality pass and handoff update was checked:

- Commit: `1438ebc`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: first run failed before project commands
  during Playwright Chromium dependency installation due to a transient Microsoft apt repository
  signature fetch error; rerun succeeded in 3m44s.

The latest pushed status-only head before this pass was also checked:

- Commit: `4d4b5a2`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m33s

The latest pushed head containing that Japanese phrase dictionary pass and handoff update was also
checked:

- Commit: `e4c231b`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m44s

The latest pushed status-only head before this pass was also checked:

- Commit: `f1ae952`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m34s

The latest pushed head containing that title-quality pass and handoff update was also checked:

- Commit: `e57d421`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m32s

The latest pushed status-only head before this pass was also checked:

- Commit: `45642d1`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m33s

The latest pushed head containing that English title-signal matching pass and handoff update was
also checked:

- Commit: `309b2fc`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m07s

The latest pushed status-only head before this pass was also checked:

- Commit: `29d11b9`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m53s

The latest pushed head containing that hyphenated title-signal pass and handoff update was also
checked:

- Commit: `b9193ba`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m33s

The latest pushed status-only head before this pass was also checked:

- Commit: `e7c8aee`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m55s

The latest pushed head containing that slash/colon title-signal test pass and handoff update was
also checked:

- Commit: `032a07f`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m48s

The latest pushed status-only head before this pass was also checked:

- Commit: `5041dae`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m43s

The current local branch also includes test commit `6112b9c`, which verifies underscore-joined
English title tokens such as `Platform_form` do not count as natural input-signal matches. Hosted
CodeRabbit and Actions have been checked after the handoff/docs update was pushed.

The latest pushed head containing that underscore title-signal test pass and handoff update was
also checked:

- Commit: `9474aae`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m50s

Later status-only handoff commits should be re-checked on the current PR head; they do not change
runtime code.

The latest pushed status-only head before this pass was also checked:

- Commit: `401e269`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m52s

The current local branch also includes implementation commit `def4a3b`, which aligns article-body
English signal matching with title-quality boundaries: hyphenated phrases count as natural
first-party reflections, but underscore-joined tokens do not. Hosted CodeRabbit and Actions were
checked after the handoff/docs update was pushed.

The latest pushed head containing that article-quality token-boundary pass and handoff update was
also checked:

- Commit: `e5f5169`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m51s

Later status-only handoff commits should be re-checked on the current PR head; they do not change
runtime code.

The latest pushed status-only head before this pass was also checked:

- Commit: `333aedd`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m47s

The current local branch also includes implementation commit `4ac77dd`, which centralizes English
token matching for title-quality and article-quality checks in `src/lib/english-token.ts`. Hosted
CodeRabbit and Actions have been checked after the handoff/docs update was pushed.

The latest pushed head containing that shared English-token helper pass and handoff update was
also checked:

- Commit: `fa01d01`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m25s

Later status-only handoff commits should be re-checked on the current PR head; they do not change
runtime code.

The current local branch also includes implementation commit `5cade63`, which applies the shared
English token-boundary helper to FAQ input-reflection quality checks. FAQ coverage now verifies that
`form-based` counts as a natural reflection of the input term `form`, while `platform_form` does not.
Hosted CodeRabbit and Actions have been checked after the handoff/docs update was pushed.

The latest pushed head containing that FAQ token-boundary pass and handoff update was also checked:

- Commit: `ae15e74`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m09s

Later status-only handoff commits should be re-checked on the current PR head; they do not change
runtime code.

The current local branch also includes implementation commit `3584f06`, which expands English
commodity-AI boilerplate detection and regeneration guidance for phrases such as `today's rapidly
evolving landscape`, `comprehensive guide`, `delve into`, and `navigate the complexities`. Hosted
CodeRabbit and Actions have been checked after the handoff/docs update was pushed.

The latest pushed head containing that English boilerplate detection pass and handoff update was
also checked:

- Commit: `c2e66ab`
- CodeRabbit: success
- GitHub Actions `Typecheck, lint, tests, E2E, build`: success in 3m47s

Later status-only handoff commits should be re-checked on the current PR head; they do not change
runtime code.

Current E2E coverage includes 48 Chromium PC tests across the core article workflow, required-input
validation, failure recovery, file/URL retry behavior, generation logs, WordPress posting, draft
state transitions, copy/export recovery, persistent generation jobs, uploaded images, and previous
input reuse.

Article-quality coverage checks that supplied first-party/primary information appears in the opening
decision frame, not only later in the body. It also checks common AI-ish commodity patterns,
including generic openings, English boilerplate, repeated formulaic sentence frames, thin sections,
mechanical headings, repeated "necessary" phrasing such as "必要があります", and alternate Japanese
commodity phrases such as "求められています" and "と言えます". This prevents drafts from passing
quality checks when they read like generic AI copy. It also flags English boilerplate such as
`today's fast-paced digital landscape`, `today's rapidly evolving landscape`, `comprehensive guide`,
`delve into`, `navigate the complexities`, and `unlock the potential`. Shared English first-party
signal boundaries are also verified in article bodies: `form-based` can preserve the input term
`form`, but `platform_form` does not count as a natural reflection.

Title-quality coverage checks that selected titles and title candidates are specific enough for the
topic. It now also flags short-topic beginner/explainer templates that can make otherwise useful
drafts feel like commodity SEO content before the body is reviewed. It also verifies that English
input terms are not counted when they only appear as substrings inside longer title words, while
hyphenated, slash-separated, and colon-separated title phrases still count as natural input-signal
matches through the same shared helper used by article-quality checks. Underscore-joined tokens
intentionally remain treated as one token, so `form` inside `Platform_form` does not satisfy the
input-signal check.

FAQ-quality coverage now uses the same shared English token helper for input-reflection checks.
Hyphenated FAQ answers such as `form-based` can satisfy the provided input signal `form`, while
underscore-joined technical labels such as `platform_form` do not count as natural FAQ input
reflection.

Publishing-readiness coverage now also checks meta descriptions, image alt quality, source URL
deduplication, author block preservation, edited image alt text in publishable HTML / WordPress post
content, featured image alt text in WordPress media metadata, and WordPress post route propagation of
recoverable publishing failures.

The current local branch also includes implementation commit `89fe2b5`, which hardens article
quality checks and live OpenAI timeout handling:

- Strong-claim detection no longer treats quoted terms, FAQ questions, or explicit negated answers
  as unsupported claims.
- The concrete-detail check can pass with rich editorial anchors such as field examples, decision
  criteria, caveats, and failure patterns even when adding a fabricated number would be worse.
- Article generation now preserves multiple explicit target-reader role phrases more directly.
- Article generation uses a 150 second request timeout, still inside the `/api/generate-article`
  route's 180 second maximum duration.

Additional manual PC browser smoke on 2026-07-06:

- Started a local dev server with dummy test credentials only.
- Checked the app at a 1440 x 1000 PC viewport through the demo login screen.
- Confirmed the main form, sticky article-generation CTA, generation-log collapse/expand, required
  input guidance, reference text input, theme input, and primary-information input did not produce
  console errors.
- Saved local ignored evidence screenshots under `test-results/manual-pc-home.png`,
  `test-results/manual-pc-filled.png`, `test-results/manual-pc-viewport.png`, and
  `test-results/manual-pc-anchor-fixed.png`.
- Found that anchor navigation to the left-column cards could leave the target card slightly under
  the sticky step navigation. Increased the card scroll margin and added an E2E regression assertion.
- Re-ran the targeted core workflow E2E with the new anchor-clearance assertion, and it passed.
- Found that draft-only step navigation items (`承認`, `WordPress`) pointed to sections that do
  not exist before a draft is generated. They now render as disabled, non-link items until a draft
  exists, then become normal anchor links after generation. The core workflow E2E verifies both
  states.
- Performed a generated-draft PC browser smoke using local fallback `.data` and no live providers.
  Confirmed generation-log reopening, draft preview, fullscreen preview, edit form visibility,
  approval/WordPress sections, no page-level horizontal overflow, copy failure recovery messaging
  when clipboard access is unavailable, HTML export success messaging, and zero console errors.
  Additional ignored screenshots were saved under `test-results/manual-generated-draft-*.png`.

## Remaining Proof Gaps

These gaps prevent a true 100/100 completion claim:

- Live OpenAI generation quality now has fresh artifact-producing evidence from 2026-07-08
  17:01-17:04 +09:00 after the timeout and evaluator hardening pass. Three representative samples
  passed the live threshold and wrote ignored JSON/HTML artifacts:
  - `2026-07-08T08-02-32-424Z-one-person-contractor-workers-compensation.json`: score 88; article
    body 92, title 100, FAQ 100, meta 100; remaining body issue was `target-length-alignment`.
  - `2026-07-08T08-03-39-283Z-saas-onboarding-operations.json`: score 88; article body 92, title
    100, FAQ 100, meta 100; remaining body issue was `section-specificity`.
  - `2026-07-08T08-04-38-293Z-aio-content-operations.json`: score 88; article body 100, title 100,
    FAQ 100, meta 100.
  These artifacts include the repeatable editorial checklist, reader/structure snapshot, and
  deterministic quality-check breakdown. A final human editorial review remains useful before
  claiming perfect non-commodity article quality.
- Supabase production write/delete verification passed again on 2026-07-08 15:53 +09:00 with
  explicit user approval and a production-specific confirmation flag. A long-term staging-only
  procedure is still preferable for routine release checks.
- WordPress posting remains guarded by a sandbox live test, but sandbox WordPress credentials are
  not currently proven. The live readiness gate now also requires explicit post, media, and delete
  allow flags because the test creates and cleans up disposable WordPress resources.
- `npm run test:live:readiness` was run on 2026-07-06 and failed closed before any live provider
  calls. Missing sandbox flags/credentials included `AIO_LIVE_CONTRACT_TESTS`, Supabase write
  confirmation variables, and WordPress sandbox credentials. Supabase later passed through the
  explicitly approved production write/delete path; WordPress sandbox readiness remains unresolved
  and now also requires `AIO_LIVE_WORDPRESS_ALLOW_DELETE=1`.
- Manual PC browser review has partially confirmed visual polish and readability for login, the
  initial form, sticky CTA, generation logs, primary-information input, left-card anchor movement,
  generated draft preview/editing, fullscreen preview, copy recovery, HTML export messaging, and
  WordPress section visibility. A live WordPress recovery pass still remains for sandbox credentials.
- CodeRabbit OSS is installed for `kotakase2022-jpg/aio` and responds on PR #1. It is the standard
  PR review path. Cursor Bugbot is optional/backup only.
- The large Loop 2 + Loop 3 work has been committed and pushed to PR #1. Hosted CI and CodeRabbit
  were green at PR head `e7374f7` before the local `89fe2b5` implementation pass. Hosted PR
  automation still needs re-checking after the current local commits are pushed.

## Current Self Score

- Functional reliability and screen transitions: 99 / 100.
- Daily-use article tool UX: 99 / 100.
- Non-commodity generated article quality: 99 / 100.

The scores remain below 100 because live WordPress recovery verification and human review artifacts
for real generated-output quality are not yet complete.

## Next Improvement Targets

Highest-value next actions:

1. Push the current local commits, then re-check hosted Actions and CodeRabbit on PR #1.
2. Fix any new CodeRabbit Critical/High findings first; otherwise proceed to Claude Code review.
3. Review the latest `test-results/live-openai/*.html` outputs for editorial naturalness, not just
   machine score. Pay particular attention to FAQ specificity and whether the target reader is
   obvious in the opening and headings.
4. If a future OpenAI run fails with `insufficient_quota`, verify that the recovered billing/quota
   belongs to the same API-key project stored in `.env.local`.
5. Prepare disposable WordPress sandbox settings in `.env.live.local`, including
   `AIO_LIVE_WORDPRESS_ALLOW_DELETE=1`, then rerun
   `npm run test:live:readiness:wordpress`.
6. Complete the remaining sandbox browser pass focused on real WordPress posting recovery.
