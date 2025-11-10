import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { ArticlesListPage } from "@/app-pages/Articles/ArticlesListPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Articles List",
})

const Page: React.FC<PageProps<"/articles/list">> = () => {
  return <ArticlesListPage />
}

export default Page
