import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { NewArticlePage } from "@/app-pages/ArticlePage/NewArticlePage"

export const metadata: Metadata = standardizeMetadata({
  title: "New Article",
  robots: "noindex, nofollow",
})

const Page: React.FC<PageProps<"/article/new">> = () => {
  return <NewArticlePage />
}

export default Page
