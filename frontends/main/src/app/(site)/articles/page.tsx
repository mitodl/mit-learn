import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { ArticleListingPage } from "@/app-pages/Articles/ArticleListingPage"

export const metadata: Metadata = standardizeMetadata({
  title: "MIT Learn | Articles",
  robots: "noindex, nofollow",
})

const Page: React.FC<AppPageProps<"/articles">> = () => {
  return <ArticleListingPage />
}

export default Page
