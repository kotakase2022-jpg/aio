# Testing and Quality Gate

This repository uses a strict, reproducible quality gate. A change is not complete unless the
local `quality` command and the GitHub Actions `quality-gate` workflow pass.

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

## Test Integrity Rules

Do not make tests pass by weakening the tests. The following are forbidden:

- Removing important tests to hide a bug
- `test.only`, `describe.only`, `it.only`
- `test.skip`, `describe.skip`, `it.skip`
- `test.todo`, `describe.todo`, `it.todo`
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

Repository administrators must configure branch protection so the `quality-gate` workflow is a
required status check before merging into the protected main branch.

## Adding Features

Every new feature must add or update tests at the correct level:

- Pure logic: unit tests
- Route handlers/storage/API formatting: integration tests
- User-visible workflow: Playwright E2E tests

If a test fails because the implementation is wrong, fix the implementation. Change the test only
when the test specification is demonstrably incorrect, and document the reason in the pull request.
