import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { UserArticleDraftPage } from "@/app-pages/UserArticles/UserArticleDraftListingPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Article Drafts",
  robots: "noindex, nofollow",
})

const Page: React.FC<PageProps<"/articles/draft">> = () => {
  return <UserArticleDraftPage />
}

export default Page
