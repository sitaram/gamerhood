import {
  Sprout,
  Sparkles,
  Compass,
  Shield,
  Crown,
  Flame,
  Gem,
  type LucideIcon,
} from "lucide-react";

/**
 * Creator rank ladder. Replaces the old numeric "Level N" rendering with
 * a Roblox/Fortnite-style named tier that feels like a journey rather
 * than a leaderboard score. Tier thresholds are duplicated in
 * `supabase/migrations/027_creator_xp_events.sql` (the `award_xp_event`
 * RPC) — update both if you retune the curve.
 *
 * Accent colors map to Tailwind palette tokens so the tier color is
 * consistent across icons, progress bars, and badges. The matching
 * `bg`/`fg`/`ring` classes live in `tierClasses()` below — Tailwind's
 * JIT can't see dynamic strings like `text-${accent}-400`, so we have
 * to enumerate them statically once.
 */
export type TierAccent =
  | "emerald"
  | "yellow"
  | "sky"
  | "indigo"
  | "amber"
  | "orange"
  | "fuchsia";

export interface Tier {
  /** Stable key for lookups/analytics — never rendered to users. */
  key:
    | "sprout"
    | "spark"
    | "adventurer"
    | "champion"
    | "hero"
    | "legendary"
    | "mythical";
  /** User-facing name. The ONLY thing we render — no "Tier 3" anywhere. */
  label: string;
  minXp: number;
  Icon: LucideIcon;
  accent: TierAccent;
}

export const TIERS: readonly Tier[] = [
  { key: "sprout", label: "Sprout", minXp: 0, Icon: Sprout, accent: "emerald" },
  { key: "spark", label: "Spark", minXp: 100, Icon: Sparkles, accent: "yellow" },
  {
    key: "adventurer",
    label: "Adventurer",
    minXp: 300,
    Icon: Compass,
    accent: "sky",
  },
  {
    key: "champion",
    label: "Champion",
    minXp: 700,
    Icon: Shield,
    accent: "indigo",
  },
  { key: "hero", label: "Hero", minXp: 1500, Icon: Crown, accent: "amber" },
  {
    key: "legendary",
    label: "Legendary",
    minXp: 3000,
    Icon: Flame,
    accent: "orange",
  },
  {
    key: "mythical",
    label: "Mythical",
    minXp: 6000,
    Icon: Gem,
    accent: "fuchsia",
  },
];

export function getTierForXp(xp: number): Tier {
  const safe = Math.max(0, Math.floor(xp));
  let current = TIERS[0];
  for (const t of TIERS) {
    if (safe >= t.minXp) current = t;
    else break;
  }
  return current;
}

/** Returns null when the creator is at the top tier (Mythical). */
export function getNextTier(xp: number): Tier | null {
  const safe = Math.max(0, Math.floor(xp));
  for (const t of TIERS) {
    if (safe < t.minXp) return t;
  }
  return null;
}

/** Inclusive index into TIERS so storefront can hide progress at max. */
export function tierIndexForXp(xp: number): number {
  const current = getTierForXp(xp);
  return TIERS.findIndex((t) => t.key === current.key);
}

export function isMaxTier(xp: number): boolean {
  return getNextTier(xp) === null;
}

/**
 * Progress from current tier's minXp → next tier's minXp as a 0..100
 * percentage. Saturates at 100 once the creator hits Mythical.
 */
export function tierProgressPct(xp: number): number {
  const cur = getTierForXp(xp);
  const next = getNextTier(xp);
  if (!next) return 100;
  const span = next.minXp - cur.minXp;
  if (span <= 0) return 100;
  const into = Math.max(0, xp - cur.minXp);
  return Math.min(100, Math.round((into / span) * 100));
}

/**
 * Static accent → Tailwind class strings. Listing every combination
 * here lets the JIT see them at build time; otherwise dynamic class
 * names like `text-${accent}-400` would be tree-shaken away.
 */
export interface TierClassSet {
  /** Foreground (icon / label) */
  text: string;
  /** Soft tinted background for the badge pill */
  bg: string;
  /** 1px ring around the badge pill */
  ring: string;
  /** Progress bar fill (gradient endpoints) */
  fill: string;
}

export function tierClasses(accent: TierAccent): TierClassSet {
  switch (accent) {
    case "emerald":
      return {
        text: "text-emerald-400",
        bg: "bg-emerald-500/10",
        ring: "ring-emerald-400/40",
        fill: "from-emerald-400 to-emerald-300",
      };
    case "yellow":
      return {
        text: "text-yellow-300",
        bg: "bg-yellow-500/10",
        ring: "ring-yellow-300/40",
        fill: "from-yellow-400 to-amber-300",
      };
    case "sky":
      return {
        text: "text-sky-400",
        bg: "bg-sky-500/10",
        ring: "ring-sky-400/40",
        fill: "from-sky-400 to-cyan-300",
      };
    case "indigo":
      return {
        text: "text-indigo-400",
        bg: "bg-indigo-500/10",
        ring: "ring-indigo-400/40",
        fill: "from-indigo-400 to-violet-400",
      };
    case "amber":
      return {
        text: "text-amber-400",
        bg: "bg-amber-500/10",
        ring: "ring-amber-400/40",
        fill: "from-amber-400 to-yellow-300",
      };
    case "orange":
      return {
        text: "text-orange-400",
        bg: "bg-orange-500/10",
        ring: "ring-orange-400/40",
        fill: "from-orange-400 to-rose-400",
      };
    case "fuchsia":
      return {
        text: "text-fuchsia-300",
        bg: "bg-fuchsia-500/10",
        ring: "ring-fuchsia-400/40",
        fill: "from-fuchsia-400 to-pink-400",
      };
  }
}
