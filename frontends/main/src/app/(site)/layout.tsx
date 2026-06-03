import { env } from "@/env"
import React from "react"
import Script from "next/script"
import Header from "@/page-components/Header/Header"
import Footer from "@/page-components/Footer/Footer"
import { PageWrapper, PageWrapperInner } from "@/app/styled"
import { MITLearnGlobalStyles } from "ol-components"
import SiteProviders from "./SiteProviders"

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

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
    <>
      {gtmHeadScript ? (
        <Script id="google-tag-manager" strategy="afterInteractive">
          {gtmHeadScript}
        </Script>
      ) : null}
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
      <MITLearnGlobalStyles />
      <SiteProviders>
        <PageWrapper>
          <Header />
          <PageWrapperInner>{children}</PageWrapperInner>
          <Footer />
        </PageWrapper>
      </SiteProviders>
      {env("NEXT_PUBLIC_APPZI_URL") ? (
        <Script async src={env("NEXT_PUBLIC_APPZI_URL")} />
      ) : null}
      {env("NEXT_PUBLIC_HUBSPOT_PORTAL_ID") ? (
        <Script
          id="hs-script-loader"
          src={`https://js.hs-scripts.com/${env("NEXT_PUBLIC_HUBSPOT_PORTAL_ID")}.js`}
          strategy="afterInteractive"
        />
      ) : null}
    </>
  )
}
