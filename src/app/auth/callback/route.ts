import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sendWelcomeEmail } from "@/lib/email";
import { upsertParent, upsertProfile } from "@/lib/supabase/queries";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login", origin));
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[Auth Callback] exchangeCodeForSession error:", exchangeError);
    const failUrl = new URL("/auth/login", origin);
    failUrl.searchParams.set("error", exchangeError.message);
    return NextResponse.redirect(failUrl);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Parent";

    const { data: parent, error: parentError } = await upsertParent(supabase, {
      auth_user_id: user.id,
      email: user.email ?? "",
      display_name: displayName,
    });

    if (parentError) {
      console.error("[Auth Callback] upsertParent error:", parentError);
    } else if (parent) {
      const slugBase = displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) || "creator";
      const slug = `${slugBase}-${user.id.slice(0, 6)}`;

      const { error: profileError } = await upsertProfile(supabase, {
        parent_id: parent.id,
        display_name: displayName,
        slug,
        avatar_url: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/thumbs/svg?seed=${user.id}`,
        is_active: true,
      });

      if (profileError) {
        console.error("[Auth Callback] upsertProfile error:", profileError);
      }

      await sendWelcomeEmail(user.email!, displayName).catch((err) =>
        console.error("[Auth Callback] Welcome email error:", err),
      );
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
