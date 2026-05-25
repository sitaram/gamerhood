import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type XpBadgeVariant = "inline" | "prominent";

interface XpBadgeProps {
  /** XP value to advertise (e.g. 25). Renders as `+25 XP`. */
  points: number;
  variant?: XpBadgeVariant;
  className?: string;
}

/**
 * Tiny gold "+25 XP" pill placed next to CTAs to advertise the reward
 * the user gets by taking the adjacent action. Source of truth for
 * the points value is `src/lib/xp/rules.ts` — pass `XP_RULES.X.points`
 * into here so they never drift apart.
 */
export function XpBadge({ points, variant = "inline", className }: XpBadgeProps) {
  const isProm = variant === "prominent";
  return (
    <span
      aria-label={`Earn ${points} XP`}
      className={cn(
        "inline-flex shrink-0 select-none items-center gap-1 rounded-full font-semibold leading-none text-amber-200",
        "border border-amber-400/40 bg-gradient-to-br from-amber-500/20 via-yellow-500/15 to-amber-500/20",
        "shadow-[0_0_10px_-4px_rgba(251,191,36,0.55)]",
        isProm ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]",
        className,
      )}
    >
      <Sparkles
        aria-hidden
        className={cn(isProm ? "h-3.5 w-3.5" : "h-3 w-3", "text-amber-300")}
      />
      +{points} XP
    </span>
  );
}
