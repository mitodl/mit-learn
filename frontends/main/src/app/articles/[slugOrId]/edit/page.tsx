import React from "react"
import { ArticleEditPage } from "@/app-pages/Articles/ArticleEditPage"

const Page: React.FC<PageProps<"/articles/[slugOrId]/edit">> = async (props) => {
  const { slugOrId } = await props.params
  const isNumericId = /^\d+$/.test(slugOrId)

  return <ArticleEditPage isId={isNumericId} articleId={slugOrId} />
}
export default Page
