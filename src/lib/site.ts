/**
 * Canonical public site origin (no trailing slash). Used for:
 *   - Stripe Connect / Checkout `return_url`, `success_url`, `cancel_url`
 *   - Supabase `emailRedirectTo` (signup confirm, magic link)
 *   - Supabase `redirectTo` (OAuth, password reset)
 *   - <link rel="canonical">, OG URLs, JSON-LD `url`
 *
 * Fallback chain is ordered to never accidentally bake a per-deployment
 * Vercel preview hostname (e.g. `gamerhood-3vziei5te-…vercel.app`) into a
 * URL that gets sent off-site (email, Stripe). The Supabase auth cookies
 * are scoped to `gamerhood.gg`, so a preview-hostname redirect lands the
 * user "logged out" and bounces them to `/auth/login`.
 *
 * Order:
 *   1. `NEXT_PUBLIC_APP_URL` — explicit override (set in Vercel + .env.local).
 *   2. `NEXT_PUBLIC_SITE_URL` — legacy alias kept for back-compat.
 *   3. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel-provided canonical production
 *      hostname; set on EVERY deployment (production, preview, dev), unlike
 *      `VERCEL_URL` which is per-deployment.
 *   4. `http://localhost:3000` — local dev default.
 *
 * Server- and client-safe. `NEXT_PUBLIC_*` vars are inlined at build time;
 * `VERCEL_PROJECT_PRODUCTION_URL` is only available server-side, which is
 * fine because steps 1–2 cover the client.
 */
export function siteUrl(): string {
  const trim = (u: string) => u.replace(/\/+$/, "");

  const fromApp = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromApp) return trim(fromApp);

  const fromSite = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromSite) return trim(fromSite);

  const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prodHost) {
    const host = prodHost.replace(/^https?:\/\//i, "");
    return trim(`https://${host}`);
  }

  return "http://localhost:3000";
}
