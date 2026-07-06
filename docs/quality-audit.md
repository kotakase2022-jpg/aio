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

The latest local full gate passed on 2026-07-06 11:33 +09:00 after addressing
three additional P2 review findings:

- `npm run typecheck`
- `npm run lint`
- `npm run test:integrity`
- `npm run test`
- `npm run test:contract`
- `npm run test:coverage`
- `npm run test:e2e`
- `npm run build`

The latest previously verified pushed GitHub Actions run also passed:

- Commit: `51c518c`
- Workflow: `quality-gate`
- Job: `Typecheck, lint, tests, E2E, build`
- Run: `28763865925`
- Result: success across setup, dependency install, typecheck, lint, test integrity, unit/integration
  tests, external contract tests, coverage, Playwright E2E, production build, and artifact upload.

Note: the current local review-finding fixes are not included in that previously verified pushed
run yet. They passed the local full quality gate above and should be rechecked in GitHub Actions
after the next push.

Current E2E coverage includes 45 Chromium PC tests across the core article workflow, required-input
validation, failure recovery, file/URL retry behavior, generation logs, WordPress posting, draft
state transitions, copy/export recovery, persistent generation jobs, uploaded images, and previous
input reuse.

Article-quality coverage now also checks that supplied first-party/primary information appears in
the opening decision frame, not only later in the body. This prevents drafts from passing quality
checks when they read like generic AI copy until a late paragraph briefly mentions the user's own
field evidence.

The latest review-finding regression coverage also checks that newsletter-related article evidence
is not stripped as HTML noise, uploaded author portraits survive even when the AI wrote an author
section, and `.env.live.local` overrides production-like shell app env during live sandbox readiness
checks.

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

- Live OpenAI generation quality has not been verified against disposable sandbox credentials in
  this loop.
- Live Supabase persistence and WordPress posting are guarded by sandbox live tests, but the required
  non-production environment variables are not currently proven.
- `npm run test:live:readiness` was run on 2026-07-06 and failed closed before any live provider
  calls. Missing sandbox flags/credentials included `AIO_LIVE_CONTRACT_TESTS`, Supabase write
  confirmation variables, and WordPress sandbox credentials. The configured Supabase host did not
  look like a sandbox/staging host, so non-production confirmation is still required before any live
  write test.
- Manual PC browser review has partially confirmed visual polish and readability for login, the
  initial form, sticky CTA, generation logs, primary-information input, left-card anchor movement,
  generated draft preview/editing, fullscreen preview, copy recovery, HTML export messaging, and
  WordPress section visibility. A live WordPress recovery pass still remains for sandbox credentials.
- CodeRabbit OSS is installed for `kotakase2022-jpg/aio` and responds on PR #1. Codex automated
  review surfaced additional P2 findings after commit `984decc`; the current local work addresses
  the remaining newsletter, author portrait, and live-env findings. CodeRabbit's latest inline
  findings should still be checked after the next push.
- The large Loop 2 + Loop 3 work has been committed and pushed to PR #1. The current local worktree
  has review-finding fixes that still need commit, push, and hosted CI confirmation.

## Current Self Score

- Functional reliability and screen transitions: 99 / 100.
- Daily-use article tool UX: 98 / 100.
- Non-commodity generated article quality: 98 / 100.

The scores remain below 100 because live sandbox checks, hosted CodeRabbit PR review, live WordPress
recovery verification, and live generated-output quality review are not yet complete.

## Next Improvement Targets

Highest-value next actions:

1. Re-check PR #1 for CodeRabbit's latest review response after the `@coderabbitai review` request
   on 2026-07-06 10:55 +09:00.
2. Fix any new CodeRabbit Critical/High findings first; otherwise proceed to Claude Code review.
3. Prepare disposable live-test settings in `.env.live.local`, then rerun `npm run test:live:readiness`.
4. Run sandbox live checks only after readiness passes and every target is confirmed non-production.
5. Complete the remaining sandbox browser pass focused on real WordPress posting recovery.
