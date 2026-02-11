import React from "react"
import { ArticleDetailPage } from "@/app-pages/Articles/ArticleDetailPage"
import { standardizeMetadata } from "@/common/metadata"
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

  // No prefetching for draft articles - the client-side component
  // will fetch with user authentication

  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <ArticleDetailPage articleId={slugOrId} learningResourceIds={[]} />
    </RestrictedRoute>
  )
}
export default Page
