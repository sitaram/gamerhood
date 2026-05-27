# Gamerhood Launch & Protection Checklist

> Living checklist of everything to do before / after launching publicly. Started 2026-05-24.
> Check items off as completed. Add notes inline.

---

## 🏢 Once LLC paperwork is approved

### Stripe migration (personal → LLC)
- [ ] Get **EIN** from IRS (free, 5 min online at https://irs.gov/businesses/employer-identification-number — needs the LLC to exist first)
- [ ] Open **business bank account** under LLC name + EIN (Mercury, Relay, Bluevine = online; or any local bank)
- [ ] In Stripe Dashboard → Settings → Business details:
  - [ ] Change **Legal business name** from your personal name → LLC name (e.g., "Gamerhood LLC")
  - [ ] Change **Business type** from "Individual / sole proprietorship" → "Single-member LLC" (or whichever fits)
  - [ ] Change **Tax ID** from SSN → EIN
  - [ ] Change **Business address** to LLC's registered address (can still be home address, but match what's on the LLC filing)
- [ ] Update **Stripe payout bank** to the new business bank account (Settings → Payouts)
- [ ] Stripe will trigger **re-verification** — usually 1–3 business days. Payouts may pause until verified.
- [ ] Update Connect platform settings if needed (Settings → Connect → Platform profile)
- [ ] **Reconcile 1099s**: any 1099-Ks issued to you personally before the switch stay tied to your SSN; after switch they go to the EIN. Keep clean records of the switch date for taxes.

