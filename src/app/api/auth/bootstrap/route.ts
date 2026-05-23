import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bootstrapAccount } from "@/lib/auth/bootstrap";

/**
 * Idempotently provision the parent + child-profile rows for the
 * currently-authenticated user. Called from the email signup path (and
 * harmless to call from elsewhere). The OAuth flow calls bootstrapAccount
 * directly from /auth/callback.
 */
export async function POST(request: NextRequest) {
  let body: { consentMethod?: "credit_card" | "esign" | "id_verify" } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is allowed.
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await bootstrapAccount(supabase, user, {
    consent: body.consentMethod ? { method: body.consentMethod } : undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Bootstrap failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, isNew: result.isNew });
}
