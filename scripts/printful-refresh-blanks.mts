/**
 * Pre-warm Printful flat blank product mockups for every configured ProductType.
 * Invoked from `scripts/printful-refresh-blanks.mjs` (which loads `.env.local`
 * and spawns `tsx` against this file so we can import `src/lib/printful/*`).
 *
 * Post-030 schema: rows are keyed by `catalog_variant_id`, so the warmer
 * iterates every *color variant* of each product type — a Track A (per-
 * color catalog photo) round-trip per variant. Track B (mockup-tasks)
 * stays as a fallback for the env-default variant only.
 *
 * Usage flags are forwarded by the wrapper:
 *   (no args)            warm only missing variants
 *   --force              regenerate every variant (deletes cached rows first)
 *   --product=hoodie     only the named ProductType (repeatable)
 *   <type ...>           same as --product= but positional
 */

const mockupMod = await import("../src/lib/printful/blank-mockup.ts");
const adminMod = await import("../src/lib/supabase/admin.ts");
const catalogMod = await import("../src/lib/printful/catalog.ts");
const clientMod = await import("../src/lib/printful/client.ts");

const {
  getOrGenerateBlankForVariantId,
  listColorVariantsForCatalogProduct,
} = mockupMod;
const { getServiceClient } = adminMod;
const { getCatalogConfig } = catalogMod;
const { printfulRequest } = clientMod;

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
const productFilters = args
  .filter((a) => a.startsWith("--product="))
  .map((a) => a.slice("--product=".length));
const positional = args.filter((a) => !a.startsWith("--")) as ProductType[];
const only = [...productFilters, ...positional];

const targets = only.length ? ALL_TYPES.filter((t) => only.includes(t)) : ALL_TYPES;

let okVariants = 0;
const skippedVariants = 0;
let failedVariants = 0;
let cachedVariants = 0;

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

/**
 * Track A is a single catalog-variants fetch + one Supabase Storage upload
 * per color — way cheaper than mockup-tasks. We can run a tighter inter-
 * request delay than the legacy script used (which was tuned for the slow
 * mockup-tasks path).
 */
const INTER_REQUEST_DELAY_MS = 1_200;

const supabase = getServiceClient();

interface VariantRow {
  variantId: number;
  colorName: string;
  colorHex: string | null;
  hasCatalogPhoto: boolean;
}

/**
 * Resolve `catalog_product_id` for a product type by hitting Printful's
 * `/catalog-variants/{default_variant_id}` once. We don't trust the cached
 * DB row here because `--force` runs may have just deleted it.
 */
