import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { ArticleNewPage } from "@/app-pages/Articles/ArticleNewPage"

export const metadata: Metadata = standardizeMetadata({
  title: "New Article",
  robots: "noindex, nofollow",
})

const Page: React.FC<PageProps<"/articles/new">> = () => {
  return <ArticleNewPage />
}

export default Page
