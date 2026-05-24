/**
 * Backfill / regenerate Printful listing mockups for published products.
 * Invoked from `scripts/printful-refresh-listing-mockups.mjs` (which loads
 * `.env.local` and spawns tsx against this file so we can import `src/lib/*`).
 *
 * Refresh rule (matches `shouldReplaceListingMockupWithPrintful`):
 *   - mockup_url is null/empty             → regenerate
 *   - mockup_url == designs.image_url      → regenerate (publish-time fallback)
 *   - mockup_url matches printful.com host → regenerate when --force, otherwise skip
 *   - mockup_url is a custom Supabase upload (creator's own photo) → always skip
 */

const mockupsMod = await import("../src/lib/printful/mockups.ts");
const adminMod = await import("../src/lib/supabase/admin.ts");
const clientMod = await import("../src/lib/printful/client.ts");
const { refreshPrintfulListingMockupForProduct, shouldReplaceListingMockupWithPrintful } =
  mockupsMod;
const { getServiceClient } = adminMod;
const { isPrintfulConfigured } = clientMod;

interface ProductRow {
  id: string;
  title: string;
  product_type: string;
  mockup_url: string | null;
  printful_catalog_variant_id: number | null;
  printful_catalog_product_id: number | null;
  designs?: { image_url: string | null } | null;
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyIds = args.filter((a) => !a.startsWith("--"));

if (!isPrintfulConfigured()) {
  console.error(
    "[printful-refresh-listing-mockups] PRINTFUL_API_KEY missing — set it in .env.local or the shell.",
  );
  process.exit(2);
}

const supabase = getServiceClient();

let query = supabase
  .from("products")
  .select(
    "id, title, product_type, mockup_url, printful_catalog_variant_id, printful_catalog_product_id, designs ( image_url )",
  )
  .eq("is_published", true)
  .order("created_at", { ascending: true });

if (onlyIds.length) query = query.in("id", onlyIds);

const { data: rows, error } = await query;
if (error) {
  console.error("[printful-refresh-listing-mockups] product fetch failed:", error.message);
  process.exit(1);
}

const products = (rows ?? []) as unknown as ProductRow[];
console.log(
  `[printful-refresh-listing-mockups] scanning ${products.length} published products` +
    (force ? " (force: also re-do Printful CDN URLs)" : ""),
);

let ok = 0;
let skipped = 0;
let failed = 0;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Spacing between SKUs so we stay under Printful's mockup-tasks burst limit. */
const INTER_REQUEST_DELAY_MS = 4_000;

let firstAttempt = true;

for (const p of products) {
  const designUrl = p.designs?.image_url ?? null;
  const label = `${p.id.slice(0, 8)}…  ${p.product_type.padEnd(20)}`;

  if (!p.printful_catalog_variant_id || !p.printful_catalog_product_id) {
    console.log(`  ${label}  skip (no Printful catalog mapping)`);
    skipped++;
    continue;
  }
  if (!designUrl || designUrl.startsWith("data:")) {
    console.log(`  ${label}  skip (design image not http(s))`);
    skipped++;
    continue;
  }

  const auto = shouldReplaceListingMockupWithPrintful(p.mockup_url, designUrl);
  if (!auto) {
    console.log(`  ${label}  skip (creator-uploaded custom listing photo)`);
    skipped++;
    continue;
  }

  /** When not --force, skip rows whose Printful-CDN mockup is already fine. */
  if (!force && p.mockup_url && /printful\.com/i.test(p.mockup_url) && p.mockup_url !== designUrl) {
    console.log(`  ${label}  ok    ${p.mockup_url}`);
    ok++;
    continue;
  }

  if (!firstAttempt) await sleep(INTER_REQUEST_DELAY_MS);
  firstAttempt = false;

  try {
    const url = await refreshPrintfulListingMockupForProduct(supabase, p.id);
    if (url) {
      console.log(`  ${label}  ok    ${url}`);
      ok++;
    } else {
      /** `refresh…` returns null when the helper decides it shouldn't replace
       * (e.g. detected a creator upload after our pre-filter), or the catalog
       * mapping is unusable, or the mockup-tasks job came back without a URL. */
      console.log(`  ${label}  fail  (refresh returned null)`);
      failed++;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ${label}  fail  ${msg}`);
    failed++;
  }
}

console.log(`\nDone — ok=${ok} skipped=${skipped} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
