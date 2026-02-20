import React from "react"
import ChannelPage from "@/app-pages/ChannelPage/ChannelPage"
import { ChannelTypeEnum } from "api/v0"
import {
  FeaturedListOfferedByEnum,
  LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as LRSearchRequest,
  PaginatedLearningResourceOfferorDetailList,
  LearningResourceOfferorDetail,
} from "api"
import { getMetadataAsync, safeGenerateMetadata } from "@/common/metadata"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
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
import { getQueryClient } from "@/app/getQueryClient"

export async function generateMetadata({
  searchParams,
  params,
}: PageProps<"/c/[channelType]/[name]">) {
  const { channelType, name } = await params

  return safeGenerateMetadata(async () => {
    const queryClient = getQueryClient()

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

  const queryClient = getQueryClient()

  const channel = await queryClient.fetchQueryOr404(
    channelQueries.detailByType(channelType, name),
  )

  await Promise.all([
    queryClient.prefetchQuery(offerorQueries.list({})),
    channelType === ChannelTypeEnum.Unit &&
      queryClient.prefetchQuery(
        learningResourceQueries.featured({
          limit: 12,
          offered_by: [name as FeaturedListOfferedByEnum],
        }),
      ),
    channelType === ChannelTypeEnum.Unit &&
      queryClient.prefetchQuery(testimonialsQueries.list({ offerors: [name] })),
  ])

  const offerors =
    queryClient
      .getQueryData<PaginatedLearningResourceOfferorDetailList>(
        offerorQueries.list({}).queryKey,
      )
      ?.results.reduce(
        (memo, offeror) => ({
          ...memo,
          [offeror.code]: offeror,
        }),
        [],
      ) ?? {}

  const constantSearchParams = getConstantSearchParams(channel.search_filter)

  const { facetNames } = getFacets(
    channelType,
    offerors as unknown as Record<string, LearningResourceOfferorDetail>,
    constantSearchParams,
    null,
  )

  const searchRequest = getSearchParams({
    // @ts-expect-error -- this will error until mitodl/mit-learn-api-axios is updated
    requestParams: validateRequestParams(search),
    constantSearchParams,
    facetNames,
    page: Number(search.page ?? 1),
  })

  await queryClient.prefetchQuery(
    learningResourceQueries.search(searchRequest as LRSearchRequest),
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChannelPage />
    </HydrationBoundary>
  )
}

export default Page
