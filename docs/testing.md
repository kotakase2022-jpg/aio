# Testing and Quality Gate

This repository uses a strict, reproducible quality gate. A change is not complete unless the
local `quality` command and the GitHub Actions `quality-gate` workflow pass.

## Mandatory Workflow

All future feature work, bug fixes, and refactors by Codex, Claude Code, Cursor, or humans must follow this
workflow:

1. Create a feature/fix branch from `main`.
2. Open a pull request instead of pushing directly to `main`.
3. Fill in `.github/pull_request_template.md`.
4. Run `npm run quality` locally when practical.
5. Wait for the GitHub Actions `quality-gate` workflow to pass.
6. Wait for the standard CodeRabbit OSS PR review.
7. Merge only after the PR review and required checks pass.

No change is considered done if it bypasses the quality gate, even when the code appears to work
manually.

## Automated PR Review

CodeRabbit OSS is the standard automated PR reviewer for this public repository. Cursor Bugbot has
been demoted to optional backup review to control costs.

Required operating rules:

- CodeRabbit is installed for `https://github.com/kotakase2022-jpg/aio` as part of the selected-repository GitHub App installation.
- CodeRabbit repository configuration is versioned in `.coderabbit.yaml`.
- Every PR should receive a CodeRabbit review before merge unless CodeRabbit is temporarily unavailable.
- Security, auth, data integrity, runtime, external integration, and test findings from CodeRabbit are high priority.
- Cursor Bugbot is optional/backup only. Run it only when CodeRabbit is unavailable, a second opinion is materially useful, or the user explicitly asks for it.
- If Cursor Bugbot is used, record why it was used and how findings were handled in `AI_HANDOFF.md` or the PR.
- CodeRabbit and Bugbot findings do not replace `npm run quality` or the GitHub Actions `quality-gate`.

Manual setup checklist for maintainers:

1. Confirm the repository is public so it qualifies for CodeRabbit OSS.
2. Confirm CodeRabbit still includes `kotakase2022-jpg/aio` under the selected repositories in GitHub App settings.
3. Confirm `.coderabbit.yaml` is detected on the next PR.
4. Open a small test PR and confirm CodeRabbit posts a walkthrough/review.
5. Update branch protection/status-check policy only if CodeRabbit exposes a stable status check in this repository. Keep the workflow job `Typecheck, lint, tests, E2E, build` from `quality-gate` as the mandatory merge check.

## Local Commands

```bash
npm run typecheck
npm run lint
npm run test:integrity
npm run test
npm run test:contract
npm run test:coverage
npm run test:e2e
npm run build
npm run quality
```

`npm run quality` runs, in order:

1. TypeScript typecheck
2. ESLint
3. Test integrity guard
4. Unit and integration tests
5. External contract tests
6. Coverage
7. Playwright E2E
8. Production build

Any failed command must fail the whole quality gate.

## Sandbox Live Contract Tests

The normal `quality` gate intentionally avoids real external services. To reduce provider-drift
risk, run the sandbox-only live checks before major demos, production releases, or changes to
OpenAI / Supabase / WordPress integration code.

These commands are opt-in and must never target production data:

```bash
npm run test:live:openai
npm run test:live:supabase
npm run test:live:wordpress
npm run test:live:readiness
npm run test:live
npm run quality:live
```

Required common flag:

```bash
AIO_LIVE_CONTRACT_TESTS=1
```

Keep sandbox credentials separate from normal app credentials:

```bash
cp .env.live.example .env.live.local
```

`.env.live.local` is git-ignored and is loaded before `.env.local` by the readiness script and live
tests. Use it for disposable sandbox/staging OpenAI, Supabase, and WordPress settings so a developer
does not accidentally point live contract tests at production resources.

`npm run test:live` and `npm run quality:live` always run readiness first before any live provider
call. You can also run `npm run test:live:readiness` by itself when you only want to confirm
environment readiness; it never calls external APIs. Provider-specific readiness commands are also
available:

```bash
npm run test:live:readiness:openai
npm run test:live:readiness:supabase
npm run test:live:readiness:wordpress
```

OpenAI live checks require:

```bash
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=
OPENAI_LIVE_TEXT_MODEL=
AIO_LIVE_GENERATION_MIN_SCORE=75
AIO_LIVE_OPENAI_WRITE_ARTIFACTS=0
AIO_LIVE_OPENAI_ARTIFACT_DIR=test-results/live-openai
```

