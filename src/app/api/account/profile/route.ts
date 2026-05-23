import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProfileForAuthUser,
  updateParentDisplayName,
  updateProfileById,
} from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

const MAX_DISPLAY_NAME_LEN = 80;

function validateDisplayName(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: "Display name is required" };
  }
  const value = raw.trim();
  if (!value) {
    return { ok: false, error: "Display name cannot be empty" };
  }
  if (value.length > MAX_DISPLAY_NAME_LEN) {
    return { ok: false, error: `Display name must be ${MAX_DISPLAY_NAME_LEN} characters or fewer` };
  }
  return { ok: true, value };
}

/**
 * PATCH — update signed-in user's display name across auth metadata,
 * parent row, and default creator profile.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = validateDisplayName(body.displayName);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { error: authError } = await supabase.auth.updateUser({
    data: { full_name: parsed.value },
  });
  if (authError) {
    console.error("[account/profile] updateUser error:", authError);
    return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
  }

  const { error: parentError } = await updateParentDisplayName(
    supabase,
    user.id,
    parsed.value,
  );
  if (parentError) {
    console.error("[account/profile] parent update error:", parentError);
    return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
  }

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
  if (profile) {
    const { error: profileError } = await updateProfileById(supabase, profile.id, {
      display_name: parsed.value,
    });
    if (profileError) {
      console.error("[account/profile] profile update error:", profileError);
      return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
    }
  }

  return NextResponse.json({ displayName: parsed.value });
}
