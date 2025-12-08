import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { ArticleDetailPage } from "@/app-pages/Articles/ArticleDetailPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Article Detail",
})

const Page: React.FC<PageProps<"/articles/[slugOrId]">> = async (props) => {
  const { slugOrId } = await props.params
  const isNumericId = /^\d+$/.test(slugOrId)

  return <ArticleDetailPage isId={isNumericId} articleId={slugOrId} />
}
export default Page
