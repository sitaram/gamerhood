import { CheckCircle2, Circle, Sparkles, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TierBadge } from "@/components/xp/tier-badge";
import { TierProgress } from "@/components/xp/tier-progress";
import { XpBadge } from "@/components/xp/xp-badge";
import {
  ONE_SHOT_RULE_KEYS,
  REPEATABLE_RULE_KEYS,
  XP_RULES,
  type XpRuleKey,
} from "@/lib/xp/rules";
import { cn } from "@/lib/utils";

interface XpRewardsPanelProps {
  xp: number;
  earnedKeys: ReadonlySet<XpRuleKey>;
}

/**
 * "How to earn XP" checklist — server-rendered against the creator's
 * profile so completed one-shot rules show a green check on first
 * paint, no loading state. Repeatable rules live in their own section
 * so creators understand they can keep grinding them.
 */
export function XpRewardsPanel({ xp, earnedKeys }: XpRewardsPanelProps) {
  return (
    <Card className="overflow-hidden border-amber-400/30 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-amber-400/20 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40">
            <Trophy className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              How to earn XP
            </h2>
            <p className="text-xs text-muted-foreground">
              Knock these out to climb tiers and unlock bigger flexes.
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground/80">
              XP is shared across{" "}
              <span className="font-medium text-foreground">all your storefronts</span>{" "}
              — they all show the same tier badge.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <TierBadge xp={xp} size="lg" showXp />
        </div>
      </div>

      <div className="px-5 pt-4">
        <TierProgress xp={xp} />
      </div>

      <div className="grid gap-6 p-5 sm:grid-cols-2">
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden />
            One-time rewards
          </h3>
          <ul className="space-y-2">
            {ONE_SHOT_RULE_KEYS.map((key) => {
              const rule = XP_RULES[key];
              const earned = earnedKeys.has(key);
              return (
                <li
                  key={key}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    earned
                      ? "border-emerald-400/30 bg-emerald-500/5"
                      : "border-border/60 bg-background/40",
                  )}
                >
                  {earned ? (
                    <CheckCircle2
                      aria-label="Earned"
                      className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400"
                    />
                  ) : (
                    <Circle
                      aria-hidden
                      className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/40"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          earned && "text-emerald-100 line-through decoration-emerald-400/40",
                        )}
                      >
                        {rule.label}
                      </span>
                      <XpBadge points={rule.points} variant="inline" />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {rule.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden />
            Keep earning
          </h3>
          <ul className="space-y-2">
            {REPEATABLE_RULE_KEYS.map((key) => {
              const rule = XP_RULES[key];
              return (
                <li
                  key={key}
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
                >
                  <Sparkles
                    aria-hidden
                    className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{rule.label}</span>
                      <XpBadge points={rule.points} variant="inline" />
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        per item
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {rule.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </Card>
  );
}
