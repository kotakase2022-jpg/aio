# AIO Article Generator

PCブラウザ向けのAIO記事半自動生成MVPです。参照情報、競合情報、テーマ、画像トーンを入力し、OpenAI Responses APIで記事ドラフトと画像を生成して、編集・承認後にWordPress REST APIへ投稿できます。

## Stack

- Next.js App Router / TypeScript / Tailwind CSS
- shadcn/ui style components
- OpenAI Responses API (`web_search`, structured outputs, image generation)
- Supabase Postgres / Storage ready, local fallback for MVP
- WordPress REST API + Application Password

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Required for local article generation:

- `OPENAI_API_KEY`

Required for Supabase persistence and Storage on Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- Run `supabase/migrations/001_initial_schema.sql`

Required for production WordPress credential storage:

- `WORDPRESS_ENCRYPTION_KEY`

When Supabase is not configured, drafts and WordPress connections are stored in `.data/` for local MVP verification only.

## Scripts

```bash
npm run lint
npm run typecheck
npm run test
npm run test:contract
npm run test:coverage
npm run test:e2e
npm run build
npm run quality
```

## Testing and CI

See [docs/testing.md](docs/testing.md) for the strict local quality gate, Playwright E2E workflow,
fixtures, CI artifact handling, and the rule that tests must not be removed, skipped, or weakened to
hide implementation bugs. Configure GitHub branch protection so `quality-gate` is required before
merging to the protected main branch.
