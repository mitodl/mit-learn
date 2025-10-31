import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { NewArticlePage } from "@/app-pages/ArticlePage/NewArticlePage"

export const metadata: Metadata = standardizeMetadata({
  title: "New Article",
})

const Page: React.FC = () => {
  return <NewArticlePage />
}

export default Page
