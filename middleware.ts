import { NextResponse, type NextRequest } from "next/server";

// HTTP Basic auth for /admin. Username is ignored; password = ADMIN_PASSWORD.
export function middleware(req: NextRequest) {
  const pass = process.env.ADMIN_PASSWORD;
  const auth = req.headers.get("authorization");
  if (pass && auth?.startsWith("Basic ")) {
    const [, given] = atob(auth.slice(6)).split(":");
    if (given === pass) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="wingfoil-admin"' },
  });
}

export const config = { matcher: ["/admin/:path*"] };
