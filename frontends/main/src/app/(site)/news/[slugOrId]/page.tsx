import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { websiteContentQueries } from "api/hooks/website_content/queries"
import { WebsiteContentDetail } from "@/app-pages/WebsiteContent/WebsiteContentDetail"
import { getQueryClient } from "@/app/getQueryClient"
import { learningResourceQueries } from "api/hooks/learningResources"
import { extractLearningResourceIds } from "@/page-components/TiptapEditor/extensions/utils"
import { safeGenerateMetadata, standardizeMetadata } from "@/common/metadata"
import {
  extractImageMetadata,
  extractWebsiteContentDescription,
} from "@/common/website_content"
import { notFound } from "next/navigation"

export const generateMetadata = async (
  props: PageProps<"/news/[slugOrId]">,
) => {
  const params = await props.params

  const { slugOrId } = await params

  const queryClient = getQueryClient()

  return safeGenerateMetadata(async () => {
    const content = await queryClient.fetchQuery(
      websiteContentQueries.websiteContentDetailRetrieve(slugOrId),
    )
    if (content.content_type !== "news") {
      return notFound()
    }

    const description = extractWebsiteContentDescription(content)
    const leadImage = extractImageMetadata(content)

    return standardizeMetadata({
      title: content.title,
      description,
      image: leadImage?.src,
      imageAlt: leadImage?.alt,
    })
  })
}

const Page: React.FC<PageProps<"/news/[slugOrId]">> = async (props) => {
  const { slugOrId } = await props.params

  const queryClient = getQueryClient()

  await queryClient.fetchQueryOr404(
    websiteContentQueries.websiteContentDetailRetrieve(slugOrId),
  )

  const queryKey =
    websiteContentQueries.websiteContentDetailRetrieve(slugOrId).queryKey
  const content = queryClient.getQueryData(queryKey)
  if (!content || content.content_type !== "news") {
    return notFound()
  }

  const learningResourceIds = extractLearningResourceIds(content.content)

  if (learningResourceIds.length > 0) {
    const bulkQuery = learningResourceQueries.list({
      resource_id: learningResourceIds,
    })
    await queryClient.prefetchQuery(bulkQuery)
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WebsiteContentDetail
        contentId={slugOrId}
        learningResourceIds={learningResourceIds}
      />
    </HydrationBoundary>
  )
}
export default Page
