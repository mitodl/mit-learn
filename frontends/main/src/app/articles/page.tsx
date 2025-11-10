import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { ArticlesPage } from "@/app-pages/Articles/ArticlesPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Articles",
})

const Page: React.FC<PageProps<"/articles">> = () => {
  return <ArticlesPage />
}

export default Page
