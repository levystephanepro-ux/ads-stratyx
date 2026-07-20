// Auth middleware — Supabase session (si configuré) ou fail-open (dev/démo).
// Routes publiques : login, register, pricing, auth callbacks, MCP, cron, webhook Stripe.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

Offre limitée — Du <strong>28/04/2026</strong> au <strong>13/06/2026</strong><br>
  "/", // landing page publique (match exact uniquement, voir test ci-dessous)
  "/login",
  "/register",
  "/pricing",
  "/auth", // callback confirmation email Supabase
  "/api/auth",
  "/api/mcp",
  "/api/cron",
  "/api/stripe/webhook",
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase non configuré → fail-open (mode démo / dev)
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

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

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "non authentifié" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
