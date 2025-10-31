import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { ArticleDetailPage } from "@/app-pages/Articles/ArticleDetailPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Article Detail",
})

interface PageProps {
  params: {
    id: number
  }
}

const Page: React.FC<PageProps> = ({ params }) => {
  return <ArticleDetailPage articleId={params.id} />
}

export default Page
