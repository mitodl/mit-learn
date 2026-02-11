import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { ArticleDraftPage } from "@/app-pages/Articles/ArticleDraftListingPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Articles Draft",
  robots: "noindex, nofollow",
})

const Page: React.FC<PageProps<"/articles/draft">> = () => {
  return <ArticleDraftPage />
}

export default Page
