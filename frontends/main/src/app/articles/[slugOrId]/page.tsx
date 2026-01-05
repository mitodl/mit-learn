import React from "react"
import { Metadata } from "next"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { articleQueries } from "api/hooks/articles"
import { standardizeMetadata } from "@/common/metadata"
import { ArticleDetailPage } from "@/app-pages/Articles/ArticleDetailPage"
import { getQueryClient } from "@/app/getQueryClient"

export const metadata: Metadata = standardizeMetadata({
  title: "Article Detail",
})

const Page: React.FC<PageProps<"/articles/[slugOrId]">> = async (props) => {
  const { slugOrId } = await props.params

  const queryClient = getQueryClient()

  await queryClient.prefetchQuery(
    articleQueries.articlesDetailRetrieve(slugOrId),
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ArticleDetailPage articleId={slugOrId} />
    </HydrationBoundary>
  )
}
export default Page
