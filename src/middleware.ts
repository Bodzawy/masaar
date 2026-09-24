import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { routeAccess, homeForRole } from "@/lib/routing";
import { isTrainerHost } from "@/lib/trainer/host";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The standalone trainer host never exposes the Masaar app or its login.
  if (isTrainerHost(req.headers.get("host"))) {
    return NextResponse.rewrite(new URL("/trainer", req.url));
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  // Auth pages redirect signed-in users to their workspace.
  if ((pathname === "/signin" || pathname === "/signup") && session) {
    return NextResponse.redirect(new URL(homeForRole(session.role), req.url));
  }

  const access = routeAccess(pathname, session?.role);
  if (access.kind === "redirect" && access.to) {
    const url = new URL(access.to, req.url);
    if (!session && access.to === "/signin") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Students must complete onboarding before entering the workspace.
  if (
    session &&
    session.onboarded === false &&
    pathname.startsWith("/student")
  ) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  return NextResponse.next();
}

// Node.js-Runtime: Middleware nutzt nur jose + Cookies und benötigt keine Edge-APIs.
export const config = {
  runtime: "nodejs",
  matcher: ["/student/:path*", "/teacher/:path*", "/admin/:path*", "/signin", "/signup"],
};
