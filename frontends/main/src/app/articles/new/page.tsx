import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { UserArticleNewPage } from "@/app-pages/UserArticles/UserArticleNewPage"

export const metadata: Metadata = standardizeMetadata({
  title: "MIT Learn | New Article",
  robots: "noindex, nofollow",
})

const Page: React.FC<PageProps<"/articles/new">> = () => {
  return <UserArticleNewPage />
}

export default Page
