/**
 * Pre-warm Printful flat blank product mockups for every configured ProductType.
 * Invoked from `scripts/printful-refresh-blanks.mjs` (which loads `.env.local`
 * and spawns `tsx` against this file so we can import `src/lib/printful/*`).
 *
 * Usage flags are forwarded by the wrapper:
 *   (no args)   warm only missing types
 *   --force     regenerate every type
 *   <type ...>  only the named ProductType(s)
 */

/**
 * Dynamic import + namespace destructure avoids tsx's ESM/CJS interop quirk
 * (the project has no `"type": "module"`, so `.ts` files are treated as CJS
 * and importing named exports from an `.mts` file fails).
 */
const mockupMod = await import("../src/lib/printful/blank-mockup.ts");
const adminMod = await import("../src/lib/supabase/admin.ts");
const catalogMod = await import("../src/lib/printful/catalog.ts");
const { generateFlatBlankMockup } = mockupMod;
const { getServiceClient } = adminMod;
const { getCatalogConfig } = catalogMod;

type ProductType = string;

const ALL_TYPES: ProductType[] = [
  "hoodie",
  "kids-hoodie",
  "kids-heavyweight-tee",
  "kids-long-sleeve",
  "kids-sports-tee",
  "kids-tshirt",
  "tshirt",
  "joggers",
  "mug",
  "poster",
  "backpack",
  "phone-case",
  "sticker",
  "pillow",
  "blanket",
  "pet-sweater",
  "tote-bag",
  "ornament",
  "puzzle",
  "embroidered-patch",
  "hardcover-journal",
];

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--")) as ProductType[];

const targets = only.length ? ALL_TYPES.filter((t) => only.includes(t)) : ALL_TYPES;

let ok = 0;
let skipped = 0;
let failed = 0;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Print 429 retry seconds. Returns null when not a 429. */
function rateLimitDelayMs(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/try again after (\d+)\s*seconds?/i);
  if (m) return (Number(m[1]) + 2) * 1000;
  if (/429|TooManyRequests/i.test(msg)) return 65_000;
  return null;
}

/** Generous default spacing between SKUs so we stay under Printful's burst limit. */
const INTER_REQUEST_DELAY_MS = 6_000;

const supabase = getServiceClient();

let firstAttempt = true;

for (const type of targets) {
  process.stdout.write(`  ${type.padEnd(22)} … `);

  const cfg = getCatalogConfig(type as never);
  if (!cfg) {
    process.stdout.write("skipped (no PRINTFUL_<TYPE>_VARIANT_ID configured)\n");
    skipped++;
    continue;
  }

  if (!force) {
    const { data: existing } = await supabase
      .from("printful_blank_mockups")
      .select("mockup_url")
      .eq("product_type", type)
      .maybeSingle();
    if (existing?.mockup_url) {
      process.stdout.write(`cached  ${existing.mockup_url}\n`);
      ok++;
      continue;
    }
  }

  if (!firstAttempt) await sleep(INTER_REQUEST_DELAY_MS);
  firstAttempt = false;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const generated = await generateFlatBlankMockup(type as never);
      if (!generated) {
        process.stdout.write("FAIL  (generator returned null)\n");
        failed++;
        break;
      }
      const { error: upsertErr } = await supabase
        .from("printful_blank_mockups")
        .upsert(
          {
            product_type: type,
            mockup_url: generated.url,
            catalog_product_id: generated.catalogProductId,
            catalog_variant_id: generated.catalogVariantId,
            mockup_style_id: generated.mockupStyleId,
            technique: cfg.technique,
            placement: cfg.placement,
            generated_at: new Date().toISOString(),
          },
          { onConflict: "product_type" },
        );
      if (upsertErr) {
        process.stdout.write(`FAIL  upsert: ${upsertErr.message}\n`);
        failed++;
        break;
      }
      process.stdout.write(`ok  ${generated.url}\n`);
      ok++;
      break;
    } catch (err) {
      const wait = rateLimitDelayMs(err);
      if (wait && attempt < 3) {
        process.stdout.write(`429, retrying in ${Math.round(wait / 1000)}s … `);
        await sleep(wait);
        attempt++;
        continue;
      }
      process.stdout.write(`FAIL  ${err instanceof Error ? err.message : String(err)}\n`);
      failed++;
      break;
    }
  }
}

console.log(`\nDone — ok=${ok} skipped=${skipped} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
