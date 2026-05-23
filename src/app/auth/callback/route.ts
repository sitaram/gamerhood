import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { bootstrapAccount } from "@/lib/auth/bootstrap";

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
    await bootstrapAccount(supabase, user);
  }

  return NextResponse.redirect(new URL(next, origin));
}
