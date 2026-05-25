"use client";

import { toast } from "sonner";

/**
 * Wire format returned by every endpoint that calls `awardXp` on the
 * server. The client doesn't import the server-side `XpAwardResult`
 * directly because it'd pull `getServiceClient` into the bundle.
 */
export interface XpToastPayload {
  ruleKey: string;
  label: string;
  points: number;
  newXp: number;
  tieredUp: boolean;
  tierLabel: string;
  tierKey: string;
}

/**
 * Pop one celebratory toast per awarded rule. Safe to call with an
 * empty / undefined array (no-op) so callers can do:
 *
 *     const data = await res.json();
 *     showXpToasts(data.xpAwards);
 *
 * without first checking whether the endpoint awarded anything.
 *
 * The `Tier up!` toast is shown ABOVE the points toast when a tier
 * threshold was crossed, so the order in the toaster reads "Tier up!"
 * then "+200 XP" — celebration first, math second.
 */
export function showXpToasts(awards: XpToastPayload[] | undefined | null): void {
  if (!awards || awards.length === 0) return;

  let promotion: XpToastPayload | null = null;
  for (const a of awards) {
    if (!a || a.points <= 0) continue;
    toast.success(`+${a.points} XP — ${a.label}`, {
      description: `${a.newXp} XP total`,
    });
    if (a.tieredUp) promotion = a;
  }

  if (promotion) {
    toast.success(`Tier up! You're now ${promotion.tierLabel}`, {
      description: "Keep going to unlock the next rank.",
      duration: 6000,
    });
  }
}
