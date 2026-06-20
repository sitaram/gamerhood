import sharp from "sharp";

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

/**
 * Strip common fake-transparency artifacts from design rasters:
 * - checkerboard tiles baked into RGB
 * - purple dashed placement guides
 *
 * This runs only when we detect meaningful colored foreground content, so
 * grayscale-only artwork does not get over-cleaned.
 */
export async function stripDesignArtifacts(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  if (ch < 4 || w < 8 || h < 8) return input;

  const n = w * h;
  const saturated = new Uint8Array(n);
  const neutral = new Uint8Array(n);
  const purple = new Uint8Array(n);

  let saturatedCount = 0;
  for (let p = 0; p < n; p += 1) {
    const idx = p * ch;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];
    if (a < 120) continue;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    if (spread <= 18) neutral[p] = 1;

    const { h: hue, s, v } = rgbToHsv(r, g, b);
    if (s >= 0.18 && v >= 0.2) {
      saturated[p] = 1;
      saturatedCount += 1;
    }
    const isPurple = (hue >= 248 && hue <= 292) || (hue >= 292 && hue <= 318);
    if (isPurple && s >= 0.16 && v >= 0.2) purple[p] = 1;
  }

  // No meaningful chroma foreground: avoid aggressive removal on grayscale art.
  if (saturatedCount < 80 || saturatedCount < Math.floor(n * 0.001)) {
    return input;
  }

  const removeMask = new Uint8Array(n);
  const seen = new Uint8Array(n);
  const queue = new Int32Array(n);

  const runComponents = (
    mask: Uint8Array,
    kind: "checker" | "guide",
  ) => {
    for (let seed = 0; seed < n; seed += 1) {
      if (!mask[seed] || seen[seed]) continue;
      let qh = 0;
      let qt = 0;
      queue[qt++] = seed;
      seen[seed] = 1;

      let area = 0;
      let minX = w;
      let minY = h;
      let maxX = 0;
      let maxY = 0;
      let touchesBorder = false;
      let lumMin = 255;
      let lumMax = 0;
      let dark = 0;
      let light = 0;

      while (qh < qt) {
        const p = queue[qh++];
        area += 1;
        const x = p % w;
        const y = Math.floor(p / w);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBorder = true;

        const idx = p * ch;
        const lum = luminance(data[idx], data[idx + 1], data[idx + 2]);
        if (lum < lumMin) lumMin = lum;
        if (lum > lumMax) lumMax = lum;
        if (lum < 120) dark += 1;
        else light += 1;

        const neighbors = [
          x > 0 ? p - 1 : -1,
          x + 1 < w ? p + 1 : -1,
          y > 0 ? p - w : -1,
          y + 1 < h ? p + w : -1,
        ];
        for (const np of neighbors) {
          if (np < 0 || !mask[np] || seen[np]) continue;
          seen[np] = 1;
          queue[qt++] = np;
        }
      }

      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      const bboxArea = bw * bh;
      const fill = bboxArea > 0 ? area / bboxArea : 0;
      const lumRange = lumMax - lumMin;
      const darkShare = area > 0 ? dark / area : 0;
      const lightShare = area > 0 ? light / area : 0;

      const removeChecker =
        kind === "checker" &&
        area >= 180 &&
        lumRange >= 16 &&
        darkShare >= 0.15 &&
        lightShare >= 0.15 &&
        ((touchesBorder && bboxArea >= 180) || bboxArea >= Math.floor(n * 0.01));

      const removeGuide =
        kind === "guide" &&
        area >= 80 &&
        bw >= 20 &&
        bh >= 20 &&
        fill < 0.3 &&
        bboxArea >= 500;

      if (removeChecker || removeGuide) {
        for (let i = 0; i < qt; i += 1) {
          removeMask[queue[i]] = 1;
        }
      }
    }
  };

  runComponents(neutral, "checker");
  seen.fill(0);
  runComponents(purple, "guide");

  let removed = 0;
  for (let p = 0; p < n; p += 1) {
    if (!removeMask[p]) continue;
    const idx = p * ch;
    data[idx + 3] = 0;
    removed += 1;
  }
  if (removed === 0) return input;

  return sharp(data, { raw: { width: w, height: h, channels: ch } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function isNearNeutral(r: number, g: number, b: number): boolean {
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  return spread <= 22;
}

function isGuidePurple(r: number, g: number, b: number): boolean {
  const { h, s, v } = rgbToHsv(r, g, b);
  return h >= 250 && h <= 318 && s >= 0.16 && v >= 0.2;
}

function isCheckerCandidate(r: number, g: number, b: number): boolean {
  if (!isNearNeutral(r, g, b)) return false;
  const lum = luminance(r, g, b);
  return lum >= 30 && lum <= 245;
}

function isPreviewBackgroundCandidate(r: number, g: number, b: number): boolean {
  if (!isNearNeutral(r, g, b)) return false;
  const lum = luminance(r, g, b);
  return lum >= 4 && lum <= 252;
}

/** Neutral cleanup target for preview sanitization — excludes white ink/strokes. */
function isSanitizeBackgroundCandidate(r: number, g: number, b: number): boolean {
  if (!isNearNeutral(r, g, b)) return false;
  const lum = luminance(r, g, b);
  // Checker mats and gray guides sit in mid-tones; bright white is usually
  // intentional artwork (outlines, highlights), not export background.
  return lum >= 4 && lum <= 235;
}

function colorDistSq(
  ar: number,
  ag: number,
  ab: number,
  br: number,
  bg: number,
  bb: number,
): number {
  const dr = ar - br;
  const dg = ag - bg;
  const db = ab - bb;
  return dr * dr + dg * dg + db * db;
}

function stripDetectedCheckerPatternInPlace(
  data: Buffer<ArrayBufferLike>,
  w: number,
  h: number,
  ch: number,
): number {
  const n = w * h;
  const bins = new Map<string, { r: number; g: number; b: number; count: number }>();
  for (let p = 0; p < n; p += 1) {
    const idx = p * ch;
    const a = data[idx + 3];
    if (a < 180) continue;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    if (!isCheckerCandidate(r, g, b)) continue;
    const qr = Math.round(r / 6) * 6;
    const qg = Math.round(g / 6) * 6;
    const qb = Math.round(b / 6) * 6;
    const key = `${qr},${qg},${qb}`;
    const ex = bins.get(key);
    if (ex) ex.count += 1;
    else bins.set(key, { r: qr, g: qg, b: qb, count: 1 });
  }
  const top = [...bins.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  if (top.length < 2) return 0;

  const matchTolSq = 13 * 13;
  const checkerThresholdSq = 24 * 24;
  const contrastThresholdSq = 26 * 26;
  const same = (r: number, g: number, b: number, c: { r: number; g: number; b: number }) =>
    colorDistSq(r, g, b, c.r, c.g, c.b) <= matchTolSq;

  let best:
    | {
        a: { r: number; g: number; b: number };
        b: { r: number; g: number; b: number };
        score: number;
        candidates: number;
      }
    | null = null;

  for (let i = 0; i < top.length; i += 1) {
    for (let j = i + 1; j < top.length; j += 1) {
      const c1 = top[i];
      const c2 = top[j];
      const d = colorDistSq(c1.r, c1.g, c1.b, c2.r, c2.g, c2.b);
      if (d < 8 * 8 || d > 120 * 120) continue;
      let score = 0;
      let candidates = 0;
      for (let y = 0; y < h - 1; y += 1) {
        for (let x = 0; x < w - 1; x += 1) {
          const i0 = (y * w + x) * ch;
          const a0 = data[i0 + 3];
          if (a0 < 180) continue;
          const r = data[i0];
          const g = data[i0 + 1];
          const b = data[i0 + 2];
          const isC1 = same(r, g, b, c1);
          const isC2 = same(r, g, b, c2);
          if (!isC1 && !isC2) continue;
          candidates += 1;
          const ir = i0 + ch;
          const id = i0 + ch * w;
          const idi = id + ch;
          const rr = data[ir];
          const rg = data[ir + 1];
          const rb = data[ir + 2];
          const dr = data[id];
          const dg = data[id + 1];
          const db = data[id + 2];
          const xr = data[idi];
          const xg = data[idi + 1];
          const xb = data[idi + 2];
          const dDiag = colorDistSq(r, g, b, xr, xg, xb);
          const dRight = colorDistSq(r, g, b, rr, rg, rb);
          const dDown = colorDistSq(r, g, b, dr, dg, db);
          if (dDiag <= checkerThresholdSq && dRight >= contrastThresholdSq && dDown >= contrastThresholdSq) {
            score += 1;
          }
        }
      }
      if (candidates < Math.max(120, Math.floor(n * 0.0002))) continue;
      if (!best || score > best.score) {
        best = { a: c1, b: c2, score, candidates };
      }
    }
  }

  if (!best) return 0;
  const ratio = best.score / Math.max(1, best.candidates);
  if (best.score < 40 || ratio < 0.035) return 0;

  const isA = (r: number, g: number, b: number) => same(r, g, b, best!.a);
  const isB = (r: number, g: number, b: number) => same(r, g, b, best!.b);
  const matchesAB = (r: number, g: number, b: number) => isA(r, g, b) || isB(r, g, b);

  let removed = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const idx = (y * w + x) * ch;
      if (data[idx + 3] < 120) continue;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      if (!matchesAB(r, g, b)) continue;

      const right = idx + ch;
      const left = idx - ch;
      const up = idx - ch * w;
      const down = idx + ch * w;
      const ul = up - ch;
      const ur = up + ch;
      const dl = down - ch;
      const dr = down + ch;

      const opp = isA(r, g, b)
        ? (isB(data[right], data[right + 1], data[right + 2]) ||
            isB(data[left], data[left + 1], data[left + 2]) ||
            isB(data[up], data[up + 1], data[up + 2]) ||
            isB(data[down], data[down + 1], data[down + 2]))
        : (isA(data[right], data[right + 1], data[right + 2]) ||
            isA(data[left], data[left + 1], data[left + 2]) ||
            isA(data[up], data[up + 1], data[up + 2]) ||
            isA(data[down], data[down + 1], data[down + 2]));

      const sameDiag =
        matchesAB(data[ul], data[ul + 1], data[ul + 2]) ||
        matchesAB(data[ur], data[ur + 1], data[ur + 2]) ||
        matchesAB(data[dl], data[dl + 1], data[dl + 2]) ||
        matchesAB(data[dr], data[dr + 1], data[dr + 2]);

      if (opp && sameDiag) {
        data[idx + 3] = 0;
        removed += 1;
      }
    }
  }
  return removed;
}

/**
 * Conservative checker-only cleanup used for canonical design bytes.
 *
 * This only clears pixels that match a strong 2-color alternating checker
 * pattern signature. It does NOT run neutral-color flood removal, so dark
 * or grayscale artwork is preserved.
 */
export async function stripCheckerboardOnly(
  input: Buffer,
): Promise<{ buffer: Buffer; changed: boolean }> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  if (ch < 4 || w < 8 || h < 8) {
    return { buffer: input, changed: false };
  }

  const removed = stripDetectedCheckerPatternInPlace(data, w, h, ch);
  if (removed === 0) {
    return { buffer: input, changed: false };
  }

  const buffer = await sharp(data, { raw: { width: w, height: h, channels: ch } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { buffer, changed: true };
}

/**
 * Detect a baked-in transparency checkerboard in raster bytes.
 *
 * Used as an UPLOAD GUARD: artwork exported with the editor's transparency
 * checkerboard visible (or vectorized from such an export) has the checker
 * as real opaque pixels. There is no clean source to recover, and automated
 * keying damages edges, so we reject these at upload time instead of letting
 * them reach a listing.
 *
 * A transparency checkerboard has a very specific, combined fingerprint that
 * ordinary artwork (including photos and grayscale logos) does not satisfy
 * all at once:
 *   1. Two balanced, dominant *neutral gray* tones cover most of the opaque
 *      pixels (the two checker squares, ~50/50).
 *   2. Many of those neutral pixels sit on hard luminance edges (the crisp
 *      square borders) — this excludes flat solid-color backgrounds.
 *   3. Box-downscaling the whole image collapses it toward a flat mid-gray
 *      (low coarse luminance variance) — this excludes photographs and
 *      detailed art, whose structure survives downscaling.
 *
 * Requiring ALL of these keeps false positives extremely low while reliably
 * catching the editor checker at any cell size (validated on real assets).
 */
export async function detectBakedCheckerboard(
  input: Buffer,
): Promise<{ checker: boolean; coverage: number }> {
  // Fine layer: nearest-neighbour keeps the hard checker edges intact.
  const fine = await sharp(input)
    .resize(512, 512, { fit: "inside", withoutEnlargement: true, kernel: sharp.kernel.nearest })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .catch(() => null);
  if (!fine) return { checker: false, coverage: 0 };

  const { data, info } = fine;
  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  if (w < 32 || h < 32) return { checker: false, coverage: 0 };

  const bins = new Map<string, { r: number; g: number; b: number; count: number }>();
  let opaque = 0;
  let neutralHardEdge = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * ch;
      if (data[i + 3] < 180) continue;
      opaque += 1;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (!isPreviewBackgroundCandidate(r, g, b)) continue;
      const qr = Math.round(r / 8) * 8;
      const qg = Math.round(g / 8) * 8;
      const qb = Math.round(b / 8) * 8;
      const key = `${qr},${qg},${qb}`;
      const ex = bins.get(key);
      if (ex) ex.count += 1;
      else bins.set(key, { r: qr, g: qg, b: qb, count: 1 });

      const lum = luminance(r, g, b);
      const right = i + ch;
      const down = i + ch * w;
      for (const j of [right, down]) {
        if (j + 3 >= data.length || data[j + 3] < 180) continue;
        const r2 = data[j];
        const g2 = data[j + 1];
        const b2 = data[j + 2];
        if (Math.max(r2, g2, b2) - Math.min(r2, g2, b2) > 22) continue;
        if (Math.abs(lum - luminance(r2, g2, b2)) > 30) {
          neutralHardEdge += 1;
          break;
        }
      }
    }
  }
  if (opaque < 2000 || bins.size < 2) return { checker: false, coverage: 0 };

  const sorted = [...bins.values()].sort((a, b) => b.count - a.count);
  const c1 = sorted[0];
  let c2: { r: number; g: number; b: number; count: number } | null = null;
  for (let k = 1; k < sorted.length; k += 1) {
    if (
      Math.abs(luminance(sorted[k].r, sorted[k].g, sorted[k].b) - luminance(c1.r, c1.g, c1.b)) >= 24
    ) {
      c2 = sorted[k];
      break;
    }
  }
  if (!c2) return { checker: false, coverage: 0 };

  const matchTolSq = 16 * 16;
  const near = (r: number, g: number, b: number, c: { r: number; g: number; b: number }) =>
    colorDistSq(r, g, b, c.r, c.g, c.b) <= matchTolSq;

  let m1 = 0;
  let m2 = 0;
  for (let p = 0; p < w * h; p += 1) {
    const i = p * ch;
    if (data[i + 3] < 180) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (near(r, g, b, c1)) m1 += 1;
    else if (near(r, g, b, c2)) m2 += 1;
  }

  const pairCoverage = (m1 + m2) / opaque;
  const balance = Math.max(m1, m2) > 0 ? Math.min(m1, m2) / Math.max(m1, m2) : 0;
  const hardEdgeFrac = neutralHardEdge / opaque;

  // Coarse layer: a checker box-averages to near-flat gray; photos/art do not.
  const coarse = await sharp(input)
    .resize(28, 28, { fit: "fill", kernel: sharp.kernel.cubic })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .catch(() => null);
  let coarseStd = Number.POSITIVE_INFINITY;
  if (coarse) {
    const cd = coarse.data;
    const cc = coarse.info.channels;
    const cn = coarse.info.width * coarse.info.height;
    let s = 0;
    let s2 = 0;
    for (let p = 0; p < cn; p += 1) {
      const i = p * cc;
      const lum = luminance(cd[i], cd[i + 1], cd[i + 2]);
      s += lum;
      s2 += lum * lum;
    }
    const mean = s / cn;
    coarseStd = Math.sqrt(Math.max(0, s2 / cn - mean * mean));
  }

  const checker =
    pairCoverage >= 0.3 && balance >= 0.45 && coarseStd < 55 && hardEdgeFrac >= 0.04;
  return { checker, coverage: Number(pairCoverage.toFixed(4)) };
}

