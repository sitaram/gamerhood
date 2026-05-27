#!/usr/bin/env node
/**
 * Regression script — confirms the unified overlay math agrees with
 * Printful's live print area for every product type we sell.
 *
 * For each product type:
 *   1. Pull one sample published product from Supabase (latest published).
 *   2. Read the cached print area dims from `printful_blank_mockups`.
 *   3. Re-fetch the live `placement_dimensions` from Printful's catalog.
 *   4. Compute `designInches` via `computeDesignOverlayBox` and assert it
 *      is internally consistent with the stored placement intent.
 *   5. Assert cached vs. live print area within 1% tolerance.
 *
 * Run before every prod deploy. Documented in `LAUNCH_CHECKLIST.md`.
 *
 * This wrapper loads `.env.local` then spawns `tsx` so the runner can
 * import the project's TypeScript helpers.
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
    // ok — env may come from the shell
  }
}

await loadEnvLocal();

const tsxBin = path.join(ROOT, "node_modules", ".bin", "tsx");
if (!existsSync(tsxBin)) {
  console.error(
    "[check-print-area-consistency] `tsx` is not installed. pnpm add -D tsx, then re-run.",
  );
  process.exit(2);
}

const runnerTs = path.join(__dirname, "check-print-area-consistency.mts");
const passthroughArgs = process.argv.slice(2);

const res = spawnSync(tsxBin, [runnerTs, ...passthroughArgs], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, NODE_NO_WARNINGS: "1" },
});

process.exit(res.status ?? 1);
