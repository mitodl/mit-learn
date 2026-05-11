import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { ArticleListingPage } from "@/app-pages/Articles/ArticleListingPage"

export const metadata: Metadata = standardizeMetadata({
  title: "MIT Learn | News",
  robots: "noindex, nofollow",
})

const Page: React.FC<PageProps<"/news">> = () => {
  return <ArticleListingPage />
}

export default Page
