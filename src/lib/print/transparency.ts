import sharp from "sharp";

/**
 * Result of inspecting a raster design for "is the background transparent?"
 *
 * `transparent: true` only when the file has an alpha channel AND at least
 * one pixel is sub-255 (semi-transparent or fully clear). `transparent: false`
 * covers everything else, with a `reason` we surface in logs:
 *
 *   - `no_alpha`           — no alpha channel at all (e.g. JPEG, flat PNG)
 *   - `alpha_fully_opaque` — alpha channel exists but every pixel is 255
 *   - `decode_failed`      — sharp couldn't read the file (corrupt, weird format)
 *
 * The `decode_failed` case is treated like "solid background" for the badge
 * UI: better to nudge the creator to re-upload than to silently report
 * something we couldn't actually verify.
 */
export type DesignTransparency =
  | { transparent: true }
  | { transparent: false; reason: "no_alpha" | "alpha_fully_opaque" | "decode_failed" };

/**
 * Inspect raster bytes (PNG, WebP, JPEG, GIF) and answer: would Printful
 * see ANY transparency, or will the design print as a solid rectangle?
 *
 * We do a two-step check to stay cheap on huge designs:
 *   1. `metadata().hasAlpha` rules out JPEGs and flat PNGs without touching pixels.
 *   2. When alpha is present we extract just the alpha channel as raw bytes
 *      and look for any value < 255. This is the only way to catch the
 *      common AI-generator case of "PNG technically has an alpha channel,
 *      but every pixel is opaque + the background is painted as a literal
 *      checker pattern."
 *
 * SVG is intentionally unsupported here — `rasterizeSvgForPrinting` always
 * calls `.ensureAlpha()` so the resulting PNG is guaranteed to carry alpha,
 * and we run this check on the rasterized output, not the source SVG.
 */
export async function detectDesignTransparency(
  input: Buffer,
): Promise<DesignTransparency> {
  try {
    const img = sharp(input);
    const meta = await img.metadata();
    if (!meta.hasAlpha) {
      return { transparent: false, reason: "no_alpha" };
    }
    const alpha = await img.extractChannel("alpha").raw().toBuffer();
    for (let i = 0; i < alpha.length; i++) {
      if (alpha[i] < 255) return { transparent: true };
    }
    return { transparent: false, reason: "alpha_fully_opaque" };
  } catch (err) {
    console.warn("[transparency] decode failed:", err instanceof Error ? err.message : err);
    return { transparent: false, reason: "decode_failed" };
  }
}

/**
 * Same as `detectDesignTransparency` but accepts the canonical inputs we
 * carry in app code: a `data:` URL (Gemini output, browser FileReader
 * upload), an `http(s)` URL (Supabase Storage public path), or a Buffer
 * we already have in hand.
 *
 * Returns `null` when nothing usable could be loaded — keeps callers from
 * having to special-case "URL was empty / fetch errored" vs. "we ran the
 * check and the design is opaque." Null means "couldn't compute" and the
 * UI renders the neutral "?" state.
 */
export async function detectDesignTransparencyFromAnySource(
  input: Buffer | string,
): Promise<DesignTransparency | null> {
  if (Buffer.isBuffer(input)) {
    return detectDesignTransparency(input);
  }
  if (typeof input !== "string" || !input) return null;

  if (input.startsWith("data:")) {
    const comma = input.indexOf(",");
    if (comma === -1) return null;
    const header = input.slice(5, comma);
    const body = input.slice(comma + 1);
    const isBase64 = /;base64/i.test(header);
    try {
      const buf = isBase64
        ? Buffer.from(body.replace(/\s/g, ""), "base64")
        : Buffer.from(decodeURIComponent(body.replace(/\+/g, "%20")), "utf8");
      return detectDesignTransparency(buf);
    } catch (err) {
      console.warn(
        "[transparency] data URL decode failed:",
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }

  if (input.startsWith("http://") || input.startsWith("https://")) {
    try {
      const res = await fetch(input);
      if (!res.ok) {
        console.warn(
          `[transparency] fetch ${input} returned ${res.status}; treating as unknown`,
        );
        return null;
      }
      const arr = await res.arrayBuffer();
      return detectDesignTransparency(Buffer.from(arr));
    } catch (err) {
      console.warn(
        "[transparency] fetch failed:",
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }

  return null;
}
