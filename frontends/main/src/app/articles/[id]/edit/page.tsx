import React from "react"
import { ArticleEditPage } from "@/app-pages/Articles/ArticleEditPage"

const Page: React.FC<PageProps<"/articles/[id]/edit">> = async (props) => {
  const params = await props.params

  return <ArticleEditPage articleId={params.id} />
}
export default Page
