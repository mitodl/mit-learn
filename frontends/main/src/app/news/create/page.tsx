import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { ArticleNewPage } from "@/app-pages/Articles/ArticleNewPage"

export const metadata: Metadata = standardizeMetadata({
  title: "MIT Learn| New",
  robots: "noindex, nofollow",
})

const Page: React.FC<PageProps<"/news/create">> = () => {
  return <ArticleNewPage />
}

export default Page