async function resolveCatalogProductId(productType: ProductType): Promise<number | null> {
  const cfg = getCatalogConfig(productType as never);
  if (!cfg) return null;
  try {
    const res = await printfulRequest<{ data?: { catalog_product_id?: number } }>(
      `/catalog-variants/${cfg.catalogVariantId}`,
    );
    const id = res.data?.catalog_product_id;
    return typeof id === "number" ? id : null;
  } catch (err) {
    console.warn(
      "[printful-refresh-blanks] catalog-variants fetch failed",
      productType,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

console.log("[printful-refresh-blanks] starting", {
  targets,
  force,
  productFilters: only,
});

for (const type of targets) {
  process.stdout.write(`\n${type}\n`);

  const cfg = getCatalogConfig(type as never);
  if (!cfg) {
    process.stdout.write(`  skipped (no PRINTFUL_<TYPE>_VARIANT_ID configured)\n`);
    continue;
  }

  const catalogProductId = await resolveCatalogProductId(type);
  if (!catalogProductId) {
    process.stdout.write(`  FAIL: could not resolve catalog_product_id\n`);
    continue;
  }

  /**
   * One variant per unique color from the catalog. The image on a Black/S
   * variant is identical to Black/M / Black/L (Printful photographs at the
   * color level, not size), so we don't need to warm one row per size.
   */
  const variants = (await listColorVariantsForCatalogProduct(catalogProductId)) as VariantRow[];
  if (!variants.length) {
    process.stdout.write(`  FAIL: 0 variants returned for catalog_product_id=${catalogProductId}\n`);
    continue;
  }
  process.stdout.write(`  catalog_product_id=${catalogProductId}, ${variants.length} colors\n`);

  /** Always include the env-default variant id even if the catalog-products
   * variants endpoint deduped it under a different size. */
  const seenIds = new Set(variants.map((v) => v.variantId));
  if (!seenIds.has(cfg.catalogVariantId)) {
    variants.unshift({
      variantId: cfg.catalogVariantId,
      colorName: "Default",
      colorHex: null,
      hasCatalogPhoto: false,
    });
  }

  if (force) {
    const ids = variants.map((v) => v.variantId);
    const { error: delErr } = await supabase
      .from("printful_blank_mockups")
      .delete()
      .in("catalog_variant_id", ids);
    if (delErr) {
      process.stdout.write(`  WARN: delete-on-force failed: ${delErr.message}\n`);
    } else {
      process.stdout.write(`  cleared ${ids.length} cached rows\n`);
    }
  }

  let firstAttemptForType = true;
  for (const v of variants) {
    const label = `    ${String(v.variantId).padEnd(7)} ${v.colorName.padEnd(30)} `;

    if (!force) {
      const { data: existing } = await supabase
        .from("printful_blank_mockups")
        .select("mockup_url")
        .eq("catalog_variant_id", v.variantId)
        .maybeSingle();
      if (existing?.mockup_url) {
        process.stdout.write(`${label}cached\n`);
        cachedVariants++;
        continue;
      }
    }

    if (!firstAttemptForType) await sleep(INTER_REQUEST_DELAY_MS);
    firstAttemptForType = false;

    /**
     * Snapshot the existing cached print area BEFORE we (re)warm so we
     * can spot a Printful-side change at warm time — the earliest
     * possible point in the drift detection funnel.
     */
    let priorPrintArea: { width: number; height: number } | null = null;
    {
      const { data: prior } = await supabase
        .from("printful_blank_mockups")
        .select("print_area_width_in, print_area_height_in")
        .eq("catalog_variant_id", v.variantId)
        .maybeSingle();
      const pw = prior?.print_area_width_in;
      const ph = prior?.print_area_height_in;
      if (typeof pw === "number" && typeof ph === "number" && pw > 0 && ph > 0) {
        priorPrintArea = { width: pw, height: ph };
      }
    }

    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const row = await getOrGenerateBlankForVariantId(v.variantId, type as never, {
          colorName: v.colorName,
          colorHex: v.colorHex,
        });
        if (!row?.mockup_url) {
          process.stdout.write(`${label}FAIL  (generator returned null)\n`);
          failedVariants++;
          break;
        }
        /**
         * Drift early-warning: if the live print area differs from what
         * we had on file (and the prior value existed) yell loudly. The
         * pre-payment safeguard in the Stripe webhook is the safety
         * net; this surfaces drift before any customer sees a stale
         * preview, so we can investigate proactively.
         */
        const nextW = row.print_area_width_in;
        const nextH = row.print_area_height_in;
        if (
          priorPrintArea &&
          typeof nextW === "number" &&
          typeof nextH === "number" &&
          nextW > 0 &&
          nextH > 0
        ) {
          const dw = Math.abs(nextW - priorPrintArea.width) / priorPrintArea.width;
          const dh =
            Math.abs(nextH - priorPrintArea.height) / priorPrintArea.height;
          if (dw > 0.01 || dh > 0.01) {
            console.warn(
              `[printful-refresh-blanks] PRINT-AREA DRIFT for variant ${v.variantId} (${type} ${v.colorName}): ` +
                `was ${priorPrintArea.width}×${priorPrintArea.height}", now ${nextW}×${nextH}". ` +
                `Stored placements may render at the wrong physical size — re-verify the catalog.`,
            );
          }
        }
        process.stdout.write(`${label}ok  (${row.source ?? "?"})\n`);
        okVariants++;
        break;
      } catch (err) {
        const wait = rateLimitDelayMs(err);
        if (wait && attempt < 3) {
          process.stdout.write(`${label}429, retrying in ${Math.round(wait / 1000)}s …\n`);
          await sleep(wait);
          attempt++;
          continue;
        }
        process.stdout.write(
          `${label}FAIL  ${err instanceof Error ? err.message : String(err)}\n`,
        );
        failedVariants++;
        break;
      }
    }
  }
}

console.log(
  `\nDone — variants ok=${okVariants} cached=${cachedVariants} skipped=${skippedVariants} failed=${failedVariants}`,
);
process.exit(failedVariants > 0 ? 1 : 0);
