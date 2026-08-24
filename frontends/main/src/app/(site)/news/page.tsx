import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { NewsListingPage } from "@/app-pages/News/NewsListingPage"

export const metadata: Metadata = standardizeMetadata({
  title: "MIT Learn | News",
  robots: "noindex, nofollow",
})

const Page: React.FC<AppPageProps<"/news">> = () => {
  return <NewsListingPage />
}

export default Page
