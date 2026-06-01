"use client";

import { useEffect, useState } from "react";
import type { ProductType } from "@/lib/types";

type Status = "idle" | "loading" | "ready" | "unavailable";

/**
 * Pixel-space rectangle for the printable area on the rendered mockup
 * image. Sourced from Printful's v1 mockup-generator/templates endpoint
 * and persisted in `printful_blank_mockups` (`mockup_*_px`,
 * `print_area_*_px`). Re-exported here so the placement editor / print-
 * frame helpers can resolve the cyan rectangle without reaching into the
 * server-side cache types.
 */
export interface BlankPrintRect {
  mockupWidthPx: number;
  mockupHeightPx: number;
  xPx: number;
  yPx: number;
  wPx: number;
  hPx: number;
}

interface CacheEntry {
  status: Status;
  url: string | null;
  area: { width: number; height: number } | null;
  pixelRect: BlankPrintRect | null;
  /** mockup-templates `background_color` for template_backdrop rows. */
  backdropColor: string | null;
}

/** Bump when the server-side backdrop strategy changes ( busts in-tab cache ). */
const BACKDROP_CACHE_VERSION = "template-v2";

/** Shared across all components mounted in the same browser tab. Keyed by version + productType[::color]. */
const browserCache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<void>>();

/**
 * The blank mockup may need ~10–30 s to render on the Printful side the first
 * time. We poll with light-touch intervals so the UI updates as soon as the
 * server has a URL, without hammering the API in the steady state.
 */
const POLL_DELAYS_MS = [4_000, 6_000, 8_000, 10_000, 15_000, 20_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface FetchOnceResult {
  url: string | null;
  status: string;
  area: { width: number; height: number } | null;
  pixelRect: BlankPrintRect | null;
  backdropColor: string | null;
}

function cacheKey(productType: ProductType, color?: string | null): string {
  const base = color ? `${productType}::${color.toLowerCase()}` : productType;
  return `${BACKDROP_CACHE_VERSION}:${base}`;
}

function parsePixelRect(raw: unknown): BlankPrintRect | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const mw = r.mockupWidthPx;
  const mh = r.mockupHeightPx;
  const xPx = r.xPx;
  const yPx = r.yPx;
  const wPx = r.wPx;
  const hPx = r.hPx;
  if (
    typeof mw !== "number" ||
    typeof mh !== "number" ||
    typeof xPx !== "number" ||
    typeof yPx !== "number" ||
    typeof wPx !== "number" ||
    typeof hPx !== "number"
  ) {
    return null;
  }
  if (mw <= 0 || mh <= 0 || wPx <= 0 || hPx <= 0) return null;
  return { mockupWidthPx: mw, mockupHeightPx: mh, xPx, yPx, wPx, hPx };
}

