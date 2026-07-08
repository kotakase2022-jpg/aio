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
Hosted CodeRabbit and Actions must be re-checked after the handoff/docs update is pushed.

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
- CodeRabbit OSS is installed for `kotakase2022-jpg/aio` and responds on PR #1. It is the standard
  PR review path. Cursor Bugbot is optional/backup only.
- The large Loop 2 + Loop 3 work has been committed and pushed to PR #1. Hosted CI and CodeRabbit
  are green through handoff/docs head `c2e66ab`; re-check any later status-only handoff commits on
  the current PR head.

## Current Self Score

- Functional reliability and screen transitions: 99 / 100.
- Daily-use article tool UX: 99 / 100.
- Non-commodity generated article quality: 99 / 100.

The scores remain below 100 because live sandbox checks, live WordPress recovery verification, and
human review of real generated-output quality are not yet complete.

## Next Improvement Targets

Highest-value next actions:

1. Re-check hosted Actions and CodeRabbit if a new status-only handoff commit is pushed after
   `c2e66ab`.
2. Re-check PR #1 for any later CodeRabbit inline findings after the latest push.
3. Fix any new CodeRabbit Critical/High findings first; otherwise proceed to Claude Code review.
4. Prepare disposable live-test settings in `.env.live.local`, then rerun `npm run test:live:readiness`.
5. Run sandbox live checks only after readiness passes and every target is confirmed non-production.
6. Complete the remaining sandbox browser pass focused on real WordPress posting recovery.
