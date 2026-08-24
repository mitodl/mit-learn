import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import TermsPage from "@/app-pages/TermsPage/TermsPage"
import type { AppPageProps } from "@/common/searchParams"

export const metadata: Metadata = standardizeMetadata({
  title: "Terms of Service",
})

const Page: React.FC<AppPageProps<"/terms">> = () => {
  return <TermsPage />
}

export default Page
