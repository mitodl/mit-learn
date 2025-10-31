import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { ArticlesPage } from "@/app-pages/Articles/ArticlesPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Article Detail",
})

interface PageProps {
  params: {
    id: number
  }
}

const Page: React.FC<PageProps> = ({ params }) => {
  return <ArticlesPage articleId={params.id} />
}

export default Page
