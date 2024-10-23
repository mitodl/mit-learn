import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/* The CDNs handle SSL redirects, but this is intended to block content being served
 * over HTTP if directly addressed at their origin server domains.
 */
export function middleware(request: NextRequest) {
  const protocol = request.headers.get("x-forwarded-proto")
  const host = request.headers.get("host")

  if (
    protocol !== "https" &&
    process.env.NODE_ENV === "production" &&
    /* This is included so we can test the build locally with yarn build; yarn start;
     * without needing an additional APP_ENV variable (Next.js builds with NODE_ENV=production always).
     * We're typically using open.odl.local or just localhost.
     */
    !host?.includes("local")
  ) {
    const url = `https://${host}${request.nextUrl.pathname}${request.nextUrl.searchParams.toString() ? `?${request.nextUrl.searchParams}` : ""}`
    return NextResponse.redirect(url, 301)
  }

  return NextResponse.next()
}
