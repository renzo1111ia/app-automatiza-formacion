import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY } from "@/lib/auth-config";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 1. Guardia para Super Admin: Solo accessible para developer/super admin con app_metadata
  if (pathname.startsWith("/dashboard/super-admin")) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const isSuperAdmin =
      user.app_metadata?.is_super_admin === true ||
      user.app_metadata?.is_super_admin === "true" ||
      user.app_metadata?.is_admin === true ||
      user.app_metadata?.is_admin === "true" ||
      user.app_metadata?.admin === true ||
      user.app_metadata?.admin === "true";

    if (!isSuperAdmin) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // 2. Guardia general de autenticación para /dashboard
  if (pathname.startsWith("/dashboard")) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
