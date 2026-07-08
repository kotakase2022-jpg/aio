# PR Review Automation

## Standard Policy

CodeRabbit OSS is the standard automated pull request reviewer for this public repository.
Cursor Bugbot is optional backup only.

Use Cursor Bugbot only when:

- CodeRabbit is unavailable or fails to review a PR.
- A risky change needs a second automated opinion.
- The user explicitly asks for Bugbot.

CodeRabbit and Bugbot are advisory review tools. They do not replace:

- `npm run quality`
- GitHub Actions workflow job `Typecheck, lint, tests, E2E, build`
- Claude Code review
- human review for risky production, security, data, or external-integration changes

## Why We Changed

The previous workflow treated Cursor Bugbot as the normal review step between Codex and Claude Code.
For cost control, the normal PR review path is now CodeRabbit OSS. Bugbot remains available only as
a reserve reviewer.

## Required Setup

Repository maintainers should complete this once:

1. Confirm `https://github.com/kotakase2022-jpg/aio` is public.
2. Keep CodeRabbit enabled for `kotakase2022-jpg/aio` in the selected-repository GitHub App installation.
3. Keep `.coderabbit.yaml` at the repository root.
4. Open a small PR and confirm CodeRabbit posts a walkthrough/review.
5. Comment `@coderabbitai configuration` on a PR to confirm CodeRabbit resolved the expected repository YAML.
6. Keep the GitHub Actions workflow job `Typecheck, lint, tests, E2E, build` from `quality-gate` as the mandatory branch-protection status check.
7. If CodeRabbit exposes a stable status check in this repository, optionally add it to branch protection after confirming it behaves reliably.

## Per-PR Workflow

1. Codex implements the scoped change.
2. Codex updates `AI_HANDOFF.md`.
3. Open or update the PR.
4. GitHub Actions workflow job `Typecheck, lint, tests, E2E, build` runs.
5. CodeRabbit OSS reviews the PR automatically using `.coderabbit.yaml`.
6. Claude Code reviews CodeRabbit findings, fixes valid issues, and updates `AI_HANDOFF.md`.
7. Cursor Bugbot is skipped unless one of the backup conditions applies.

## Required Documentation

When automated review runs, record status in the PR or `AI_HANDOFF.md`:

- CodeRabbit review status and important findings.
- How valid CodeRabbit findings were addressed.
- Any findings intentionally deferred, with rationale.
- If Cursor Bugbot was used, why it was used and how findings were handled.

## Finding Priority

Treat these CodeRabbit findings as high priority:

- Security and authentication issues.
- Secret exposure or client-side leakage of server-only data.
- Supabase, WordPress, OpenAI, or Vercel integration failures.
- Data loss, corrupted persistence, or inconsistent draft/log state.
- Runtime crashes, hydration errors, network error handling gaps, or console errors.
- Broken tests, weakened tests, or missing coverage for changed critical behavior.

Lower-priority style suggestions may be deferred when they would enlarge the diff or distract from
the current task.

## Notes For AI Agents

- Do not run Cursor Bugbot by default.
- Do not claim CodeRabbit reviewed a PR unless the PR actually has CodeRabbit output.
- Do not merge or mark work complete only because CodeRabbit is clean; quality gates must still pass.
- Keep `.coderabbit.yaml`, `AGENTS.md`, `CLAUDE.md`, and `AI_HANDOFF.md` aligned when review policy changes.
- Use `@coderabbitai configuration` on a PR when the effective review settings are unclear.
