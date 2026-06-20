/**
 * Client-side helpers to find the visible artwork bounds inside an upload.
 * Square PNG/JPG exports often ship with large transparent or near-white
 * margins; treating the full canvas as the design makes Printful print a huge
 * matte. These helpers crop to the content bbox before preview/publish, but
 * preserve near-white strokes/outlines that hug colored ink.
 */

const NEAR_WHITE = 245;
const MIN_ALPHA = 12;
/** Ignore trims smaller than this fraction of the long edge (noise / anti-aliasing). */
const MIN_TRIM_FRACTION = 0.02;
/**
 * Near-white pixels within this distance of colored ink are treated as artwork
 * (strokes/outlines), not as export margins to crop away.
 */
const STROKE_PRESERVE_RADIUS = 32;

function isNearWhitePixel(data: Uint8ClampedArray, i: number): boolean {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  return r >= NEAR_WHITE && g >= NEAR_WHITE && b >= NEAR_WHITE;
}

/** Opaque pixels that are not near-white — the "real" colored artwork. */
function isInkPixel(data: Uint8ClampedArray, i: number): boolean {
  const a = data[i + 3];
  if (a < MIN_ALPHA) return false;
  return !isNearWhitePixel(data, i);
}

/** Dilate ink so white strokes/outlines hugging the art stay in the crop box. */
function buildInkPreserveMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const n = width * height;
  const preserve = new Uint8Array(n);
  for (let p = 0; p < n; p += 1) {
    if (isInkPixel(data, p * 4)) preserve[p] = 1;
  }
  for (let r = 0; r < STROKE_PRESERVE_RADIUS; r += 1) {
    const tmp = preserve.slice();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const p = y * width + x;
        if (!preserve[p]) continue;
        if (x > 0) tmp[p - 1] = 1;
        if (x + 1 < width) tmp[p + 1] = 1;
        if (y > 0) tmp[p - width] = 1;
        if (y + 1 < height) tmp[p + width] = 1;
      }
    }
    preserve.set(tmp);
  }
  return preserve;
}

function isContentPixel(
  data: Uint8ClampedArray,
  i: number,
  preserveMask: Uint8Array,
  p: number,
): boolean {
  const a = data[i + 3];
  if (a < MIN_ALPHA) return false;
  if (!isNearWhitePixel(data, i)) return true;
  return preserveMask[p] === 1;
}

export interface ContentBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  aspect: number;
}

/**
 * Scan `imageData` for the tightest box around visible artwork.
 * Trims transparent and distant near-white export margins, but keeps white
 * strokes/outlines that hug colored ink.
 */
export function boundsFromImageData(
  imageData: ImageData,
): ContentBounds | null {
  const { data, width, height } = imageData;
  if (width <= 0 || height <= 0) return null;

  const preserveMask = buildInkPreserveMask(data, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const i = p * 4;
      if (!isContentPixel(data, i, preserveMask, p)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  return {
    left: minX,
    top: minY,
    width: w,
    height: h,
    aspect: w / h,
  };
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (src.startsWith("http")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
    img.src = src;
  });
}

/**
 * Crop uniform transparent / near-white margins from a data URL or remote URL.
 * Returns the original URL when no meaningful margin was found.
 */
export async function trimImageToContent(
  imageUrl: string,
): Promise<{ imageUrl: string; aspect: number; didTrim: boolean }> {
  const img = await loadHtmlImage(imageUrl);
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  if (srcW <= 0 || srcH <= 0) {
    return { imageUrl, aspect: 1, didTrim: false };
  }

  const canvas = document.createElement("canvas");
  canvas.width = srcW;
  canvas.height = srcH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { imageUrl, aspect: srcW / srcH, didTrim: false };
  }

  ctx.drawImage(img, 0, 0);
  const bounds = boundsFromImageData(ctx.getImageData(0, 0, srcW, srcH));
  if (!bounds) {
    return { imageUrl, aspect: srcW / srcH, didTrim: false };
  }

  const longEdge = Math.max(srcW, srcH);
  const trimmedX = bounds.left + (srcW - bounds.left - bounds.width);
  const trimmedY = bounds.top + (srcH - bounds.top - bounds.height);
  if (
    bounds.left < longEdge * MIN_TRIM_FRACTION &&
    bounds.top < longEdge * MIN_TRIM_FRACTION &&
    trimmedX < longEdge * MIN_TRIM_FRACTION &&
    trimmedY < longEdge * MIN_TRIM_FRACTION
  ) {
    return { imageUrl, aspect: srcW / srcH, didTrim: false };
  }

  const out = document.createElement("canvas");
  out.width = bounds.width;
  out.height = bounds.height;
  const outCtx = out.getContext("2d");
  if (!outCtx) {
    return { imageUrl, aspect: bounds.aspect, didTrim: false };
  }
  outCtx.drawImage(
    canvas,
    bounds.left,
    bounds.top,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height,
  );

  const mime = imageUrl.startsWith("data:image/jpeg") ? "image/jpeg" : "image/png";
  const trimmedUrl =
    mime === "image/jpeg"
      ? out.toDataURL("image/jpeg", 0.92)
      : out.toDataURL("image/png");

  return { imageUrl: trimmedUrl, aspect: bounds.aspect, didTrim: true };
}

/** Aspect ratio of visible artwork (falls back to full frame on failure). */
export async function detectContentAspect(imageUrl: string): Promise<number> {
  try {
    const img = await loadHtmlImage(imageUrl);
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    if (srcW <= 0 || srcH <= 0) return 1;

    const canvas = document.createElement("canvas");
    canvas.width = srcW;
    canvas.height = srcH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return srcW / srcH;

    ctx.drawImage(img, 0, 0);
    const bounds = boundsFromImageData(ctx.getImageData(0, 0, srcW, srcH));
    return bounds?.aspect ?? srcW / srcH;
  } catch {
    return 1;
  }
}
