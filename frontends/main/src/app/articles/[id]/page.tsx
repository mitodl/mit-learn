import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { ArticleDetailPage } from "@/app-pages/Articles/ArticleDetailPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Article Detail",
})

const Page: React.FC<PageProps<"/articles/[id]">> = async (props) => {
  const params = await props.params

  return <ArticleDetailPage articleId={Number(params.id)} />
}
export default Page
