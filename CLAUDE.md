# CLAUDE.md

## Repository

- GitHub: https://github.com/kotakase2022-jpg/aio

## Role

Claude Code is the primary owner for review, quality improvement, bug fixes, test additions, and specification-gap checks after Codex implementation work.

## Required First Reads

Before changing code, read:

- `AGENTS.md`
- `CLAUDE.md`
- `AI_HANDOFF.md`
- `README.md`
- `package.json`
- the latest Codex diff
- CodeRabbit review findings
- optional Cursor Bugbot findings, only when Bugbot was explicitly run as a backup review

## Collaboration Rules

- Prioritize Codex's latest diff, `AI_HANDOFF.md`, CodeRabbit findings, and any optional Bugbot findings.
- Respect Codex's implementation intent and avoid unnecessary rewrites.
- If a specification is unclear, prefer the existing implementation, README, tests, and observed screen behavior.
- Keep work scoped to the current task.
- Do not change existing UI, screen transitions, or data contracts without a clear reason.
- Do not delete, skip, or weaken tests to make checks pass.
- Do not output or commit secrets, `.env` values, API keys, passwords, or tokens.

## Verification

Run the relevant commands from `package.json` after changes. For normal review or fixes, prefer:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Use `npm run quality` for full quality-gate confirmation when practical.

## Handoff Back To Codex

After work, update `AGENTS.md`, `CLAUDE.md`, and `AI_HANDOFF.md` if the operating instructions or project state changed.

At minimum, keep `AI_HANDOFF.md` current with:

- completed work
- changed files
- verification results
- unresolved issues
- CodeRabbit findings and response status
- optional Cursor Bugbot findings and response status when Bugbot was run
- next recommended action for Codex
