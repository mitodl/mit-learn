import React from "react"
import Header from "@/page-components/Header/Header"
import Footer from "@/page-components/Footer/Footer"
import { PageWrapper, PageWrapperInner } from "./styled"
import Providers from "./providers"
import { MITLearnGlobalStyles } from "ol-components"
import Script from "next/script"

import "./GlobalStyles"

const NEXT_PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_ORIGIN

const getGtmConfig = () => {
  const trackingId = process.env.GTM_TRACKING_ID?.trim()
  const auth = process.env.GTM_AUTH?.trim()
  const preview = process.env.GTM_PREVIEW?.trim()
  const cookiesWin = process.env.GTM_COOKIES_WIN?.trim() || "x"

  if (!trackingId || !auth || !preview) {
    return null
  }

  return {
    trackingId,
    auth,
    preview,
    cookiesWin,
  }
}

const buildGtmUrlQuery = ({
  trackingId,
  auth,
  preview,
  cookiesWin,
}: {
  trackingId: string
  auth: string
  preview: string
  cookiesWin: string
}) => {
  const params = new URLSearchParams({
    id: trackingId,
    gtm_auth: auth,
    gtm_preview: preview,
    gtm_cookies_win: cookiesWin,
  })
  return params.toString()
}

/**
 * As part of the root layout, this metadata object is site-wide defaults
 */
export const metadata = {
  metadataBase: NEXT_PUBLIC_ORIGIN ? new URL(NEXT_PUBLIC_ORIGIN) : null,
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
  const gtmConfig = getGtmConfig()
  const gtmQuery = gtmConfig ? buildGtmUrlQuery(gtmConfig) : null
  const gtmHeadScript =
    gtmQuery !== null
      ? `(function(w,d,s,l,q){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!=='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?'+q+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer',${JSON.stringify(gtmQuery)});`
      : null

  return (
    <html lang="en">
      <head>
        {gtmHeadScript ? (
          <Script id="google-tag-manager" strategy="afterInteractive">
            {gtmHeadScript}
          </Script>
        ) : null}
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
          content={process.env.NEXT_PUBLIC_VERSION || "unknown"}
        />
      </head>
      <body>
        {gtmQuery ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?${gtmQuery}`}
              title="Google Tag Manager"
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        ) : null}
        <Providers>
          <MITLearnGlobalStyles />
          <PageWrapper>
            <Header />
            <PageWrapperInner>{children}</PageWrapperInner>
            <Footer />
          </PageWrapper>
        </Providers>
        {process.env.NEXT_PUBLIC_APPZI_URL ? (
          <Script async src={process.env.NEXT_PUBLIC_APPZI_URL} />
        ) : null}
        {process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID ? (
          <Script
            id="hs-script-loader"
            src={`https://js.hs-scripts.com/${process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID}.js`}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  )
}
