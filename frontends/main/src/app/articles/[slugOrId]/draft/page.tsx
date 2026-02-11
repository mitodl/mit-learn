import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { ArticleDetailPage } from "@/app-pages/Articles/ArticleDetailPage"
import { getQueryClient } from "@/app/getQueryClient"
import { standardizeMetadata } from "@/common/metadata"

export const generateMetadata = async () => {
  return standardizeMetadata({
    title: "Draft Article",
  })
}

const Page: React.FC<PageProps<"/articles/[slugOrId]/draft">> = async (
  props,
) => {
  const { slugOrId } = await props.params

  const queryClient = getQueryClient()

  // No prefetching for draft articles - the client-side component
  // will fetch with user authentication

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ArticleDetailPage articleId={slugOrId} learningResourceIds={[]} />
    </HydrationBoundary>
  )
}
export default Page
