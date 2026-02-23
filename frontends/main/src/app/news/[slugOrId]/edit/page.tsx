import React from "react"
import { ArticleEditPage } from "@/app-pages/Articles/ArticleEditPage"

const Page: React.FC<PageProps<"/news/[slugOrId]/edit">> = async (props) => {
  const { slugOrId } = await props.params

  return <ArticleEditPage articleId={slugOrId} />
}
export default Page
