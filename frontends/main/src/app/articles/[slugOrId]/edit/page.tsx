import React from "react"
import { UserArticleEditPage } from "@/app-pages/UserArticles/UserArticleEditPage"

const Page: React.FC<PageProps<"/articles/[slugOrId]/edit">> = async (
  props,
) => {
  const { slugOrId } = await props.params

  return <UserArticleEditPage articleId={slugOrId} />
}

export default Page
