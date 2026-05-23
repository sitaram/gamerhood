import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeSlugInput, MAX_STORE_SLUG_LEN } from "@/lib/slug-utils";

// Renamed from middleware.ts in Next 16; the function is now `proxy`.
// /create is intentionally public — anonymous users get N free generations
// (gated client-side via localStorage counter; see lib/anon-designs.ts)
const PROTECTED_ROUTES = ["/dashboard"];

/**
 * Force lowercase hyphen-separated URL segments for `/shop/[slug]` and any `/a/b` path
 * (browse pages, auth, dashboard, product detail, etc.).
 */
function canonicalSlugPathRedirect(request: NextRequest): NextResponse | null {
  const url = request.nextUrl;
  const pathname = url.pathname;
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  // Static files under `public/` (e.g. `/brand/logo-nav.png`) — never slug-rewrite.
  if (last.includes(".")) return null;
  // Next.js internals (`/_next/image`, `/_next/data/…`) and API routes never get slug-normalized —
  // otherwise the leading underscore is stripped and the request 308-redirects into a 404.
  const first = parts[0] ?? "";
  if (first.startsWith("_") || first === "api") return null;

  if (parts[0] === "shop" && parts.length === 2) {
    const seg = sanitizeSlugInput(parts[1], MAX_STORE_SLUG_LEN);
    if (!seg) return null;
    const nextPath = `/shop/${seg}`;
    if (pathname !== nextPath) {
      const target = new URL(url);
      target.pathname = nextPath;
      return NextResponse.redirect(target, 308);
    }
    return null;
  }

  if (parts.length === 2) {
    const a = sanitizeSlugInput(parts[0], 48);
    const b = sanitizeSlugInput(parts[1], 48);
    if (!a || !b) return null;
    const nextPath = `/${a}/${b}`;
    if (pathname !== nextPath) {
      const target = new URL(url);
      target.pathname = nextPath;
      return NextResponse.redirect(target, 308);
    }
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const slugRedirect = canonicalSlugPathRedirect(request);
  if (slugRedirect) return slugRedirect;

  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_ROUTES.some((r) => request.nextUrl.pathname.startsWith(r));

  if (isProtected && !user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (request.nextUrl.pathname.startsWith("/auth/") && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/auth/:path*",
    "/shop/:path*",
    "/:seg1/:seg2",
  ],
};
