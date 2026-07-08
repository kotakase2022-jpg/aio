# AGENTS.md

## Operating Model

This repository is developed by alternating between Codex and Claude Code.

- Codex is the primary owner for implementation, feature work, and direct bug fixes.
- Claude Code is the primary owner for review, quality improvement, bug fixes, tests, and specification-gap checks.
- CodeRabbit OSS is the standard automated pull request reviewer for this public repository.
- Cursor Bugbot is optional/backup only. Use it when CodeRabbit is unavailable, when a second opinion is useful, or when the user explicitly asks for it.
- Treat CodeRabbit findings about security, auth, runtime, data integrity, external integrations, and tests as high priority.

## Required Reading Before Work

Before starting any task, Codex must read:

- `AGENTS.md`
- `CLAUDE.md`
- `AI_HANDOFF.md`
- `README.md`
- `package.json`

## Repository

- GitHub: https://github.com/kotakase2022-jpg/aio

## Work Rules

- Keep each work unit to one task whenever possible.
- Do not perform unrelated refactors.
- Do not change existing specifications, UI, or screen transitions without an explicit request.
- Respect existing architecture, tests, and documented workflows.
- Do not delete, skip, or weaken tests to hide implementation defects.
- Do not suppress type errors with careless `any` usage.
- Do not output, read aloud, or commit `.env` values, API keys, passwords, tokens, or other secrets.
- Do not modify production data or use production APIs in tests unless a sandbox contract-test procedure explicitly permits it.

## Quality Gate

Before finishing implementation work, run the project-appropriate checks from `package.json`.
For normal changes, prefer:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

For full validation, use:

```bash
npm run quality
```

If a command fails, do not hide it. Record the failed command, error summary, likely cause, and recommended next action in `AI_HANDOFF.md`.

## Handoff Rule

Before completing or pausing work, Codex must update `AI_HANDOFF.md`.

The handoff must clearly state:

- what changed
- what was verified
- what failed or remains risky
- CodeRabbit review status and any optional Cursor Bugbot findings
- what Claude Code should read or do first

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
