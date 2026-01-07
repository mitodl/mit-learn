import React from "react"
import { Metadata } from "next"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import type { JSONContent } from "@tiptap/core"
import { articleQueries } from "api/hooks/articles"
import { standardizeMetadata } from "@/common/metadata"
import { ArticleDetailPage } from "@/app-pages/Articles/ArticleDetailPage"
import { getQueryClient } from "@/app/getQueryClient"
import { learningResourceQueries } from "api/hooks/learningResources"

const extractLearningResourceIds = (
  node: JSONContent | null | undefined,
): number[] => {
  const ids: number[] = []

  if (!node || typeof node !== "object") {
    return ids
  }

  if (node.type === "learningResource" && node.attrs?.resourceId) {
    const resourceId = node.attrs.resourceId
    if (typeof resourceId === "number") {
      ids.push(resourceId)
    }
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      ids.push(...extractLearningResourceIds(child))
    }
  }

  return ids
}

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

  await Promise.all(
    learningResourceIds.map((id) =>
      queryClient.prefetchQuery(learningResourceQueries.detail(id)),
    ),
  )

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
