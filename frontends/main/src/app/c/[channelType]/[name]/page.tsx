import React from "react"
import { AxiosError } from "axios"
import ChannelPage from "@/app-pages/ChannelPage/ChannelPage"
import { getServerQueryClient } from "api/ssr/serverQueryClient"
import { ChannelTypeEnum } from "api/v0"
import {
  FeaturedListOfferedByEnum,
  LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as LRSearchRequest,
  LearningResourceOfferorDetail,
} from "api"
import { getMetadataAsync, safeGenerateMetadata } from "@/common/metadata"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import {
  learningResourceQueries,
  offerorQueries,
} from "api/hooks/learningResources"
import { channelQueries } from "api/hooks/channels"
import { testimonialsQueries } from "api/hooks/testimonials"
import getSearchParams from "@/page-components/SearchDisplay/getSearchParams"
import validateRequestParams from "@/page-components/SearchDisplay/validateRequestParams"
import {
  getConstantSearchParams,
  getFacets,
} from "@/app-pages/ChannelPage/searchRequests"
import { isInEnum } from "@/common/utils"
import { notFound } from "next/navigation"

export async function generateMetadata({
  searchParams,
  params,
}: PageProps<"/c/[channelType]/[name]">) {
  const { channelType, name } = await params

  return safeGenerateMetadata(async () => {
    const queryClient = getServerQueryClient()

    const data = await queryClient.fetchQuery(
      channelQueries.detailByType(channelType, name),
    )

    return getMetadataAsync({
      searchParams,
      title: data.title,
      description: data.public_description,
    })
  })
}

const Page: React.FC<PageProps<"/c/[channelType]/[name]">> = async ({
  params,
  searchParams,
}) => {
  const { name, channelType } = await params
  if (!isInEnum(channelType, ChannelTypeEnum)) {
    notFound()
  }

  const search = await searchParams

  const queryClient = getServerQueryClient()

  queryClient.prefetchQuery(
    learningResourceQueries.featured({
      limit: 12,
      offered_by: [name as FeaturedListOfferedByEnum],
    }),
  )
  queryClient.prefetchQuery(testimonialsQueries.list({ offerors: [name] }))

  let channel
  try {
    channel = await queryClient.fetchQuery(
      channelQueries.detailByType(channelType, name),
    )
  } catch (error) {
    console.error("Error fetching channel", error)
    if (error instanceof AxiosError && error.status === 404) {
      notFound()
    }
    throw error
  }

  const offerors =
    (await queryClient.fetchQuery(offerorQueries.list({})))?.results.reduce(
      (memo, offeror) => ({
        ...memo,
        [offeror.code]: offeror,
      }),
      [],
    ) ?? {}

  const constantSearchParams = getConstantSearchParams(channel?.search_filter)

  const { facetNames } = getFacets(
    channelType,
    offerors as unknown as Record<string, LearningResourceOfferorDetail>,
    constantSearchParams,
    null,
  )

  const searchRequest = getSearchParams({
    // @ts-expect-error Local openapi client https://www.npmjs.com/package/@mitodl/open-api-axios
    // out of sync while we adding an enum value.
    requestParams: validateRequestParams(search),
    constantSearchParams,
    facetNames,
    page: Number(search.page ?? 1),
  })

  queryClient.prefetchQuery(
    learningResourceQueries.search(searchRequest as LRSearchRequest),
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChannelPage />
    </HydrationBoundary>
  )
}

export default Page
