import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { ArticleListingPage } from "@/app-pages/Articles/ArticleListingPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Articles Listing",
  robots: "noindex, nofollow",
})

const Page: React.FC<PageProps<"/articles">> = () => {
  return <ArticleListingPage />
}

export default Page
