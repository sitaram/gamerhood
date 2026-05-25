import { getServiceClient } from "@/lib/supabase/admin";
import { XP_RULES, type XpRuleKey } from "@/lib/xp/rules";
import { getTierForXp, type Tier } from "@/lib/xp/tiers";

/**
 * Award result returned to API callers. The optional `tier` info lets
 * the client render a "Tier up!" toast without re-deriving anything
 * from XP totals.
 */
export interface XpAwardResult {
  ruleKey: XpRuleKey;
  label: string;
  points: number;
  awarded: boolean;
  prevXp: number;
  newXp: number;
  /** Numeric `profiles.level` snapshot (1..7). Kept for back-compat. */
  prevLevel: number;
  newLevel: number;
  tieredUp: boolean;
  prevTier: Tier;
  newTier: Tier;
}

interface AwardXpInput {
  /** Creator profile id (NOT auth.users.id). */
  profileId: string;
  ruleKey: XpRuleKey;
  /**
   * Per-entity dedupe suffix for repeatable rules
   * (e.g. `product:<id>`). One-shot rules ignore this and dedupe on
   * `ruleKey` alone.
   */
  dedupeSuffix?: string;
  metadata?: Record<string, unknown>;
}

interface AwardRpcRow {
  awarded: boolean;
  prev_xp: number;
  new_xp: number;
  prev_level: number;
  new_level: number;
}

/**
 * Atomic XP award via the `award_xp_event` RPC. Inserts the event
 * row (deduped) and increments `profiles.xp` / `profiles.level` in
 * a single round-trip. Idempotent — calling twice for the same
 * (profile, dedupe) returns `awarded: false` the second time.
 *
 * Always uses the service-role client so XP writes are never
 * blocked by RLS even when called from contexts (webhooks, etc.)
 * that don't have a user session.
 */
export async function awardXp({
  profileId,
  ruleKey,
  dedupeSuffix,
  metadata,
}: AwardXpInput): Promise<XpAwardResult> {
  const rule = XP_RULES[ruleKey];
  if (!rule) {
    throw new Error(`Unknown XP rule: ${ruleKey}`);
  }
  // One-shot rules dedupe on the rule key alone so the unique index
  // (profile_id, dedupe_key) blocks any second insert. Repeatable
  // rules expect the caller to make `dedupeSuffix` unique per entity.
  const dedupeKey = rule.oneShot
    ? rule.key
    : `${rule.key}:${dedupeSuffix ?? "anon"}`;

  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("award_xp_event", {
    p_profile_id: profileId,
    p_rule_key: rule.key,
    p_points: rule.points,
    p_dedupe_key: dedupeKey,
    p_metadata: metadata ?? null,
  });

  if (error) {
    console.error("[awardXp] RPC error", { ruleKey, profileId, error });
    // Soft-fail: XP is a "nice to have" — never block the caller's
    // primary action (publishing, signup, etc.) on a XP write hiccup.
    const fallbackTier = getTierForXp(0);
    return {
      ruleKey: rule.key,
      label: rule.label,
      points: 0,
      awarded: false,
      prevXp: 0,
      newXp: 0,
      prevLevel: 1,
      newLevel: 1,
      tieredUp: false,
      prevTier: fallbackTier,
      newTier: fallbackTier,
    };
  }

  // RPC returns a single-row table.
  const row: AwardRpcRow = Array.isArray(data) ? (data[0] as AwardRpcRow) : (data as AwardRpcRow);
  const prevTier = getTierForXp(row.prev_xp);
  const newTier = getTierForXp(row.new_xp);

  return {
    ruleKey: rule.key,
    label: rule.label,
    points: row.awarded ? rule.points : 0,
    awarded: row.awarded,
    prevXp: row.prev_xp,
    newXp: row.new_xp,
    prevLevel: row.prev_level,
    newLevel: row.new_level,
    tieredUp: row.awarded && prevTier.key !== newTier.key,
    prevTier,
    newTier,
  };
}

/** Awarded results worth surfacing to the client as a celebratory toast. */
export function pickXpToastPayload(
  results: XpAwardResult[],
): Array<{
  ruleKey: XpRuleKey;
  label: string;
  points: number;
  newXp: number;
  tieredUp: boolean;
  tierLabel: string;
  tierKey: Tier["key"];
}> {
  return results
    .filter((r) => r.awarded && r.points > 0)
    .map((r) => ({
      ruleKey: r.ruleKey,
      label: r.label,
      points: r.points,
      newXp: r.newXp,
      tieredUp: r.tieredUp,
      tierLabel: r.newTier.label,
      tierKey: r.newTier.key,
    }));
}

/** Convenience: list of one-shot rule keys the creator has already earned. */
export async function getEarnedOneShotRuleKeys(
  profileId: string,
): Promise<Set<XpRuleKey>> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("xp_events")
    .select("rule_key")
    .eq("profile_id", profileId);
  if (error || !data) return new Set();
  const out = new Set<XpRuleKey>();
  for (const row of data as { rule_key: string }[]) {
    if (row.rule_key in XP_RULES) out.add(row.rule_key as XpRuleKey);
  }
  return out;
}
