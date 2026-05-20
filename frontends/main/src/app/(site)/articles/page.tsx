import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { UserArticleListingPage } from "@/app-pages/UserArticles/UserArticleListingPage"

export const metadata: Metadata = standardizeMetadata({
  title: "MIT Learn | Articles",
  robots: "noindex, nofollow",
})

const Page: React.FC<PageProps<"/articles">> = () => {
  return <UserArticleListingPage />
}

export default Page
