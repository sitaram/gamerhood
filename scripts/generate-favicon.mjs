import sharp from "sharp";
import pngToIco from "png-to-ico";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/**
 * Head-only axolotl mascot (headset) for tab/app icons.
 * Source: public/brand/mascot-axolotl-head.png
 *
 * Two flavors of source are supported and auto-detected:
 *  1. Photoshop-style "transparent" export with a gray checkerboard baked
 *     in. We key the checkerboard out, trim to the character, center on
 *     a square transparent canvas, and leave a small breathing margin so
 *     the head stays legible at 16/32 px.
 *  2. Square tile with an intentional baked-in background color (e.g.,
 *     brand teal). We keep the background as-is and render edge-to-edge
 *     so the color becomes the icon background.
 * Detection is based on the corner pixels: if the corners are checker
 * colors we treat it as case 1, otherwise case 2. (Internal highlights
 * and shadows on the character may incidentally match the keying rules
 * — we ignore those for detection.)
 */
const sourcePng = path.join(root, "public/brand/mascot-axolotl-head.png");

/** Light/dark squares from Photoshop-style transparency previews. */
function isKeyedBackground(r, g, b) {
  if (Math.abs(r - g) < 8 && Math.abs(g - b) < 8 && r > 220) return true;
  if (Math.abs(r - g) < 5 && Math.abs(g - b) < 5 && r < 50) return true;
  return false;
}

function cornerIsKeyed(data, width, height, x, y) {
  const i = (y * width + x) * 4;
  return isKeyedBackground(data[i], data[i + 1], data[i + 2]);
}

async function loadCharacter() {
  const { data, info } = await sharp(sourcePng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;

  // Decide source style from the corners. A chroma-keyed source has the
  // checker color in every corner; a baked-background tile does not.
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  const cornersKeyed = corners.filter(([x, y]) =>
    cornerIsKeyed(data, width, height, x, y),
  ).length;
  const hasBakedBackground = cornersKeyed === 0;

  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const r = data[si];
      const g = data[si + 1];
      const b = data[si + 2];
      rgba[si] = r;
      rgba[si + 1] = g;
      rgba[si + 2] = b;
      // For baked-background sources, keep every pixel fully opaque so
      // sharp's trim() (when used) has nothing to chew off. For chroma
      // sources, drop alpha on the checker squares so trim() can locate
      // the character.
      rgba[si + 3] = !hasBakedBackground && isKeyedBackground(r, g, b) ? 0 : 255;
    }
  }

  const base = sharp(rgba, { raw: { width, height, channels: 4 } });
  const pipeline = hasBakedBackground ? base : base.trim({ threshold: 1 });
  return { pipeline, hasBakedBackground };
}


/** Center pixels on a square canvas (max side = max(w,h)). */
async function centerOnSquareCanvas(pipeline) {
  const buf = await pipeline.clone().png().toBuffer();
  const meta = await sharp(buf).metadata();
  const size = Math.max(meta.width, meta.height);
  const left = Math.floor((size - meta.width) / 2);
  const top = Math.floor((size - meta.height) / 2);

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: buf, left, top }]);
}

async function makeSquarePng(size, squareBuf, fillRatio) {
  const inner = Math.max(1, Math.round(size * fillRatio));
  const resized = await sharp(squareBuf)
    .resize(inner, inner, {
      fit: "inside",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: "lanczos3",
    })
    .png()
    .toBuffer();

  const meta = await sharp(resized).metadata();
  const left = Math.floor((size - meta.width) / 2);
  const top = Math.floor((size - meta.height) / 2);

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const { pipeline, hasBakedBackground } = await loadCharacter();
const squareCharacter = await (await centerOnSquareCanvas(pipeline))
  .png({ compressionLevel: 9 })
  .toBuffer();

// Baked-background sources are designed as a finished square tile, so we
// render them edge-to-edge. Chroma-keyed sources get ~3% breathing room
// so the character stays legible at 16/32 px tab sizes.
const fillRatio = hasBakedBackground ? 1.0 : 0.97;

// Refresh brand source: normalized PNG on a square canvas.
fs.writeFileSync(sourcePng, squareCharacter);

// ── 192x192 high-DPI raster (used by Android / PWA / modern browsers) ──
const icon192 = await makeSquarePng(192, squareCharacter, fillRatio);
fs.writeFileSync(path.join(root, "public/icon.png"), icon192);
fs.writeFileSync(path.join(root, "src/app/icon.png"), icon192);

// ── 180x180 Apple touch icon (iOS home screen) ──
const apple180 = await makeSquarePng(180, squareCharacter, fillRatio);
fs.writeFileSync(path.join(root, "public/apple-icon.png"), apple180);
fs.writeFileSync(path.join(root, "src/app/apple-icon.png"), apple180);

// ── Multi-res favicon.ico (browser tabs) ──
const tmpDir = fs.mkdtempSync(path.join("/tmp", "gh-ico-"));
const sizes = [16, 32, 48];
const pngPaths = [];
for (const s of sizes) {
  const p = path.join(tmpDir, `${s}.png`);
  fs.writeFileSync(p, await makeSquarePng(s, squareCharacter, fillRatio));
  pngPaths.push(p);
}
const icoBuf = await pngToIco(pngPaths);
fs.writeFileSync(path.join(root, "public/favicon.ico"), icoBuf);
fs.writeFileSync(path.join(root, "src/app/favicon.ico"), icoBuf);
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(
  `Source style: ${hasBakedBackground ? "baked background (edge-to-edge)" : "chroma-keyed (97% fill)"}`,
);
console.log("Wrote:");
console.log(`  public/brand/mascot-axolotl-head.png (square ${hasBakedBackground ? "opaque" : "trimmed RGBA"})`);
console.log(`  public/icon.png        (192x192, ${icon192.length} bytes)`);
console.log(`  src/app/icon.png       (192x192, ${icon192.length} bytes)`);
console.log(`  public/apple-icon.png  (180x180, ${apple180.length} bytes)`);
console.log(`  src/app/apple-icon.png (180x180, ${apple180.length} bytes)`);
console.log(`  public/favicon.ico     (16+32+48, ${icoBuf.length} bytes)`);
console.log(`  src/app/favicon.ico    (16+32+48, ${icoBuf.length} bytes)`);
