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
- **Print-on-Demand**: Printify API
- **AI Design**: Replicate (SDXL/Flux) or OpenAI DALL-E
- **State**: Zustand (client cart)
- **Hosting**: Vercel

## Getting Started

```bash
pnpm install
cp .env.example .env.local  # fill in your keys
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

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
    mock-data.ts          # Development mock data
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
- **Print-on-Demand** — No inventory, no risk, premium quality via Printify
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
