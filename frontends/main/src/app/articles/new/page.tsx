import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { NewArticlePage } from "@/app-pages/Articles/NewArticlePage"

export const metadata: Metadata = standardizeMetadata({
  title: "New Article",
  robots: "noindex, nofollow",
})

const Page: React.FC<PageProps<"/articles/new">> = () => {
  return <NewArticlePage />
}

export default Page
