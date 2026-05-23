#!/usr/bin/env node
const port = process.env.PORT ?? "3000";
/** Prefer IPv4 literal — avoids some embedded/preview browsers that fail on “localhost”. */
const host = process.env.HOST ?? "127.0.0.1";
console.log(`
Hoodie flow (development only):

  pnpm dev
  Sign in at /auth/login, then either:

    • Start at home: http://${host}:${port}/
      → click “Local dev — test hoodie publish flow” under the hero, or

    • Go straight to Studio: http://${host}:${port}/create?demo=hoodie

  Jump straight to product selection:

    http://${host}:${port}/create?demo=hoodie&step=products

Embedded preview panes sometimes show “connection failed” for local URLs.
Use Safari or Chrome (or Cursor’s external browser command) instead.

Uses placeholder artwork (no Gemini). Publish still exercises Supabase Storage
when the artwork is uploaded or data-URL-backed; HTTPS placeholder URLs skip
storage upload — fine for storefront + checkout UX tests.
`);
