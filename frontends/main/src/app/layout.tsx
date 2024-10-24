import React from "react"
import Header from "@/page-components/Header/Header"
import Footer from "@/page-components/Footer/Footer"
import { PageWrapper, PageWrapperInner } from "./styled"
import Providers from "./providers"
import { MITLearnGlobalStyles } from "ol-components"
import Script from "next/script"

import "./GlobalStyles"

const { NEXT_PUBLIC_ORIGIN } = process.env

/**
 * As part of the root layout, this metadata object is site-wide defaults
 */
export const metadata = {
  metadataBase: NEXT_PUBLIC_ORIGIN ? new URL(NEXT_PUBLIC_ORIGIN) : null,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <MITLearnGlobalStyles />
          <PageWrapper>
            <Header />
            <PageWrapperInner>{children}</PageWrapperInner>
            <Footer />
          </PageWrapper>
        </Providers>
      </body>
      {process.env.NEXT_PUBLIC_APPZI_URL ? (
        <Script async src={process.env.NEXT_PUBLIC_APPZI_URL} />
      ) : null}
    </html>
  )
}