`test:live:openai` verifies a real Responses API structured-output call and then runs three
disposable article-generation samples with `imageCount: 0`. The generated drafts are evaluated by
the same article quality checker used in the product, including theme, primary information,
reference information, and competitor-signal reflection.
Set `OPENAI_LIVE_TEXT_MODEL` when the live sandbox should use a different model from the app's
normal `OPENAI_TEXT_MODEL` setting.
Set `AIO_LIVE_OPENAI_WRITE_ARTIFACTS=1` when a demo or release needs human-readable review evidence
for generated article quality. The live test then writes ignored JSON and HTML artifacts under
`AIO_LIVE_OPENAI_ARTIFACT_DIR` (default `test-results/live-openai`) without including provider
secrets or environment values. The artifact directory must resolve inside `test-results` or the OS
temporary directory, so review files are not accidentally written to tracked repository paths.

Supabase live checks should normally use a non-production project:

```bash
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
AIO_LIVE_SUPABASE_ALLOW_WRITE=1
AIO_LIVE_CONFIRM_NON_PRODUCTION=1
AIO_LIVE_SANDBOX_HOST_ALLOWLIST=
```

`test:live:supabase` writes a disposable `article_inputs` generation job, reads it back, confirms it
appears in logs, and deletes the row in cleanup. Use only a staging project with the app schema
installed. If the sandbox host does not contain an obvious sandbox marker such as `sandbox`,
`staging`, `test`, `dev`, `preview`, or `demo` (for example a randomly named Supabase project),
add the exact hostname to `AIO_LIVE_SANDBOX_HOST_ALLOWLIST` after verifying it is not production.

If the user explicitly approves production write/delete verification, do not set
`AIO_LIVE_CONFIRM_NON_PRODUCTION=1`. Use the production-specific confirmation instead:

```bash
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
AIO_LIVE_SUPABASE_ALLOW_WRITE=1
AIO_LIVE_CONFIRM_PRODUCTION_WRITE=1
```

Production live verification must remain limited to the disposable `live-contract-*` generation job
row created by the test and its cleanup delete. Never commit `SUPABASE_SERVICE_ROLE_KEY`, and never
set both `AIO_LIVE_CONFIRM_NON_PRODUCTION=1` and `AIO_LIVE_CONFIRM_PRODUCTION_WRITE=1`.

WordPress live checks require a sandbox WordPress site and Application Password:

```bash
WORDPRESS_SANDBOX_SITE_URL=
WORDPRESS_SANDBOX_USERNAME=
WORDPRESS_SANDBOX_APPLICATION_PASSWORD=
AIO_LIVE_WORDPRESS_ALLOW_POST=1
AIO_LIVE_WORDPRESS_ALLOW_MEDIA=1
AIO_LIVE_WORDPRESS_ALLOW_DELETE=1
AIO_LIVE_CONFIRM_NON_PRODUCTION=1
AIO_LIVE_SANDBOX_HOST_ALLOWLIST=
WORDPRESS_ENCRYPTION_KEY=
```

`test:live:wordpress` creates a disposable draft post with a tiny featured image, verifies it
through the REST API, and deletes both the post and uploaded media in cleanup. Use only a sandbox
WordPress user that can create and delete posts and media. The separate post, media, and delete
allow flags must all be set to `1` so cleanup-capable live tests are never run by accident. If the
sandbox hostname is not visibly a sandbox/staging/test host, add the exact hostname to
`AIO_LIVE_SANDBOX_HOST_ALLOWLIST`.

If any live test fails, do not mark the external integration risk as resolved. Fix the
implementation or sandbox configuration, rerun the failing live command, and keep failure output out
of public logs if it contains provider-specific details.

## Local Git Hooks

Husky is configured for lightweight local checks:

- `pre-commit`: `npm run hook:pre-commit`
- `pre-push`: `npm run hook:pre-push`

The hooks run lint, typecheck, unit/integration/contract tests, and the test integrity guard before
changes leave the workstation. They intentionally do not run Playwright E2E or production build,
because GitHub Actions remains the authoritative full gate for heavier checks.

## Test Integrity Rules

Do not make tests pass by weakening the tests. The following are forbidden:

- Removing important tests to hide a bug
- `test.only`, `describe.only`, `it.only`, `test.describe.only`
- `test.skip`, `describe.skip`, `it.skip`, `test.describe.skip`
- `test.todo`, `describe.todo`, `it.todo`, `test.describe.todo`
- `test.fixme`, `describe.fixme`, `it.fixme`, `test.describe.fixme`
- `test.describe.serial.only`, `test.describe.parallel.skip`, and equivalent serial/parallel variants
- `test.describe.configure({ mode: "skip" })`
- Commenting out large blocks of tests
- Replacing an E2E business flow with a render-only smoke test
- Mocking a failed feature as successful instead of fixing the implementation
- Ignoring `console.error`, `pageerror`, unhandled rejections, or unexpected 4xx/5xx responses

`npm run test:integrity` detects skipped/focused tests, large commented-out test blocks,
missing E2E tests, and test blocks that do not appear to contain assertions.

## Fixtures

Fixtures live under `tests/fixtures`.

