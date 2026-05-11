import React from "react"
import Header from "@/page-components/Header/Header"
import Footer from "@/page-components/Footer/Footer"
import { PageWrapper, PageWrapperInner } from "@/app/styled"
import { MITLearnGlobalStyles } from "ol-components"

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <MITLearnGlobalStyles />
      <PageWrapper>
        <Header />
        <PageWrapperInner>{children}</PageWrapperInner>
        <Footer />
      </PageWrapper>
    </>
  )
}
