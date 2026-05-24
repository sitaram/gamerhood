import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Bake the default-avatar pool from raw axolotl PNGs.
 *
 * Source layout:
 *   public/brand/default-avatars/_source/<name>.png   (RGB on solid black bg)
 * Output:
 *   public/brand/default-avatars/<name>.png           (512x512 transparent PNG)
 *
 * The sources are AI-generated illustrations on a pure-black background.
 * The axolotls themselves use dark *colored* outlines (deep purples /
 * browns), never true near-black, so we can chroma-key the background
 * with a tight `r<25 && g<25 && b<25` threshold without nibbling at the
 * character. A narrow `r,g,b < 60` band feathers the alpha so the edge
 * doesn't shimmer at smaller display sizes.
 *
 * To add a new default avatar:
 *   1. Drop the source PNG into public/brand/default-avatars/_source/
 *      (any name; the basename becomes the output filename).
 *   2. `node scripts/process-default-avatars.mjs`
 *   3. Add the new file's basename to `DEFAULT_AVATAR_POOL` in
 *      src/lib/profile-avatar.ts (the pool isn't auto-discovered so
 *      that production builds don't have to read the public/ dir).
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcDir = path.join(root, "public/brand/default-avatars/_source");
const outDir = path.join(root, "public/brand/default-avatars");

const OUTPUT_SIZE = 512;
const HARD_THRESHOLD = 25;
const FEATHER_THRESHOLD = 60;

async function processOne(srcPath, outPath) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const rgba = Buffer.from(data);
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const maxChan = Math.max(r, g, b);

    if (maxChan < HARD_THRESHOLD) {
      // Pure black background → fully transparent.
      rgba[i + 3] = 0;
    } else if (maxChan < FEATHER_THRESHOLD) {
      // Narrow band where the source's anti-aliased edges fade into the
      // black bg. Ramp alpha linearly so the silhouette stays crisp but
      // doesn't show a hard halo at small sizes.
      const t = (maxChan - HARD_THRESHOLD) / (FEATHER_THRESHOLD - HARD_THRESHOLD);
      rgba[i + 3] = Math.round(255 * t);
    }
  }

  const keyed = sharp(rgba, { raw: { width, height, channels: 4 } });
  const trimmedBuf = await keyed.trim({ threshold: 1 }).png().toBuffer();
  const meta = await sharp(trimmedBuf).metadata();

  const longSide = Math.max(meta.width, meta.height);
  // ~6% breathing room so the character isn't kissing the circular crop
  // when displayed in a rounded-full avatar.
  const innerSize = Math.round(longSide * 1.12);
  const resized = await sharp(trimmedBuf)
    .resize(longSide, longSide, {
      fit: "inside",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: "lanczos3",
    })
    .toBuffer();
  const resizedMeta = await sharp(resized).metadata();

  const padX = Math.floor((innerSize - resizedMeta.width) / 2);
  const padY = Math.floor((innerSize - resizedMeta.height) / 2);

  const padded = await sharp({
    create: {
      width: innerSize,
      height: innerSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left: padX, top: padY }])
    .png()
    .toBuffer();

  // Cartoon illustrations with flat colours compress dramatically as an
  // 8-bit palette PNG. We accept a small quality hit (256 colours) so the
  // bundle stays light; visual diff is imperceptible at avatar sizes.
  const final = await sharp(padded)
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
      fit: "inside",
      kernel: "lanczos3",
    })
    .png({
      compressionLevel: 9,
      palette: true,
      quality: 90,
      effort: 10,
    })
    .toBuffer();

  fs.writeFileSync(outPath, final);
  return final.length;
}

async function main() {
  if (!fs.existsSync(srcDir)) {
    console.error(`No source dir at ${srcDir}`);
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });

  const sources = fs
    .readdirSync(srcDir)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort();

  if (sources.length === 0) {
    console.error("No PNG sources to process.");
    process.exit(1);
  }

  for (const file of sources) {
    const srcPath = path.join(srcDir, file);
    const outPath = path.join(outDir, file);
    const bytes = await processOne(srcPath, outPath);
    const kb = (bytes / 1024).toFixed(1);
    console.log(`  public/brand/default-avatars/${file}  (${OUTPUT_SIZE}px, ${kb} KB)`);
  }

  console.log(`\nProcessed ${sources.length} avatar(s).`);
  console.log(
    "Remember to update DEFAULT_AVATAR_POOL in src/lib/profile-avatar.ts when adding new files.",
  );
}

await main();
