import { cn } from "@/lib/utils";
import { getTierForXp, tierClasses } from "@/lib/xp/tiers";

type TierBadgeSize = "sm" | "md" | "lg";

interface TierBadgeProps {
  xp: number;
  size?: TierBadgeSize;
  /** When true (default), renders the tier name beside the icon. */
  showLabel?: boolean;
  /** When true, also shows `(N XP)` to the right of the label. */
  showXp?: boolean;
  className?: string;
}

const SIZE_PILL: Record<TierBadgeSize, string> = {
  sm: "px-2 py-0.5 text-[11px] gap-1",
  md: "px-2.5 py-1 text-xs gap-1.5",
  lg: "px-3 py-1.5 text-sm gap-2",
};

const SIZE_ICON: Record<TierBadgeSize, string> = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
};

/**
 * Replaces the old `<Star /> Level N` chip. Renders the named tier
 * (Sprout / Spark / Adventurer / …) with its lucide icon and accent
 * color. Used everywhere a creator's rank surfaces — storefront
 * header, dashboard, creator spotlight, etc. — so the look is
 * consistent.
 */
export function TierBadge({
  xp,
  size = "md",
  showLabel = true,
  showXp = false,
  className,
}: TierBadgeProps) {
  const tier = getTierForXp(xp);
  const classes = tierClasses(tier.accent);
  const Icon = tier.Icon;

  return (
    <span
      aria-label={`${tier.label} tier${showXp ? ` — ${xp} XP` : ""}`}
      className={cn(
        "inline-flex items-center rounded-full font-semibold leading-none ring-1",
        SIZE_PILL[size],
        classes.bg,
        classes.text,
        classes.ring,
        className,
      )}
    >
      <Icon aria-hidden className={cn(SIZE_ICON[size])} />
      {showLabel && <span>{tier.label}</span>}
      {showXp && (
        <span className="text-current/70 font-medium opacity-80">
          · {xp} XP
        </span>
      )}
    </span>
  );
}