### Legal docs to update
- [ ] **LLC Operating Agreement** drafted and signed (even for single-member LLC — proves you're treating it as a real entity, critical for liability shield). Free template at https://www.northwestregisteredagent.com/llc/operating-agreement
- [ ] **Terms of Service** updated to name the LLC as the operating entity (search the page for any "Gamerhood" and add ", LLC" where it refers to the company)
- [ ] **Privacy Policy** updated to name the LLC as the data controller
- [ ] **FAQ** updated similarly

### Bank/Finance separation (critical for liability shield)
- [ ] Use business bank for ALL business income + expenses, no commingling
- [ ] Get a **business credit card** under the LLC (build business credit, cleaner bookkeeping)
- [ ] Move any platform-fee revenue currently in personal account → business account (record as owner contribution)

---

## 🛡️ Insurance (target: within 30 days of going live)

For a kids-facing e-commerce platform with physical goods + user-uploaded content + minors' data, the risk surface is real. Get coverage before any meaningful traffic.

- [ ] **General Liability** insurance ($300–800/yr) — covers basic claims, slip-and-fall, etc.
- [ ] **Product Liability** insurance — for defective merch (hoodies that catch fire, dye allergies, etc.). Usually bundled with general liability or as a rider.
- [ ] **Errors & Omissions (E&O) / Tech E&O** — covers claims that your software/service caused harm (e.g., a bug caused a creator to lose payouts)
- [ ] **Cyber Liability** insurance — covers data breaches, especially important with kids' PII. Expensive but increasingly required.
- [ ] Consider a **Business Owner's Policy (BOP)** that bundles general + product liability — easier and cheaper than buying separately

**Insurers good for small online businesses:**
- Hiscox (https://hiscox.com)
- Next Insurance (https://nextinsurance.com)
- Coalition (https://coalitioninc.com) — strong on cyber
- The Hartford
- Thimble (https://thimble.com) — flexible coverage

Get 3 quotes. Expect $500–$2,500/yr total for a small e-commerce kids' platform.

---

## ⚖️ Legal / Compliance (do BEFORE inviting real users)

### COPPA (if accepting users under 13)
- [ ] Decide: accept under-13s with verifiable parental consent, OR age-gate at 13+ to avoid COPPA entirely
- [ ] If under-13: add a real **verifiable parental consent** flow (current checkbox is "minimal verification" — for true COPPA-safe-harbor, use credit card check or third-party service like PRIVO/kidSAFE)
- [ ] Privacy Policy must specifically address children's data, parents' rights to review/delete, what's collected
- [ ] Designate a COPPA contact email (e.g., `privacy@gamerhood.gg`)
- [ ] Consider enrolling in a **COPPA Safe Harbor program** (PRIVO, ESRB Privacy Certified, kidSAFE) — costs $200–$500/mo but limits FTC liability

### DMCA (for user-uploaded designs)
- [ ] Register a **DMCA agent** with the US Copyright Office (https://dmca.copyright.gov) — $6, every 3 years
- [ ] Without this you don't qualify for DMCA safe harbor → copyright lawsuits become YOUR problem, not the user's
- [ ] Add a "Report copyright infringement" link in the footer pointing to the agent's contact info

### Trademark (optional but smart)
- [ ] Search USPTO database (https://tmsearch.uspto.gov) for existing "Gamerhood" marks
- [ ] If clear, file trademark application — ~$350 per class (Class 9 software, Class 35 retail services, Class 25 apparel are likely relevant)
- [ ] Use https://stripe.com/atlas if you used Atlas for LLC formation — they have trademark help

### Terms & policies to publish
- [ ] **Terms of Service** (you have one) — review for LLC naming once formed
- [ ] **Privacy Policy** (you have one) — same
- [ ] **Refund policy** (separate page or section)
- [ ] **Acceptable Use Policy** for creators (what designs are/aren't allowed)
- [ ] **DMCA / Copyright policy**
- [ ] **Shipping & delivery policy** (Printful handles fulfillment — set expectations: 5–10 days)
- [ ] **Cookie consent banner** if you ever add analytics/tracking

---

## 💰 Tax / Accounting (set up before first sale, or first month at the latest)

- [ ] Get a **bookkeeping tool**: Wave (free), QuickBooks Self-Employed (~$15/mo), Bench (managed, ~$300/mo)
- [ ] Set aside **25–30% of net profit** for taxes from day one — separate "tax savings" account in the business bank
- [ ] Pay **quarterly estimated taxes** (IRS Form 1040-ES) — Q1 due Apr 15, Q2 Jun 15, Q3 Sep 15, Q4 Jan 15 of following year. Penalties if you skip.
- [ ] Track all business expenses for deductions (software subs, domain/hosting, Stripe fees, Printful samples, ads, equipment)
- [ ] Consider a **CPA** for end-of-year tax filing — esp. once revenue exceeds ~$30K/yr
- [ ] **Sales tax**: most states require platforms to collect sales tax for in-state customers. Either:
  - Use **Stripe Tax** (~0.5% per transaction, automatic) — easiest
  - Use **Avalara** / **TaxJar** (more powerful, more setup)
  - Manually file in your home state only if you stay below other states' economic nexus thresholds (~$100K/yr in most states)
- [ ] Stripe will issue **1099-K** to you (the platform) for total processing volume — get this and reconcile with your books
- [ ] Stripe issues **1099-NEC** to creators earning $600+/yr — they need to provide W-9/W-8BEN during onboarding (Express handles this)

---

## 🔒 Security / Operational (within 30–60 days of launch)

- [ ] **Error monitoring**: Sentry (free hobby tier) or similar — without it you'll only learn about prod errors from user emails
- [ ] **Two-factor auth** on:
  - [ ] Stripe Dashboard (essential)
  - [ ] Supabase Dashboard
  - [ ] Vercel
  - [ ] Domain registrar (Cloudflare)
  - [ ] Resend
  - [ ] Google (where your Cursor/Gmail lives)
  - [ ] GitHub
- [ ] **Strong password manager** (1Password, Bitwarden) — never reuse passwords across services
- [ ] **Domain privacy / WHOIS protection** enabled at registrar (Cloudflare does this automatically)
- [ ] **Don't expose personal email/phone publicly** — use `support@gamerhood.gg` forwarding
- [ ] **Regular Supabase backups** — confirm you're on a tier with automated daily backups (free tier doesn't include)
- [ ] **Vendor due diligence** — verify SOC 2 or equivalent for Stripe ✓, Supabase ✓, Printful ✓, Resend ✓, Vercel ✓
- [ ] **Data retention policy** + **deletion workflow** (right-to-delete requests under CCPA/GDPR)
- [ ] **Incident response plan** — document what you do if there's a data breach: notify users within 72 hours (GDPR) / state law (CCPA), engage cyber insurance, contact lawyer

---

## 📋 Pre-launch testing (final pass before announcing publicly)

- [x] **Pre-payment print-area drift safeguard** — `checkout.session.completed` re-fetches Printful's live `placement_dimensions` for each line item and compares to the value cached on `printful_blank_mockups` (`print_area_width_in` / `print_area_height_in`). If any line drifts past 1% on either axis, we set `orders.needs_manual_review = true` (migration 032), skip the Printful submission, log `[print-area-drift]`, and email every `ADMIN_EMAILS` recipient. The buyer's "Order Confirmed" email still goes out so they aren't left in the dark. Code path: `src/lib/print/drift-safeguard.ts` ⇒ called from `src/app/api/webhooks/stripe/route.ts`. (Belt-and-suspenders behind the build-time + render-time unification.)
- [ ] **Run regression script before every prod deploy** — `node scripts/check-print-area-consistency.mjs` iterates every product type, pulls a sample published listing, re-verifies its cached print area vs. Printful's live `placement_dimensions`, and asserts the unified `computeDesignOverlayBox` helper returns consistent inches. Exits non-zero on drift. Run manually as part of the deploy ritual.
- [ ] **photoBand stays a fallback only** — `src/lib/create/merch-preview-layout.ts` holds hand-tuned framing for the *garment-on-photo* position; print area in inches comes from `printful_blank_mockups` (migration 023) via `usePrintfulBlankPhoto().area`. Every preview surface (`PrintPlacementEditor`, `MerchPlacementPreview`, `PhotographicColorMockup`, cart thumb, listing edit thumb) flows through `computeDesignOverlayBox` so the design size always reflects the live print area. Do not re-introduce per-surface arithmetic against `printMaxWidthPct`.
- [ ] **Stripe Live mode** fully configured (separate from Sandbox — needs its own Connect setup, separate keys, separate webhook)
- [ ] **End-to-end real purchase test** in Live mode with a small $1 product, your own card
- [ ] **Email deliverability**: confirm Resend domain green (SPF/DKIM/DMARC on Cloudflare), send to Gmail/Yahoo/Hotmail and confirm inbox (not spam)
- [ ] **`support@gamerhood.gg` inbox**: set up Cloudflare Email Routing or ImprovMX (free, 5 min) to forward to your real inbox
- [ ] **`GOOGLE_CLOUD_VISION_API_KEY`** pushed to Vercel Production (currently missing — image moderation silently no-op'd)
- [ ] **Stripe webhook secret** regenerated for the new Stripe account (currently stale — webhook signature verification silently failing)
- [ ] **Test creator onboarding** end-to-end as a fresh user (not admin)
- [ ] **Mobile testing** on a real phone — iOS Safari + Android Chrome
- [ ] **Page speed audit** via https://pagespeed.web.dev — LCP under 2.5s
- [ ] **Refund handling** — either build UI or document manual process
- [ ] **Chargeback webhook** (`charge.dispute.created`) — don't miss disputes

---

## 🚀 Day-1 launch checklist (the actual day)

- [ ] Flip Stripe from Sandbox keys → Live keys on Vercel (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, any publishable)
- [ ] Run one final end-to-end real purchase test
- [ ] Announce to small audience first (10–20 friends/family) before wide launch
- [ ] Monitor Sentry / Vercel logs actively for first 48 hours
- [ ] Set up Stripe email alerts for first successful payment, first dispute, first refund
- [ ] Have a "soft launch" doc explaining known issues / new platform / how to report bugs

---

## 📞 Who to call when something goes wrong

| Issue | Who to contact |
|-------|----------------|
| Payment dispute / chargeback | Stripe support (chat in dashboard) |
| Tax question | Your CPA |
| Lawsuit / legal threat | Lawyer immediately, don't respond to plaintiff directly |
| Data breach | Cyber insurance hotline + lawyer, notify users within 72 hours |
| User report of CSAM / abuse | NCMEC CyberTipline (https://report.cybertip.org) + law enforcement |
| User report of copyright infringement | Process DMCA takedown via DMCA agent |
| Site down | Vercel status + Supabase status, then your error monitoring |
| Suspected fraud | Stripe Radar dashboard |

---

## 🧹 Schema deprecations to clean up post-launch

### Multiple-storefronts migration follow-ups (added 2026-05-25)
- [ ] **Drop `profiles.storefront_*` columns** once every reader has switched to the `storefronts` table. Currently still populated for read-after-write parity (mirrored by `PATCH /api/storefronts/[id]` and `POST /api/storefronts/[id]/set-default` on the *default* storefront, and by the legacy `StorefrontSettingsForm` flow). Affected columns:
  - `profiles.slug` (will need a follow-up migration to drop the unique index too)
  - `profiles.catchphrase`
  - `profiles.storefront_avatar_url`
  - `profiles.storefront_banner_url`
  - `profiles.storefront_hero_image_url`
  - Likely keep: `profiles.storefront_headline`, `profiles.storefront_subhead`, `profiles.storefront_hero_overlay`, `profiles.store_seo_*`, `profiles.store_tags` (these are SEO/profile-level and not per-storefront in v1).
  - Path: search the repo for `storefront_avatar_url`, `storefront_banner_url`, `storefront_hero_image_url` reads and verify they all go through `getStorefrontBySlug` / `listStorefrontsByOwner`, then ship the column-drop migration.
- [ ] **Drop `products.creator_id` / `products.profile_id`** — wait, in our schema this is `products.profile_id` (no `creator_id` column exists). Once every reader switches to `storefronts.owner_profile_id` via the `storefront_id` join, drop `products.profile_id` and its index. Currently every product row writes BOTH `profile_id` and `storefront_id` for backwards compat. Search: `profile_id` references in `src/lib/supabase/queries.ts` and related files.

---

*Last updated: 2026-05-25. Add to this as new things come up.*
