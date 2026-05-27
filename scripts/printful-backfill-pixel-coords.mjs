#!/usr/bin/env node
/**
 * Backfill `printful_blank_mockups.print_area_*_px` + `mockup_*_px` +
 * `template_id` for every cached row that doesn't already have them.
 *
 * One Printful v1 `/mockup-generator/templates/{catalog_product_id}`
 * round-trip per (catalog_product_id, placement) pair; rows from the same
 * product line share a single response so the warmer is cheap.
 *
 * Usage:
 *   node scripts/printful-backfill-pixel-coords.mjs            # backfill rows missing px coords
 *   node scripts/printful-backfill-pixel-coords.mjs --force    # re-fetch every row
 *   node scripts/printful-backfill-pixel-coords.mjs --product=hoodie    # scope to a single product type
 *
 * Wrapper loads `.env.local` and shells into `tsx` against the matching
 * `.mts` runner so it can import the project's TypeScript helpers.
 */

import { spawnSync } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

async function loadEnvLocal() {
  const file = path.join(ROOT, ".env.local");
  try {
    const raw = await fs.readFile(file, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, k, vRaw] = m;
      if (process.env[k] != null) continue;
      let v = vRaw;
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[k] = v;
    }
  } catch {
    // env may come from the shell
  }
}

await loadEnvLocal();

const tsxBin = path.join(ROOT, "node_modules", ".bin", "tsx");
if (!existsSync(tsxBin)) {
  console.error("[printful-backfill-pixel-coords] tsx missing. Run `pnpm add -D tsx`.");
  process.exit(2);
}

const runnerTs = path.join(__dirname, "printful-backfill-pixel-coords.mts");
const res = spawnSync(tsxBin, [runnerTs, ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, NODE_NO_WARNINGS: "1" },
});

process.exit(res.status ?? 1);
