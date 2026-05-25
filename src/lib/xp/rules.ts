/**
 * Source of truth for creator XP rules. The dashboard "How to earn XP"
 * panel, the inline "+XX XP" hint badges, the celebratory toasts, and
 * the server-side award helper all read from this map — so retuning
 * point values is a one-line change.
 *
 * Add a new rule by:
 *   1. Appending a key + entry below.
 *   2. Calling `awardXp({ ruleKey: "MY_NEW_RULE", ... })` at the
 *      wire-up point.
 *   3. (Optional) extending the dashboard checklist if it's a
 *      one-shot rule the creator can "earn".
 *
 * One-shot rules are deduped on `ruleKey` alone. Repeatable rules
 * pass a per-entity dedupe suffix (typically `ruleKey:<entityId>`),
 * which makes "award once per product" trivial without bookkeeping
 * in product rows.
 */
export type XpRuleKey =
  | "SIGNUP_WELCOME"
  | "PROFILE_COMPLETE"
  | "AVATAR_CUSTOM"
  | "STOREFRONT_CREATED"
  | "STOREFRONT_AVATAR"
  | "STOREFRONT_BANNER_UPLOAD"
  | "STRIPE_CONNECTED"
  | "FIRST_PRODUCT_PUBLISHED"
  | "FIRST_SALE"
  | "PRODUCT_PUBLISHED"
  | "PRODUCT_DESCRIPTION"
  | "PRODUCT_TAGS";

export interface XpRule {
  key: XpRuleKey;
  /** XP awarded each time the rule fires. */
  points: number;
  /** When true, the rule only ever awards once per creator. */
  oneShot: boolean;
  /** Short label for the "How to earn XP" checklist. */
  label: string;
  /** One-sentence "what to do" copy under the label. */
  description: string;
}

export const XP_RULES: Record<XpRuleKey, XpRule> = {
  SIGNUP_WELCOME: {
    key: "SIGNUP_WELCOME",
    points: 25,
    oneShot: true,
    label: "Join Gamerhood",
    description: "Confirm your email to claim your starter XP.",
  },
  PROFILE_COMPLETE: {
    key: "PROFILE_COMPLETE",
    points: 50,
    oneShot: true,
    label: "Finish your profile",
    description: "Set a display name, catchphrase, and a profile photo.",
  },
  AVATAR_CUSTOM: {
    key: "AVATAR_CUSTOM",
    points: 25,
    oneShot: true,
    label: "Pick or upload an avatar",
    description: "Use the photo picker or design an axolotl in Account settings.",
  },
  STOREFRONT_CREATED: {
    key: "STOREFRONT_CREATED",
    points: 200,
    oneShot: true,
    label: "Launch your storefront",
    description: "Save your shop URL, headline, or bio for the first time.",
  },
  STOREFRONT_AVATAR: {
    key: "STOREFRONT_AVATAR",
    points: 50,
    oneShot: true,
    label: "Set a storefront photo",
    description: "Upload a dedicated photo for the public /shop page.",
  },
  STOREFRONT_BANNER_UPLOAD: {
    key: "STOREFRONT_BANNER_UPLOAD",
    points: 75,
    oneShot: true,
    label: "Upload a storefront banner",
    description: "Drop in a 16:5 banner to make your shop stand out.",
  },
  STRIPE_CONNECTED: {
    key: "STRIPE_CONNECTED",
    points: 200,
    oneShot: true,
    label: "Connect Stripe payouts",
    description: "Finish Stripe onboarding so we can pay you when you sell.",
  },
  FIRST_PRODUCT_PUBLISHED: {
    key: "FIRST_PRODUCT_PUBLISHED",
    points: 150,
    oneShot: true,
    label: "Publish your first product",
    description: "Take a design from Create → Publish to your shop.",
  },
  FIRST_SALE: {
    key: "FIRST_SALE",
    points: 500,
    oneShot: true,
    label: "Make your first sale",
    description: "A shopper completes checkout on one of your products.",
  },
  PRODUCT_PUBLISHED: {
    key: "PRODUCT_PUBLISHED",
    points: 25,
    oneShot: false,
    label: "Publish more products",
    description: "Earn XP every time you publish a new product to your shop.",
  },
  PRODUCT_DESCRIPTION: {
    key: "PRODUCT_DESCRIPTION",
    points: 10,
    oneShot: false,
    label: "Add product descriptions",
    description: "Write 20+ characters of shopper-facing copy on each listing.",
  },
  PRODUCT_TAGS: {
    key: "PRODUCT_TAGS",
    points: 10,
    oneShot: false,
    label: "Tag your products",
    description: "Add 3+ tags to help shoppers find your designs.",
  },
};

/** Min chars before `PRODUCT_DESCRIPTION` awards. */
export const PRODUCT_DESCRIPTION_MIN_CHARS = 20;
/** Min tag count before `PRODUCT_TAGS` awards. */
export const PRODUCT_TAGS_MIN_COUNT = 3;

/**
 * Rules surfaced as a checklist in the "How to earn XP" dashboard
 * panel — only the one-shot ones, since repeatable rules don't have
 * a meaningful "done" state.
 */
export const ONE_SHOT_RULE_KEYS: readonly XpRuleKey[] = (
  Object.values(XP_RULES) as XpRule[]
)
  .filter((r) => r.oneShot)
  .map((r) => r.key);

/**
 * Rules rendered as repeatable advertisements (still shown in the
 * panel so creators know they can grind XP on these).
 */
export const REPEATABLE_RULE_KEYS: readonly XpRuleKey[] = (
  Object.values(XP_RULES) as XpRule[]
)
  .filter((r) => !r.oneShot)
  .map((r) => r.key);