/**
 * Aggressive cleanup used only for storefront/display sanitization:
 * remove border-connected checker/solid backgrounds and obvious
 * magenta guide overlays while preserving the interior artwork.
 */
export async function stripDesignArtifactsForSanitizedPreview(input: Buffer): Promise<Buffer> {
  const conservative = await stripDesignArtifacts(input).catch(() => input);
  const { data, info } = await sharp(conservative)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  if (ch < 4 || w < 8 || h < 8) return conservative;

  const n = w * h;
  const bgCandidate = new Uint8Array(n);
  const purple = new Uint8Array(n);
  const checkerRemoved = stripDetectedCheckerPatternInPlace(data, w, h, ch);

  let borderBgHits = 0;
  let borderOpaque = 0;
  const borderTotal = Math.max(1, 2 * w + 2 * h - 4);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = y * w + x;
      const idx = p * ch;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      if (a < 100) continue;

      const checker = isPreviewBackgroundCandidate(r, g, b);
      const guide = isGuidePurple(r, g, b);
      if (checker || guide) bgCandidate[p] = 1;
      if (guide) purple[p] = 1;

      const isBorder = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      if (isBorder) {
        borderOpaque += 1;
        if (checker || guide) borderBgHits += 1;
      }
    }
  }

  const edgeConfidence =
    borderOpaque > 0 ? borderBgHits / borderOpaque : borderBgHits / borderTotal;
  const remove = new Uint8Array(n);
  const seen = new Uint8Array(n);
  const q = new Int32Array(n);
  let qh = 0;
  let qt = 0;

  const push = (p: number) => {
    if (p < 0 || p >= n || seen[p] || !bgCandidate[p]) return;
    seen[p] = 1;
    q[qt++] = p;
  };

  if (edgeConfidence >= 0.22) {
    for (let x = 0; x < w; x += 1) {
      push(x);
      push((h - 1) * w + x);
    }
    for (let y = 0; y < h; y += 1) {
      push(y * w);
      push(y * w + (w - 1));
    }

    while (qh < qt) {
      const p = q[qh++];
      remove[p] = 1;
      const x = p % w;
      const y = Math.floor(p / w);
      if (x > 0) push(p - 1);
      if (x + 1 < w) push(p + 1);
      if (y > 0) push(p - w);
      if (y + 1 < h) push(p + w);
    }

    // Also remove sparse purple guide lines that may float inside the frame.
    seen.fill(0);
    for (let seed = 0; seed < n; seed += 1) {
      if (!purple[seed] || seen[seed]) continue;
      qh = 0;
      qt = 0;
      q[qt++] = seed;
      seen[seed] = 1;
      let area = 0;
      let minX = w;
      let minY = h;
      let maxX = 0;
      let maxY = 0;
      while (qh < qt) {
        const p = q[qh++];
        area += 1;
        const x = p % w;
        const y = Math.floor(p / w);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (x > 0) {
          const np = p - 1;
          if (purple[np] && !seen[np]) {
            seen[np] = 1;
            q[qt++] = np;
          }
        }
        if (x + 1 < w) {
          const np = p + 1;
          if (purple[np] && !seen[np]) {
            seen[np] = 1;
            q[qt++] = np;
          }
        }
        if (y > 0) {
          const np = p - w;
          if (purple[np] && !seen[np]) {
            seen[np] = 1;
            q[qt++] = np;
          }
        }
        if (y + 1 < h) {
          const np = p + w;
          if (purple[np] && !seen[np]) {
            seen[np] = 1;
            q[qt++] = np;
          }
        }
      }
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      const bbox = Math.max(1, bw * bh);
      const fill = area / bbox;
      const lineLike = area >= 30 && bw >= 12 && bh >= 12 && fill < 0.35;
      if (!lineLike) continue;
      for (let i = 0; i < qt; i += 1) {
        remove[q[i]] = 1;
      }
    }
  }

  let removed = checkerRemoved;
  for (let p = 0; p < n; p += 1) {
    if (!remove[p]) continue;
    const idx = p * ch;
    data[idx + 3] = 0;
    removed += 1;
  }
  /**
   * Pass 2: remove tight checker backgrounds that survive border-flooding.
   *
   * These are usually neutral (gray/near-gray) pixels boxed around the art.
   * We preserve any neutral pixels close to saturated "real ink", and only
   * clear neutral/purple pixels that are far away from color content.
   */
  const saturatedSeed = new Uint8Array(n);
  let saturatedCount = 0;
  for (let p = 0; p < n; p += 1) {
    const idx = p * ch;
    const a = data[idx + 3];
    if (a < 120) continue;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const { s, v } = rgbToHsv(r, g, b);
    if (s >= 0.2 && v >= 0.18) {
      saturatedSeed[p] = 1;
      saturatedCount += 1;
    }
  }

  if (saturatedCount > Math.max(24, Math.floor(n * 0.0001))) {
    const preserve = saturatedSeed.slice();
    const tmp = new Uint8Array(n);
    /** Keep neutral pixels near colored ink — wide enough for white outlines. */
    const RADIUS = 32;
    for (let iter = 0; iter < RADIUS; iter += 1) {
      tmp.set(preserve);
      for (let p = 0; p < n; p += 1) {
        if (!preserve[p]) continue;
        const x = p % w;
        const y = Math.floor(p / w);
        if (x > 0) tmp[p - 1] = 1;
        if (x + 1 < w) tmp[p + 1] = 1;
        if (y > 0) tmp[p - w] = 1;
        if (y + 1 < h) tmp[p + w] = 1;
        if (x > 0 && y > 0) tmp[p - w - 1] = 1;
        if (x + 1 < w && y > 0) tmp[p - w + 1] = 1;
        if (x > 0 && y + 1 < h) tmp[p + w - 1] = 1;
        if (x + 1 < w && y + 1 < h) tmp[p + w + 1] = 1;
      }
      preserve.set(tmp);
    }

    for (let p = 0; p < n; p += 1) {
      if (preserve[p]) continue;
      const idx = p * ch;
      const a = data[idx + 3];
      if (a < 120) continue;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const x = p % w;
      const y = Math.floor(p / w);
      let checkerPattern = false;
      if (x + 1 < w && y + 1 < h) {
        const right = idx + ch;
        const down = idx + ch * w;
        const diag = down + ch;
        const dDiag = colorDistSq(r, g, b, data[diag], data[diag + 1], data[diag + 2]);
        const dRight = colorDistSq(r, g, b, data[right], data[right + 1], data[right + 2]);
        const dDown = colorDistSq(r, g, b, data[down], data[down + 1], data[down + 2]);
        checkerPattern = dDiag <= 24 * 24 && dRight >= 28 * 28 && dDown >= 28 * 28;
      }
      if (
        isSanitizeBackgroundCandidate(r, g, b) ||
        isGuidePurple(r, g, b) ||
        checkerPattern
      ) {
        data[idx + 3] = 0;
        removed += 1;
      }
    }
  }

  if (removed === 0) return conservative;

  return sharp(data, { raw: { width: w, height: h, channels: ch } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
