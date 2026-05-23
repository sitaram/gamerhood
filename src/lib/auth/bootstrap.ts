import type { SupabaseClient, User } from "@supabase/supabase-js";
import { sendWelcomeEmail } from "@/lib/email";
import {
  upsertParent,
  upsertProfile,
  getParentByAuthUserId,
} from "@/lib/supabase/queries";
import { blockedSlugLanguageReason } from "@/lib/slug-content-policy";
import { sanitizeSlugInput, MAX_STORE_SLUG_LEN } from "@/lib/slug-utils";

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

  const { error: profileError } = await upsertProfile(supabase, {
    parent_id: parent.id,
    display_name: displayName,
    slug,
    avatar_url:
      user.user_metadata?.avatar_url ||
      `https://api.dicebear.com/7.x/thumbs/svg?seed=${user.id}`,
    is_active: true,
  });

  if (profileError) {
    console.error("[Bootstrap] upsertProfile error:", profileError);
    return { ok: false, isNew, error: profileError.message };
  }

  if (isNew && user.email) {
    await sendWelcomeEmail(user.email, displayName).catch((err) =>
      console.error("[Bootstrap] welcome email error:", err),
    );
  }

  return { ok: true, isNew };
}