- `tests/fixtures/article.ts`: safe mock article, draft, and generation job data
- `tests/fixtures/api/*.json`: API mock responses for E2E
- `tests/fixtures/csv/*.csv`: valid, empty, invalid, and boundary CSV data
- `tests/fixtures/files/*`: safe document files for PDF, DOCX, PPTX, and XLSX extraction tests

Regenerate document fixtures after changing the extractor:

```bash
node scripts/generate-document-fixtures.mjs
```

Fixtures must not contain production data, personal information, API keys, or customer content.

## E2E

E2E tests use Playwright Chromium at a PC viewport. They start the app with `next dev` through
Playwright `webServer` and set safe test environment variables.

Install browsers when needed:

```bash
npx playwright install chromium
```

Run:

```bash
npm run test:e2e
```

E2E tests must fail on unexpected:

- `pageerror`
- `console.error`
- failed network requests
- unexpected 4xx/5xx responses
- hydration/runtime errors surfaced in the browser console

Expected error responses can be allow-listed only inside the test that asserts the corresponding
user-facing error message.

## Coverage

Coverage is enforced for statements, branches, functions, and lines. Do not lower thresholds to hide
uncovered implementation paths; add tests or explain a narrowly scoped threshold change in review.

Current minimum thresholds are:

- Statements: 75%
- Branches: 55%
- Functions: 80%
- Lines: 75%

## Environment

The quality gate does not require production Supabase, OpenAI, or WordPress credentials.
Tests use local temporary storage, local sandbox HTTP servers, and mocked external API responses.
Contract tests validate the request and response shape for:

- OpenAI Responses API structured JSON output
- OpenAI Image API generation payloads
- WordPress REST API terms, media upload, and post creation
- Supabase/PostgREST service-role reads and writes

These tests must never point at production services or production data. When a real staging project
is added later, use dedicated non-production credentials and disposable records only.

Relevant test-safe variables:

```bash
DEMO_ACCESS_CODE=202607
OPENAI_API_KEY=test-openai-key-not-used-in-ci
WORDPRESS_ENCRYPTION_KEY=ci-wordpress-encryption-key-32-bytes
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_GATEWAY_TOKEN=
```

## CI

GitHub Actions workflow:

```text
.github/workflows/quality-gate.yml
```

It runs on pull requests and pushes to `main`, `master`, and `release/**`.
The workflow must continue to run:

- TypeScript typecheck
- ESLint
- Test integrity guard for `skip` / `only` / `todo` / suspicious disabling
- Unit and integration tests
- External contract tests
- Coverage
- Playwright E2E
- Production build

Artifacts are uploaded for:

- Playwright HTML report
- Playwright traces/screenshots/videos
- Coverage report

When CI fails, inspect the failed step first. For E2E failures, download the Playwright artifacts
and open the HTML report:

```bash
npx playwright show-report playwright-report
```

## Branch Protection

Repository administrators must configure branch protection for `main`. If Codex cannot set it
directly through GitHub permissions, apply these settings manually in GitHub:

1. Open the repository on GitHub.
2. Go to `Settings` -> `Branches` -> `Add branch protection rule`.
3. Set `Branch name pattern` to `main`.
4. Enable `Require a pull request before merging`.
5. Enable `Require status checks to pass before merging`.
6. Select the workflow job status check `Typecheck, lint, tests, E2E, build` from `.github/workflows/quality-gate.yml`. GitHub required status checks use job names, not the workflow file name.
7. Enable `Require branches to be up to date before merging`.
8. Restrict who can push to matching branches, or otherwise disallow direct pushes to `main`.
9. Disable bypass permissions for administrators if the repository policy allows it.

The intended policy is: no direct pushes to `main`, no merge without PR, and no merge unless
the workflow job `Typecheck, lint, tests, E2E, build` passes.

## Vercel Production Deployments

Production Vercel deployments must be based on `main` only. A production deployment assumes the
change first passed the GitHub Actions workflow job `Typecheck, lint, tests, E2E, build` on its
pull request and then entered `main` through the protected branch workflow.

Preview deployments from feature branches are acceptable, but they do not replace the required
required workflow job result before merge.

## Adding Features

Every new feature must add or update tests at the correct level:

- Pure logic: unit tests
- Route handlers/storage/API formatting: integration tests
- User-visible workflow: Playwright E2E tests
- New screens: add corresponding Playwright E2E coverage
- New forms: add normal-path and error-path tests
- New APIs: add normal-path, error-path, and permission/error tests
- CSV / PDF / image / upload changes: add or update fixtures
- Supabase tables, RLS, or persistence changes: add data consistency tests
- Bug fixes: add a failing reproduction test first when practical, confirm it fails, then fix the implementation

If a test fails because the implementation is wrong, fix the implementation. Change the test only
when the test specification is demonstrably incorrect, and document the reason in the pull request.
Deleting, skipping, commenting out, or weakening existing tests to make a change pass is prohibited.
