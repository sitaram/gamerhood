import { Gem } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getNextTier,
  getTierForXp,
  isMaxTier,
  tierClasses,
  tierProgressPct,
} from "@/lib/xp/tiers";

interface TierProgressProps {
  xp: number;
  className?: string;
}

/**
 * Tier-aware replacement for the old "Level 1 → Level 2" XP bar.
 * - Shows the named current tier on the left, the named next tier
 *   on the right, with a fill that progresses from this tier's
 *   `minXp` to the next tier's `minXp`.
 * - At the top of the ladder (Mythical), the bar is replaced by a
 *   small "Max tier — Mythical creator" flourish so we never render
 *   a perpetually-full empty-feeling bar.
 */
export function TierProgress({ xp, className }: TierProgressProps) {
  const cur = getTierForXp(xp);
  const next = getNextTier(xp);
  const curClasses = tierClasses(cur.accent);

  if (isMaxTier(xp) || !next) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-200",
          className,
        )}
      >
        <Gem aria-hidden className="h-4 w-4 text-fuchsia-300" />
        Max tier — Mythical creator
      </div>
    );
  }

  const pct = tierProgressPct(xp);
  const xpIntoTier = Math.max(0, xp - cur.minXp);
  const xpSpan = next.minXp - cur.minXp;

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className={cn("font-semibold", curClasses.text)}>{cur.label}</span>
        <span className="font-medium text-muted-foreground">{next.label}</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={xpIntoTier}
        aria-valuemin={0}
        aria-valuemax={xpSpan}
        aria-label={`${xpIntoTier} of ${xpSpan} XP toward ${next.label}`}
        className="h-2 overflow-hidden rounded-full bg-secondary"
      >
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r transition-all",
            curClasses.fill,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {xpIntoTier} / {xpSpan} XP to {next.label}
      </p>
    </div>
  );
}
