import type { SupabaseClient, User } from "@supabase/supabase-js";
import { sendWelcomeEmail } from "@/lib/email";
import {
  upsertParent,
  upsertProfile,
  getParentByAuthUserId,
  ensureDefaultStorefront,
} from "@/lib/supabase/queries";
import { getServiceClient } from "@/lib/supabase/admin";
import { blockedSlugLanguageReason } from "@/lib/slug-content-policy";
import { sanitizeSlugInput, MAX_STORE_SLUG_LEN } from "@/lib/slug-utils";
import { awardXp } from "@/lib/xp/award";

export interface BootstrapOptions {
  /** Optional consent metadata captured at signup time. */
  consent?: {
    method: "credit_card" | "esign" | "id_verify";
  };
}

/**
 * Idempotently create the parent + default child profile rows for a freshly
 * signed-in user. Used by both the OAuth callback and the email signup flow.
 *
 * Safe to call repeatedly; existing rows are upserted and the welcome email
 * only goes out the first time.
 */
export async function bootstrapAccount(
  supabase: SupabaseClient,
  user: User,
  options: BootstrapOptions = {},
): Promise<{ ok: boolean; isNew: boolean; error?: string }> {
  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Parent";

  const { data: existingParent } = await getParentByAuthUserId(supabase, user.id);
  const isNew = !existingParent;

  const { data: parent, error: parentError } = await upsertParent(supabase, {
    auth_user_id: user.id,
    email: user.email ?? "",
    display_name: displayName,
    ...(options.consent
      ? {
          consent_method: options.consent.method,
          consent_verified_at: new Date().toISOString(),
        }
      : {}),
  });

  if (parentError || !parent) {
    console.error("[Bootstrap] upsertParent error:", parentError);
    return { ok: false, isNew, error: parentError?.message ?? "parent upsert failed" };
  }

  // Slug: "<name-slug>-<6 char user id prefix>" gives stability + uniqueness
  // without exposing the full uuid.
  const slugBase =
    sanitizeSlugInput(displayName, 24) || "creator";
  let slug = `${slugBase}-${user.id.slice(0, 6)}`;
  if (blockedSlugLanguageReason(slug)) {
    slug = `creator-${user.id.replace(/-/g, "").slice(0, 12)}`;
  }

  // Only seed `avatar_url` from an OAuth provider photo. When the user
  // signed up with email there's no photo, and we leave the column null
  // so `getDisplayAvatar()` picks one of the bundled axolotls on render
  // — that's stable per-id, kid-friendly, and lets the creator replace
  // it via /dashboard/settings whenever they want.
  const providerAvatar =
    typeof user.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url.trim()
      : "";

  const { data: profile, error: profileError } = await upsertProfile(supabase, {
    parent_id: parent.id,
    display_name: displayName,
    slug,
    ...(providerAvatar ? { avatar_url: providerAvatar } : {}),
    is_active: true,
  });

  if (profileError) {
    console.error("[Bootstrap] upsertProfile error:", profileError);
    return { ok: false, isNew, error: profileError.message };
  }

  // Every creator needs a row in `storefronts` to publish. The 029 backfill
  // only covered profiles that predated it, so provision one here for anyone
  // who signed up afterwards. Prefer the service client because the SSR
  // client's cookies may not be hydrated yet on the signup request.
  if (profile?.id) {
    let writer: SupabaseClient = supabase;
    try {
      writer = getServiceClient();
    } catch {
      // fall back to the user-scoped client; RLS lets owners insert.
    }
    await ensureDefaultStorefront(writer, profile).catch((err) =>
      console.error("[Bootstrap] ensureDefaultStorefront failed:", err),
    );
  }

  if (isNew && user.email) {
    await sendWelcomeEmail(user.email, displayName).catch((err) =>
      console.error("[Bootstrap] welcome email error:", err),
    );
  }

  // SIGNUP_WELCOME — idempotent on (profile_id, "SIGNUP_WELCOME") via the
  // unique index in 027, so safe to call on every bootstrap re-run.
  if (profile?.id) {
    await awardXp({
      profileId: profile.id,
      ruleKey: "SIGNUP_WELCOME",
      metadata: { auth_user_id: user.id, email: user.email ?? null },
    }).catch((err) =>
      console.error("[Bootstrap] SIGNUP_WELCOME award failed:", err),
    );
  }

  return { ok: true, isNew };
}
