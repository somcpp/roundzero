import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSiteHost } from "@/lib/site";

// Reachable without signing in. Judge links (/j), public winners pages (/w)
// and submission forms (/f) are shared with people who don't have admin
// accounts; /api/intake checks its own API key or form token, and /api/cron
// Vercel's CRON_SECRET (cron requests don't follow the /login redirect). The
// docs and the landing page are public too (the landing page only on site
// hosts). The /components reference page is dev-only (it 404s in production).
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/docs",
  "/landing",
  "/j/",
  "/w/",
  "/f/",
  "/api/intake",
  "/api/cron",
  ...(process.env.NODE_ENV === "production" ? [] : ["/components"]),
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`));
}

// Refreshes the Supabase auth session, writes updated cookies to the response,
// and sends signed-out visitors to /login.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Don't run code between createServerClient and getClaims — it can cause
  // hard-to-debug random logouts.
  const { data } = await supabase.auth.getClaims();
  const { pathname, search } = request.nextUrl;
  const onSite = isSiteHost(request.headers.get("host"));

  // The landing page only exists on the RoundZero site (see lib/site.ts), where
  // it's "/" for signed-out visitors; signed-in ones get their dashboard. In
  // development /landing also opens directly, to preview it.
  if (pathname === "/landing" && !onSite && process.env.NODE_ENV === "production") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return redirectWithCookies(url, response);
  }
  if (onSite && pathname === "/" && !data?.claims) {
    const url = request.nextUrl.clone();
    url.pathname = "/landing";
    return rewriteWithCookies(url, request, response);
  }

  if (!data?.claims && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return redirectWithCookies(url, response);
  }

  if (data?.claims && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}

// Carry any refreshed session cookies over to the redirect.
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

function rewriteWithCookies(url: URL, request: NextRequest, from: NextResponse) {
  const rewrite = NextResponse.rewrite(url, { request });
  from.cookies.getAll().forEach((cookie) => rewrite.cookies.set(cookie));
  return rewrite;
}
