# Gamerhood

**Design it. Wear it. Sell it.**

A kid-powered marketplace where young creators turn their ideas into real merch.
AI-assisted design, premium print-on-demand, and a community that celebrates creativity.

## The Problem

Kids' tastes move faster than any supply chain. A kid who's obsessed with a new game today
wants merch *now* — not in 6 months when a corporate buyer gets around to it. And when they
outgrow it next month, the cycle starts again. Traditional retail can't keep up.

## The Solution

Gamerhood gives kids (supervised by parents) the power to:
1. **Describe** a design in their own words
2. **Watch AI** turn it into print-ready artwork in seconds
3. **Preview** it on hoodies, tees, mugs, posters, and more
4. **Sell** it in their own storefront — or just buy it for themselves

## Tech Stack

- **Framework**: Next.js 15 (App Router), TypeScript, React 19
- **UI**: Tailwind CSS 4, shadcn/ui, Framer Motion
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **Payments**: Stripe Connect (marketplace splits)
- **Print-on-Demand**: Printful API (v2)
- **AI Design**: Replicate (SDXL/Flux) or OpenAI DALL-E
- **State**: Zustand (client cart)
- **Hosting**: Vercel

## Getting Started

**Prerequisites:** Node 20+, [pnpm](https://pnpm.io), access to the team Supabase/Vercel projects.

```bash
git clone https://github.com/sitaram/gamerhood.git
cd gamerhood
pnpm install
cp .env.example .env.local   # then paste real keys (see below)
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### New machine / Cursor on another computer

1. **Clone from GitHub** — code lives in [github.com/sitaram/gamerhood](https://github.com/sitaram/gamerhood). Production deploys do **not** auto-sync to Git unless you commit and push.
2. **Secrets are not in git** — copy `.env.local` from your password manager, or pull Production env vars from [Vercel → gamerhood → Settings → Environment Variables](https://vercel.com) and paste into `.env.local`.
3. **Link Vercel CLI** (only if you deploy from that machine):
   ```bash
   pnpm dlx vercel link
   ```
   The `.vercel/` folder is gitignored; each machine links once.
4. **Open the folder in Cursor** — run `pnpm dev` in the integrated terminal. No extra Cursor config required.

If `git status` on your main machine shows modified files, those changes are **local only** until you `git add`, `commit`, and `push`.

### Environment variables

See `.env.example` for the full list. Minimum for local dev: Supabase trio + Stripe + Printful. AI generation needs `GEMINI_API_KEY`.

## Deploy

See [RELEASE.md](./RELEASE.md) for the full release routine.

| Command | When to use | ~Time |
|---------|-------------|-------|
| `pnpm dev` | Day-to-day development (instant reload) | — |
| `pnpm run deploy:preview` | Quick test on Vercel preview URL, no local lint/build | ~1 min |
| `pnpm run deploy:prod` | Ship to [gamerhood.gg](https://www.gamerhood.gg), no local lint/build | ~1 min |
| `pnpm run release:deploy` | Final gate: lint + build + print-area check, then prod | ~2–3 min |

**Tip:** Use `deploy:prod` while iterating; run `release:check` once before you call a cycle done. There is no way to hot-swap a single file on Vercel — every deploy rebundles the Next.js app.

**Git push:** If the repo is connected to Vercel, pushing to `main` also triggers a production build (no local CLI needed).

## Project Structure

```
src/
  app/
    page.tsx              # Landing page
    create/               # AI Design Studio
    shop/                 # Browse all products
    shop/[slug]/          # Creator storefront
    product/[id]/         # Product detail
    dashboard/            # Creator dashboard
    auth/                 # Login / signup
    api/                  # API routes
  components/
    layout/               # Navbar, footer
    landing/              # Hero, how-it-works, featured, CTA
    storefront/           # Product cards, grids
    studio/               # Design creation components
    ui/                   # shadcn/ui primitives
  lib/
    types.ts              # TypeScript types
    store.ts              # Zustand cart store
    supabase/             # Supabase client helpers
supabase/
  migrations/             # Database schema
```

## Key Features

- **AI Design Studio** — Describe your vision, pick a style, generate artwork
- **Creator Storefronts** — Each creator gets their own branded shop page
- **Gamification** — XP, levels, badges, achievements
- **COPPA Compliant** — Parent-owned accounts, no child PII, parental consent
- **Print-on-Demand** — No inventory, no risk, premium quality via Printful
- **Marketplace Payments** — Stripe Connect splits revenue automatically

## COPPA Compliance

- Parents create and own all accounts
- Children operate as "managed profiles" with display names only (no PII)
- Verifiable Parental Consent required before any child profile goes live
- No tracking cookies, no behavioral advertising on child-facing pages
- No direct messaging between children

## Cost at Scale

| Traffic     | Monthly Cost |
|------------|-------------|
| MVP launch | ~$20-50     |
| Growing    | ~$70-100    |
| Scaling    | Linear      |
