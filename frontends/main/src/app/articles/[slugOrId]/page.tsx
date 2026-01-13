import React from "react"
import { Metadata } from "next"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import type { JSONContent } from "@tiptap/core"
import { articleQueries } from "api/hooks/articles"
import { standardizeMetadata } from "@/common/metadata"
import { ArticleDetailPage } from "@/app-pages/Articles/ArticleDetailPage"
import { getQueryClient } from "@/app/getQueryClient"
import { learningResourceQueries } from "api/hooks/learningResources"
import { extractLearningResourceIds } from "@/page-components/TiptapEditor/extensions/utils"

export const metadata: Metadata = standardizeMetadata({
  title: "Article Detail",
})

const Page: React.FC<PageProps<"/articles/[slugOrId]">> = async (props) => {
  const { slugOrId } = await props.params

  const queryClient = getQueryClient()

  await queryClient.prefetchQuery(
    articleQueries.articlesDetailRetrieve(slugOrId),
  )

  const queryKey = articleQueries.articlesDetailRetrieve(slugOrId).queryKey
  const cacheData = queryClient.getQueryData(queryKey)

  const learningResourceIds = cacheData?.content
    ? extractLearningResourceIds(cacheData.content)
    : []

  if (learningResourceIds.length > 0) {
    const bulkQuery = learningResourceQueries.list({
      resource_id: learningResourceIds,
    })
    await queryClient.prefetchQuery(bulkQuery)
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ArticleDetailPage
        articleId={slugOrId}
        learningResourceIds={learningResourceIds}
      />
    </HydrationBoundary>
  )
}
export default Page
