import sharp from "sharp";
import { stripCheckerboardOnly } from "@/lib/print/artifact-strip";

/** Longest edge px — comfortable for POD (Printful DTG prefers ~4500 px across). */
const MAX_PRINT_DIMENSION = 4500;

/** SVG rasterized at this DPI via sharp/rsvg before resizing. */
const SVG_RASTER_DPI = 384;

function baseMime(type: string): string {
  return type.toLowerCase().split(";")[0].trim();
}

/** True when the MIME is vector SVG coming from an upload decode. */
export function isSvgMime(mimeType: string): boolean {
  return baseMime(mimeType) === "image/svg+xml";
}

/**
 * Turn vector SVG uploads into a high-res PNG Printful reliably accepts.
 * Preserves transparency (alpha) for knockout / clear backgrounds behind the artwork.
 */
export async function rasterizeSvgForPrinting(svgBytes: Buffer): Promise<Buffer> {
  try {
    return await sharp(svgBytes, { density: SVG_RASTER_DPI })
      .resize(MAX_PRINT_DIMENSION, MAX_PRINT_DIMENSION, {
        fit: "inside",
        withoutEnlargement: false,
      })
      .ensureAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch (err) {
    console.error("[NormalizeUpload] SVG rasterize failed:", err);
    throw new Error("INVALID_SVG");
  }
}

/**
 * Larger rasters scaled down proportionally — avoids multi‑hundred‑MB payloads;
 * never upscales (no fake resolution). Returns the MIME matching the encoded
 * buffer (GIF resized becomes PNG single-frame).
 */
export async function capRasterIfHuge(
  input: Buffer,
  mimeHint: string,
): Promise<{ buffer: Buffer; mimeOut: string }> {
  const base = baseMime(mimeHint);
  if (!base.startsWith("image/") || base === "image/svg+xml") {
    return { buffer: input, mimeOut: base };
  }

  const meta = await sharp(input).metadata().catch(() => null);
  if (!meta?.width || !meta.height) {
    return { buffer: input, mimeOut: base };
  }

  const maxSide = Math.max(meta.width, meta.height);
  if (maxSide <= MAX_PRINT_DIMENSION) {
    return { buffer: input, mimeOut: base };
  }

  const resized = sharp(input).resize(MAX_PRINT_DIMENSION, MAX_PRINT_DIMENSION, {
    fit: "inside",
    withoutEnlargement: true,
  });

  if (base === "image/png") {
    return {
      buffer: await resized.png({ compressionLevel: 9 }).toBuffer(),
      mimeOut: "image/png",
    };
  }
  if (base === "image/webp") {
    return {
      buffer: await resized.webp({ quality: 92 }).toBuffer(),
      mimeOut: "image/webp",
    };
  }
  // GIF loses animation once resized → emit PNG instead of mis-labeling JPEG
  if (base === "image/gif") {
    return {
      buffer: await resized.png({ compressionLevel: 9 }).toBuffer(),
      mimeOut: "image/png",
    };
  }

  return {
    buffer: await resized.jpeg({ quality: 92, mozjpeg: true }).toBuffer(),
    mimeOut: "image/jpeg",
  };
}

/**
 * Remove only explicit checkerboard transparency artifacts.
 *
 * This is intentionally conservative: it keys off a strict 2-color alternating
 * checker signature and leaves ordinary neutral/dark artwork untouched.
 */
export async function stripCheckerboardArtifacts(
  input: Buffer,
  mimeHint: string,
): Promise<{ buffer: Buffer; mimeOut: string }> {
  const base = baseMime(mimeHint);
  if (!base.startsWith("image/") || base === "image/svg+xml") {
    return { buffer: input, mimeOut: base };
  }
  try {
    const cleaned = await stripCheckerboardOnly(input);
    if (!cleaned.changed) return { buffer: input, mimeOut: base };
    return { buffer: cleaned.buffer, mimeOut: "image/png" };
  } catch {
    return { buffer: input, mimeOut: base };
  }
}

export function bytesToBase64DataUrl(bytes: Buffer, mimeType: string): string {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
  const safeMime = allowed.has(base) ? base : "image/png";
  return `data:${safeMime};base64,${bytes.toString("base64")}`;
}

/**
 * Remove only fully-transparent outer margins.
 *
 * This intentionally avoids color-key trimming (white/gray background removal),
 * because that can delete real artwork in dark or neutral palettes.
 */
export async function trimPrintMargins(
  input: Buffer,
  mimeHint: string,
): Promise<{ buffer: Buffer; mimeOut: string }> {
  const base = baseMime(mimeHint);
  if (!base.startsWith("image/") || base === "image/svg+xml") {
    return { buffer: input, mimeOut: base };
  }

  const meta = await sharp(input).metadata().catch(() => null);
  if (!meta?.width || !meta?.height) {
    return { buffer: input, mimeOut: base };
  }

  try {
    if (!meta.hasAlpha) {
      return { buffer: input, mimeOut: base };
    }

    const { data: alpha } = await sharp(input).ensureAlpha().extractChannel("alpha").raw().toBuffer({
      resolveWithObject: true,
    });

    const width = meta.width;
    const height = meta.height;
    const n = width * height;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let p = 0; p < n; p += 1) {
      if (alpha[p] <= 0) continue;
      const x = p % width;
      const y = Math.floor(p / width);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }

    // Nothing visible after decode (or fully transparent): keep original bytes.
    if (maxX < minX || maxY < minY) {
      return { buffer: input, mimeOut: base };
    }

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const longEdge = Math.max(width, height);
    const trimmedW = width - cropW;
    const trimmedH = height - cropH;

    // Skip negligible changes and fully edge-to-edge art.
    if (trimmedW < longEdge * 0.02 && trimmedH < longEdge * 0.02) {
      return { buffer: input, mimeOut: base };
    }

    const pipeline = sharp(input).extract({
      left: minX,
      top: minY,
      width: cropW,
      height: cropH,
    });
    if (base === "image/png") {
      return {
        buffer: await pipeline.png({ compressionLevel: 9 }).toBuffer(),
        mimeOut: "image/png",
      };
    }
    if (base === "image/webp") {
      return {
        buffer: await pipeline.webp({ quality: 92 }).toBuffer(),
        mimeOut: "image/webp",
      };
    }
    if (base === "image/gif") {
      return {
        buffer: await pipeline.png({ compressionLevel: 9 }).toBuffer(),
        mimeOut: "image/png",
      };
    }
    return {
      buffer: await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer(),
      mimeOut: "image/jpeg",
    };
  } catch {
    return { buffer: input, mimeOut: base };
  }
}