async function fetchOnce(
  productType: ProductType,
  color: string | null,
): Promise<FetchOnceResult | null> {
  console.log("[blank-mockup-client] fetch start", { productType, color });
  try {
    const qs = new URLSearchParams({ type: productType, _bd: BACKDROP_CACHE_VERSION });
    if (color) qs.set("color", color);
    const res = await fetch(`/api/printful/blank-photo?${qs.toString()}`, { cache: "no-store" });
    if (!res.ok) {
      console.warn("[blank-mockup-client] fetch non-OK", {
        productType,
        color,
        httpStatus: res.status,
      });
      return null;
    }
    const j = (await res.json()) as {
      url?: string | null;
      status?: string;
      printArea?: { width?: number; height?: number } | null;
      printAreaPixelRect?: unknown;
      backdropColor?: string | null;
    };
    const w = j.printArea?.width;
    const h = j.printArea?.height;
    const area =
      typeof w === "number" && typeof h === "number" && w > 0 && h > 0
        ? { width: w, height: h }
        : null;
    const result: FetchOnceResult = {
      url: typeof j.url === "string" && j.url ? j.url : null,
      status: typeof j.status === "string" ? j.status : "unavailable",
      area,
      pixelRect: parsePixelRect(j.printAreaPixelRect),
      backdropColor:
        typeof j.backdropColor === "string" && j.backdropColor.trim()
          ? j.backdropColor.trim()
          : null,
    };
    console.log("[blank-mockup-client] fetch result", {
      productType,
      color,
      status: result.status,
      url: result.url,
      area: result.area,
      hasPixelRect: !!result.pixelRect,
    });
    return result;
  } catch (err) {
    console.warn("[blank-mockup-client] fetch threw", {
      productType,
      color,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Drives the cache for one (productType, color) pair. Resolves once we
 * reach a terminal state (`ready` or `unavailable`); intermediate
 * `generating` responses trigger another poll after a bounded backoff.
 * Multiple in-flight callers for the same key share a single promise.
 */
function ensureFetch(
  productType: ProductType,
  color: string | null,
  onChange: () => void,
): Promise<void> {
  const key = cacheKey(productType, color);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const p = (async () => {
    let attempt = 0;
    while (true) {
      const r = await fetchOnce(productType, color);

      if (!r) {
        console.warn("[blank-mockup-client] terminal: fetch failed → SVG fallback", {
          productType,
          color,
        });
        browserCache.set(key, {
          status: "unavailable",
          url: null,
          area: null,
          pixelRect: null,
          backdropColor: null,
        });
        onChange();
        return;
      }

      if (r.status === "ready" && r.url) {
        console.log("[blank-mockup-client] terminal: ready", {
          productType,
          color,
          url: r.url,
        });
        browserCache.set(key, {
          status: "ready",
          url: r.url,
          area: r.area,
          pixelRect: r.pixelRect,
          backdropColor: r.backdropColor,
        });
        onChange();
        return;
      }

      if (r.status === "unavailable") {
        console.warn("[blank-mockup-client] terminal: server says unavailable → SVG fallback", {
          productType,
          color,
        });
        browserCache.set(key, {
          status: "unavailable",
          url: null,
          area: r.area,
          pixelRect: r.pixelRect,
          backdropColor: r.backdropColor,
        });
        onChange();
        return;
      }

      /** "generating" — back off and poll again. */
      if (browserCache.get(key)?.status !== "loading") {
        browserCache.set(key, {
          status: "loading",
          url: null,
          area: r.area,
          pixelRect: r.pixelRect,
          backdropColor: r.backdropColor,
        });
        onChange();
      }
      const delay = POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)];
      attempt += 1;
      console.log("[blank-mockup-client] generating — backing off", {
        productType,
        color,
        attempt,
        delayMs: delay,
      });
      if (attempt > POLL_DELAYS_MS.length + 2) {
        /** Give up after ~90 s — the SVG silhouette continues to render. */
        console.warn("[blank-mockup-client] gave up after polling — SVG fallback", {
          productType,
          color,
          attempts: attempt,
        });
        browserCache.set(key, {
          status: "unavailable",
          url: null,
          area: null,
          pixelRect: null,
          backdropColor: null,
        });
        onChange();
        return;
      }
      await sleep(delay);
    }
  })().finally(() => {
    pending.delete(key);
  });

  pending.set(key, p);
  return p;
}

/**
 * Returns the Printful flat blank photo URL for a product type / color, or
 * `null` (with `loading: true`) while the first-time mockup task renders.
 * Callers should display the SVG silhouette as a fallback when `url` is
 * null.
 *
 * Pass a non-null `color` to fetch the per-color photo (Track A in the
 * server-side cache). Omit it for the env-default variant (the placement
 * editor + product card use this path).
 */
export function usePrintfulBlankPhoto(
  productType: ProductType,
  color?: string | null,
): {
  url: string | null;
  loading: boolean;
  /**
   * Printful-reported print area in inches for this variant's configured
   * placement, when available. Use it to size the print box; fall back to
   * `getPrintAreaInches(productType)` when null (during first generation).
   */
  area: { width: number; height: number } | null;
  /**
   * Authoritative pixel-space rectangle for the cyan print frame on the
   * mockup at `url`. When non-null, surfaces should position the print
   * box from these coords instead of from `photoBand`. `null` for legacy
   * cache rows or per-color catalog photos that don't share the mockup-
   * tasks framing.
   */
  pixelRect: BlankPrintRect | null;
  /** Background tint behind the template image (template_backdrop rows). */
  backdropColor: string | null;
} {
  const [, setTick] = useState(0);
  const key = cacheKey(productType, color);

  useEffect(() => {
    const existing = browserCache.get(key);
    if (existing && (existing.status === "ready" || existing.status === "unavailable")) {
      return;
    }
    let cancelled = false;
    ensureFetch(productType, color ?? null, () => {
      if (!cancelled) setTick((t) => t + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [productType, color, key]);

  const entry = browserCache.get(key);
  return {
    url: entry?.status === "ready" ? entry.url : null,
    loading: !entry || entry.status === "loading",
    area: entry?.area ?? null,
    pixelRect: entry?.pixelRect ?? null,
    backdropColor: entry?.backdropColor ?? null,
  };
}
