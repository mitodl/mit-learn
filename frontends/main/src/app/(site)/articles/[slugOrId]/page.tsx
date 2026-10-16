import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { websiteContentQueries } from "api/hooks/website_content/queries"
import { WebsiteContentDetail } from "@/app-pages/WebsiteContent/WebsiteContentDetail"
import { getQueryClient } from "@/app/getQueryClient"
import { learningResourceQueries } from "api/hooks/learningResources"
import { extractLearningResourceIds } from "@/page-components/TiptapEditor/extensions/utils"
import { safeGenerateMetadata, getMetadataAsync } from "@/common/metadata"
import {
  extractImageMetadata,
  websiteContentSeo,
} from "@/common/website_content"
import { notFound } from "next/navigation"

export const generateMetadata = async (
  props: AppPageProps<"/articles/[slugOrId]">,
) => {
  const params = await props.params
  const { slugOrId } = params

  const queryClient = getQueryClient()

  return safeGenerateMetadata(async () => {
    const content = await queryClient.fetchQuery(
      websiteContentQueries.websiteContentDetailRetrieve(slugOrId),
    )
    if (content.content_type !== "article") {
      return notFound()
    }

    /* Resolved by the API: the editor's SEO override where set, otherwise the
       title and the banner subheading. */
    const { title, description } = websiteContentSeo(content)
    const leadImage = extractImageMetadata(content)

    return getMetadataAsync({
      title,
      description,
      image: leadImage?.src,
      imageAlt: leadImage?.alt,
      searchParams: props.searchParams,
    })
  })
}

const Page: React.FC<AppPageProps<"/articles/[slugOrId]">> = async (props) => {
  const { slugOrId } = await props.params

  const queryClient = getQueryClient()

  await queryClient.fetchQueryOr404(
    websiteContentQueries.websiteContentDetailRetrieve(slugOrId),
  )

  const queryKey =
    websiteContentQueries.websiteContentDetailRetrieve(slugOrId).queryKey
  const content = queryClient.getQueryData(queryKey)
  if (!content || content.content_type !== "article") {
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
