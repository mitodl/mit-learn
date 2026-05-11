import React from "react"
import Header from "@/page-components/Header/Header"
import Footer from "@/page-components/Footer/Footer"
import { PageWrapper, PageWrapperInner } from "@/app/styled"
import { MITLearnGlobalStyles } from "ol-components"
import NotFoundPage from "@/app-pages/ErrorPage/NotFoundPage"

export const metadata = {
  title: "Not Found",
}

const Page: React.FC = () => {
  return (
    <>
      <MITLearnGlobalStyles />
      <PageWrapper>
        <Header />
        <PageWrapperInner>
          <NotFoundPage />
        </PageWrapperInner>
        <Footer />
      </PageWrapper>
    </>
  )
}

export default Page
