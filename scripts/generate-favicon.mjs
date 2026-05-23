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
 * The export may bake in a gray checkerboard (no alpha). We key that out,
 * trim to the character, center on a square transparent canvas (equal W×H
 * bounding box), then scale to favicon sizes.
 */
const sourcePng = path.join(root, "public/brand/mascot-axolotl-head.png");

/** Light/dark squares from Photoshop-style transparency previews. */
function isKeyedBackground(r, g, b) {
  if (Math.abs(r - g) < 8 && Math.abs(g - b) < 8 && r > 220) return true;
  if (Math.abs(r - g) < 5 && Math.abs(g - b) < 5 && r < 50) return true;
  return false;
}

async function loadTrimmedCharacter() {
  const { data, info } = await sharp(sourcePng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const rgba = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const r = data[si];
      const g = data[si + 1];
      const b = data[si + 2];
      const di = si;
      rgba[di] = r;
      rgba[di + 1] = g;
      rgba[di + 2] = b;
      rgba[di + 3] = isKeyedBackground(r, g, b) ? 0 : 255;
    }
  }

  return sharp(rgba, { raw: { width, height, channels: 4 } }).trim({
    threshold: 1,
  });
}


/** Center trimmed pixels on a square canvas (max side = max(w,h)). */
async function centerOnSquareCanvas(trimmedPipeline) {
  const trimmedPng = await trimmedPipeline.clone().png().toBuffer();
  const meta = await sharp(trimmedPng).metadata();
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
    .composite([{ input: trimmedPng, left, top }]);
}

/** Scale to ~97% of the square so small favicons stay legible. */
const FILL_RATIO = 0.97;

async function makeSquarePng(size, squareBuf) {
  const inner = Math.max(1, Math.round(size * FILL_RATIO));
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

const trimmed = await loadTrimmedCharacter();
const squareCharacter = await (await centerOnSquareCanvas(trimmed))
  .png({ compressionLevel: 9 })
  .toBuffer();

// Refresh brand source: trimmed RGBA on a square canvas.
fs.writeFileSync(sourcePng, squareCharacter);

// ── 192x192 high-DPI raster (used by Android / PWA / modern browsers) ──
const icon192 = await makeSquarePng(192, squareCharacter);
fs.writeFileSync(path.join(root, "public/icon.png"), icon192);
fs.writeFileSync(path.join(root, "src/app/icon.png"), icon192);

// ── 180x180 Apple touch icon (iOS home screen) ──
const apple180 = await makeSquarePng(180, squareCharacter);
fs.writeFileSync(path.join(root, "public/apple-icon.png"), apple180);
fs.writeFileSync(path.join(root, "src/app/apple-icon.png"), apple180);

// ── Multi-res favicon.ico (browser tabs) ──
const tmpDir = fs.mkdtempSync(path.join("/tmp", "gh-ico-"));
const sizes = [16, 32, 48];
const pngPaths = [];
for (const s of sizes) {
  const p = path.join(tmpDir, `${s}.png`);
  fs.writeFileSync(p, await makeSquarePng(s, squareCharacter));
  pngPaths.push(p);
}
const icoBuf = await pngToIco(pngPaths);
fs.writeFileSync(path.join(root, "public/favicon.ico"), icoBuf);
fs.writeFileSync(path.join(root, "src/app/favicon.ico"), icoBuf);
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log("Wrote:");
console.log(`  public/brand/mascot-axolotl-head.png (square trimmed RGBA)`);
console.log(`  public/icon.png        (192x192, ${icon192.length} bytes)`);
console.log(`  src/app/icon.png       (192x192, ${icon192.length} bytes)`);
console.log(`  public/apple-icon.png  (180x180, ${apple180.length} bytes)`);
console.log(`  src/app/apple-icon.png (180x180, ${apple180.length} bytes)`);
console.log(`  public/favicon.ico     (16+32+48, ${icoBuf.length} bytes)`);
console.log(`  src/app/favicon.ico    (16+32+48, ${icoBuf.length} bytes)`);
