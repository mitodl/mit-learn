import React from "react"
import { standardizeMetadata } from "@/common/metadata"
import { UserArticleDetailPage } from "@/app-pages/UserArticles/UserArticleDetailPage"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { Permission } from "api/hooks/user"

export const generateMetadata = async () => {
  return standardizeMetadata({
    title: "Draft Article",
  })
}

const Page: React.FC<PageProps<"/articles/[slugOrId]/draft">> = async (
  props,
) => {
  const { slugOrId } = await props.params

  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <UserArticleDetailPage articleId={slugOrId} learningResourceIds={[]} />
    </RestrictedRoute>
  )
}

export default Page
