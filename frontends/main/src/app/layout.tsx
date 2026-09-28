import React from "react"
import Providers from "./providers"
import { env, publicEnvObject } from "@/env"

import "./GlobalStyles"
import { Metadata } from "next"

const NEXT_PUBLIC_ORIGIN = env("NEXT_PUBLIC_ORIGIN")
const API_BASE_URL = env("NEXT_PUBLIC_MITOL_API_BASE_URL")

/**
 * Site-wide metadata defaults plus an x-public-env <meta> carrying all
 * NEXT_PUBLIC_* values as JSON, for runtime (not buildtime) env vars — see
 * src/env.ts. This is a secondary copy (PublicEnvInsertedHtml is primary):
 * a metadata export still reaches the document when the root layout render
 * itself fails, which no rendered component can guarantee.
 */
export const metadata: Metadata = {
  metadataBase: NEXT_PUBLIC_ORIGIN ? new URL(NEXT_PUBLIC_ORIGIN) : null,
  // raw JSON is fine: the attribute is HTML-escaped when rendered and
  // getAttribute() returns it decoded, so JSON.parse round-trips.
  other: { "x-public-env": JSON.stringify(publicEnvObject()) },
}

/**
 * Force all pages to render dynamically (at request-time) rather than
 * statically at build time. This simplifies the build, reduces build time, and
 * ensures fresh data on each request to the NextJS server.
 *
 * It does increase server load, but this should not be significant since
 * requests are cached on CDN.
 */
export const dynamic = "force-dynamic"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/*
          Warm the connections to origins whose first request happens far too
          late to open its own. On a production homepage load the first API
          call is not issued until React hydrates (~1.2s in) and then waits
          ~180ms for DNS + TCP + TLS, with every sibling API request stalled
          behind it. p.typekit.net is worse: it is not named in this document
          at all, so nothing can reach it until the stylesheet below has been
          downloaded and parsed.

          crossOrigin is not about the host being cross-origin. It selects
          which connection pool to open, and pools do not mix across CORS and
          credentials modes, so each hint has to match how its resource is
          actually fetched — and that mode follows the resource type, not
          whoever requested it. lbk1xay.css both @imports p.css and declares
          the @font-face rules for af/*, yet:

            use.typekit.net/lbk1xay.css   no-cors   (none - named below)
            p.typekit.net/p.css           no-cors   no attribute
            use.typekit.net/af/* fonts    cors      anonymous
            api.learn.mit.edu             cors      use-credentials

          So use.typekit.net needs its own entry even though the stylesheet
          below already talks to it — the font files cannot share that
          connection.

          One caveat: when the browser blocks third-party cookies, p.css
          lands in a partitioned pool that no crossOrigin value targets, so
          for those users that hint contributes the DNS lookup only.
        */}
        {API_BASE_URL ? (
          <link
            rel="preconnect"
            href={API_BASE_URL}
            crossOrigin="use-credentials"
          />
        ) : null}
        <link rel="preconnect" href="https://p.typekit.net" />
        <link
          rel="preconnect"
          href="https://use.typekit.net"
          crossOrigin="anonymous"
        />
        {/*
          Font files for Adobe neue haas grotesk.
          WARNING: This is linked to chudzick@mit.edu's Adobe account.
          We'd prefer a non-personal MIT account to be used.
          See https://github.com/mitodl/hq/issues/4237 for more.
        */}
        <link
          rel="stylesheet"
          href="https://use.typekit.net/lbk1xay.css"
        ></link>
        <meta
          name="application-version"
          content={env("NEXT_PUBLIC_VERSION") || "unknown"}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
