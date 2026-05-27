/**
 * Backfill `printful_blank_mockups` pixel-space coordinates from
 * Printful's v1 mockup-generator templates endpoint. Companion to
 * `scripts/printful-backfill-pixel-coords.mjs` — the .mjs wrapper handles
 * `.env.local` loading + spawning `tsx`; this file does the work.
 *
 * For each row we need three things to backfill:
 *   - `catalog_product_id` (already cached from the variant lookup)
 *   - `catalog_variant_id` (PK)
 *   - `placement` (e.g. "front", "back", "leg_left")
 *
 * Output is the mockup-tasks rendering size (1200×1200) so the surfaces
 * that consume `print_area_*_px` don't have to track which template the
 * coords originated from.
 *
 * Rate-limit: Printful's v1 endpoint is generous compared to mockup-tasks
 * but we still pace requests at ~1 / second.
 */

const mockupMod = await import("../src/lib/printful/blank-mockup.ts");
const adminMod = await import("../src/lib/supabase/admin.ts");
const clientMod = await import("../src/lib/printful/client.ts");

const { fetchVariantPrintAreaPx } = mockupMod;
const { getServiceClient } = adminMod;
const { isPrintfulConfigured } = clientMod;

if (!isPrintfulConfigured()) {
  console.error("[backfill-pixel-coords] PRINTFUL_API_TOKEN missing.");
  process.exit(2);
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const productFilters = args
  .filter((a) => a.startsWith("--product="))
  .map((a) => a.slice("--product=".length));
const positional = args.filter((a) => !a.startsWith("--"));
const productScope = new Set<string>([...productFilters, ...positional]);

const supabase = getServiceClient();

const { data: rows, error } = await supabase
  .from("printful_blank_mockups")
  .select(
    "catalog_variant_id, catalog_product_id, product_type, placement, source, " +
      "print_area_x_px, print_area_w_px, mockup_width_px",
  );
if (error) {
  console.error("[backfill-pixel-coords] DB read failed:", error.message);
  process.exit(1);
}
if (!rows?.length) {
  console.log("[backfill-pixel-coords] no rows in printful_blank_mockups — nothing to backfill.");
  process.exit(0);
}

const targets = rows.filter((r) => {
  if (!r.catalog_product_id || !r.catalog_variant_id || !r.placement) return false;
  if (productScope.size > 0 && !productScope.has(r.product_type)) return false;
  if (force) return true;
  const missing =
    r.print_area_x_px == null || r.print_area_w_px == null || r.mockup_width_px == null;
  return missing;
});

console.log(
  `[backfill-pixel-coords] ${rows.length} rows total, ${targets.length} to backfill ` +
    `(force=${force}${productScope.size ? `, scope=${[...productScope].join(",")}` : ""})`,
);

let ok = 0;
let skipped = 0;
let failed = 0;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

for (const row of targets) {
  const label = `  variant=${String(row.catalog_variant_id).padEnd(7)} ${String(
    row.product_type,
  ).padEnd(22)} placement=${row.placement?.padEnd(20)} `;

  /**
   * Track A rows hold the per-color catalog studio photo; the v1
   * template coords are calibrated against the mockup-tasks rendering
   * (ghost mannequin), so they don't apply. Persist them anyway for
   * diagnostics — the cache reader gates by `source = 'mockup_task'`
   * before handing the coords to clients.
   */
  let px: Awaited<ReturnType<typeof fetchVariantPrintAreaPx>>;
  try {
    px = await fetchVariantPrintAreaPx({
      catalogProductId: row.catalog_product_id as number,
      catalogVariantId: row.catalog_variant_id as number,
      placement: row.placement as string,
      outputWidthPx: 1200,
    });
  } catch (err) {
    console.warn(`${label}FAIL fetch ${err instanceof Error ? err.message : String(err)}`);
    failed++;
    continue;
  }
  if (!px) {
    console.warn(`${label}skip (no v1 template for this variant/placement)`);
    skipped++;
    await sleep(800);
    continue;
  }

  const { error: upErr } = await supabase
    .from("printful_blank_mockups")
    .update({
      mockup_width_px: px.mockupWidthPx,
      mockup_height_px: Math.round(px.mockupHeightPx),
      print_area_x_px: Math.round(px.xPx),
      print_area_y_px: Math.round(px.yPx),
      print_area_w_px: Math.round(px.wPx),
      print_area_h_px: Math.round(px.hPx),
      template_id: px.templateId,
    })
    .eq("catalog_variant_id", row.catalog_variant_id);
  if (upErr) {
    console.warn(`${label}FAIL update ${upErr.message}`);
    failed++;
  } else {
    console.log(
      `${label}ok  template=${px.templateId} ` +
        `x=${Math.round(px.xPx)} y=${Math.round(px.yPx)} ` +
        `w=${Math.round(px.wPx)} h=${Math.round(px.hPx)} ` +
        `mockup=${px.mockupWidthPx}x${Math.round(px.mockupHeightPx)}` +
        (row.source && row.source !== "mockup_task"
          ? ` [persisted for diagnostics; surfaces ignore non-mockup_task rows]`
          : ""),
    );
    ok++;
  }
  await sleep(800);
}

console.log(`\nDone — ok=${ok} skipped=${skipped} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
