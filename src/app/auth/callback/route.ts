import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sendWelcomeEmail } from "@/lib/email";
import { upsertProfile } from "@/lib/supabase/queries";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
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

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (!error) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const name = user.user_metadata?.full_name || "Creator";
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);

      await upsertProfile(supabase, {
        parent_id: user.id,
        display_name: name,
        slug: `${slug}-${user.id.slice(0, 6)}`,
        avatar_url: `https://api.dicebear.com/7.x/thumbs/svg?seed=${user.id}`,
      });

      await sendWelcomeEmail(user.email!, name).catch((err) =>
        console.error("[Auth Callback] Welcome email error:", err),
      );
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
