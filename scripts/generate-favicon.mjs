import sharp from "sharp";
import pngToIco from "png-to-ico";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/**
 * Head-only axolotl mascot (headset) for tab/app icons. PNG preserves the
 * illustrated art. Source: public/brand/mascot-axolotl-head.png — regenerate
 * that file from the latest brand asset via trim + square cover-crop when needed.
 *
 * We cover-crop to a square so the icon fills the pixel box (no letterboxing),
 * then downsize to standard target sizes with Lanczos3.
 */
const sourcePng = path.join(root, "public/brand/mascot-axolotl-head.png");

async function makeSquarePng(size) {
  return sharp(sourcePng)
    .resize(size, size, { fit: "cover", position: "center", kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// ── 192x192 high-DPI raster (used by Android / PWA / modern browsers) ──
const icon192 = await makeSquarePng(192);
fs.writeFileSync(path.join(root, "public/icon.png"), icon192);
fs.writeFileSync(path.join(root, "src/app/icon.png"), icon192);

// ── 180x180 Apple touch icon (iOS home screen) ──
const apple180 = await makeSquarePng(180);
fs.writeFileSync(path.join(root, "public/apple-icon.png"), apple180);
fs.writeFileSync(path.join(root, "src/app/apple-icon.png"), apple180);

// ── Multi-res favicon.ico (browser tabs) ──
// 16/32/48 covers every UA — Chrome picks 32 for tabs (or 16 on low-DPI),
// Windows uses 48 in taskbars, Firefox picks the closest match.
const tmpDir = fs.mkdtempSync(path.join("/tmp", "gh-ico-"));
const sizes = [16, 32, 48];
const pngPaths = [];
for (const s of sizes) {
  const p = path.join(tmpDir, `${s}.png`);
  fs.writeFileSync(p, await makeSquarePng(s));
  pngPaths.push(p);
}
const icoBuf = await pngToIco(pngPaths);
fs.writeFileSync(path.join(root, "public/favicon.ico"), icoBuf);
// Next.js App Router resolves /favicon.ico from src/app/favicon.ico first,
// so we MUST update that copy too or the rebuild will keep serving the old
// icon from the framework convention slot.
fs.writeFileSync(path.join(root, "src/app/favicon.ico"), icoBuf);
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log("Wrote:");
console.log(`  public/icon.png        (192x192, ${icon192.length} bytes)`);
console.log(`  src/app/icon.png       (192x192, ${icon192.length} bytes)`);
console.log(`  public/apple-icon.png  (180x180, ${apple180.length} bytes)`);
console.log(`  src/app/apple-icon.png (180x180, ${apple180.length} bytes)`);
console.log(`  public/favicon.ico     (16+32+48, ${icoBuf.length} bytes)`);
console.log(`  src/app/favicon.ico    (16+32+48, ${icoBuf.length} bytes)`);
