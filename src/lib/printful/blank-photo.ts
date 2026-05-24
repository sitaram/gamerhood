import { isPrintfulConfigured } from "@/lib/printful/client";
import { getServiceClient } from "@/lib/supabase/admin";
import {
  generateFlatBlankMockup,
  getOrGenerateFlatBlankMockup,
} from "@/lib/printful/blank-mockup";
import type { ProductType } from "@/lib/types";

/**
 * Resolves the flat blank product photo URL for a ProductType.
 *
 * Cache hierarchy:
 *   1. `printful_blank_mockups` DB table (long-lived; populated by the
 *      mockup-tasks generator the first time a type is requested).
 *   2. Process-warm memo so hot paths (`/api/printful/blank-photo`) don't
 *      hit Supabase on every poll while a background job is in flight.
 *
 * Generation is intentionally async — the GET endpoint returns
 * `{ url: null, status: "generating" }` on cache miss and kicks off a
 * background job, so the client falls back to the SVG silhouette while the
 * job completes (then a re-fetch on the next mount picks up the URL).
 */

export type BlankPhotoStatus = "ready" | "generating" | "unavailable";

export interface BlankPhotoResult {
  url: string | null;
  status: BlankPhotoStatus;
  /**
   * Real Printful print area in inches for this variant's configured
   * placement, when cached. `null` while generating or if Printful didn't
   * report dims (some embroidery SKUs omit them). Client falls back to
   * `DEFAULT_PRINT_AREA_IN` from catalog.ts.
   */
  printArea: { width: number; height: number } | null;
}

interface MemoEntry {
  result: BlankPhotoResult;
  /** Set while a background mockup-tasks job is in flight. */
  pending?: Promise<BlankPhotoResult>;
}

const memo = new Map<ProductType, MemoEntry>();

export function clearBlankPhotoCache(): void {
  memo.clear();
}

/**
 * Read the cached flat blank URL without triggering generation.
 * Used by the API route's fast path so we don't hit Supabase on every render.
 */
async function readCachedBlank(productType: ProductType): Promise<BlankPhotoResult | null> {
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("printful_blank_mockups")
      .select("mockup_url, print_area_width_in, print_area_height_in")
      .eq("product_type", productType)
      .maybeSingle();
    const url = data?.mockup_url;
    if (typeof url !== "string" || !url) return null;
    const w = data?.print_area_width_in;
    const h = data?.print_area_height_in;
    const printArea =
      typeof w === "number" && typeof h === "number" && w > 0 && h > 0
        ? { width: w, height: h }
        : null;
    return { url, status: "ready", printArea };
  } catch {
    return null;
  }
}

/**
 * Kick off (or join) a background mockup-tasks job. Resolved value is
 * memoized so repeat callers within ~minute see the same in-flight promise.
 */
function startBackgroundGeneration(productType: ProductType): Promise<BlankPhotoResult> {
  const existing = memo.get(productType);
  if (existing?.pending) return existing.pending;

  const p = (async (): Promise<BlankPhotoResult> => {
    const generated = await generateFlatBlankMockup(productType).catch((err) => {
      console.warn(
        "[Printful blank-photo] background generation failed:",
        err instanceof Error ? err.message : err,
      );
      return null;
    });

    if (!generated) {
      const result: BlankPhotoResult = { url: null, status: "unavailable", printArea: null };
      memo.set(productType, { result });
      return result;
    }

    /** Persist via the cached-or-generate helper so future server restarts hit the DB cache. */
    const row = await getOrGenerateFlatBlankMockup(productType).catch(() => null);
    const result: BlankPhotoResult = {
      url: row?.mockup_url ?? generated.url,
      status: "ready",
      printArea: extractRowPrintArea(row) ?? generated.printArea,
    };
    memo.set(productType, { result });
    return result;
  })();

  memo.set(productType, {
    result: { url: null, status: "generating", printArea: null },
    pending: p,
  });

  return p;
}

function extractRowPrintArea(
  row: { print_area_width_in: number | null; print_area_height_in: number | null } | null,
): { width: number; height: number } | null {
  const w = row?.print_area_width_in;
  const h = row?.print_area_height_in;
  if (typeof w === "number" && typeof h === "number" && w > 0 && h > 0) {
    return { width: w, height: h };
  }
  return null;
}

/**
 * Quick non-blocking resolution: returns `ready` if cached, `generating`
 * (and starts a background job) if not, or `unavailable` if Printful isn't
 * configured. Never blocks longer than a single Supabase round-trip.
 */
export async function getBlankPhotoForProductType(
  productType: ProductType,
): Promise<BlankPhotoResult> {
  const memoEntry = memo.get(productType);
  if (memoEntry && memoEntry.result.status === "ready") return memoEntry.result;

  if (!isPrintfulConfigured()) {
    const result: BlankPhotoResult = { url: null, status: "unavailable", printArea: null };
    memo.set(productType, { result });
    return result;
  }

  const cached = await readCachedBlank(productType);
  if (cached) {
    memo.set(productType, { result: cached });
    return cached;
  }

  if (memoEntry?.pending) {
    return { url: null, status: "generating", printArea: null };
  }

  /** Fire-and-await-elsewhere: do NOT await `p`, return generating status now. */
  void startBackgroundGeneration(productType);
  return { url: null, status: "generating", printArea: null };
}
