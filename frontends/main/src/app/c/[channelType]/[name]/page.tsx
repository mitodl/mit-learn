import React from "react"
import ChannelPage from "@/app-pages/ChannelPage/ChannelPage"
import { channelsApi } from "api/clients"
import { ChannelTypeEnum, UnitChannel } from "api/v0"
import {
  FeaturedListOfferedByEnum,
  LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as LRSearchRequest,
  PaginatedLearningResourceOfferorDetailList,
  LearningResourceOfferorDetail,
} from "api"
import { getMetadataAsync } from "@/common/metadata"
import { Hydrate } from "@tanstack/react-query"
import { prefetch } from "api/ssr/prefetch"
import { learningResources } from "api/hooks/learningResources"
import { channels } from "api/hooks/channels"
import { testimonials } from "api/hooks/testimonials"
import handleNotFound from "@/common/handleNotFound"
import type { PageParams } from "@/app/types"
import getSearchParams from "@/page-components/SearchDisplay/getSearchParams"
import type { ResourceSearchRequest } from "@/page-components/SearchDisplay/getSearchParams"
import validateRequestParams from "@/page-components/SearchDisplay/validateRequestParams"
import {
  getConstantSearchParams,
  getFacets,
} from "@/app-pages/ChannelPage/searchRequests"

type RouteParams = {
  channelType: ChannelTypeEnum
  name: FeaturedListOfferedByEnum
}

export async function generateMetadata({
  searchParams,
  params,
}: PageParams<{ [key: string]: string }, RouteParams>) {
  const { channelType, name } = await params!

  const { data } = await handleNotFound(
    channelsApi.channelsTypeRetrieve({ channel_type: channelType, name: name }),
  )

  return getMetadataAsync({
    searchParams,
    title: data.title,
    description: data.public_description,
  })
}

const Page: React.FC = async ({
  params,
  searchParams,
}: PageParams<ResourceSearchRequest & { page?: string }, RouteParams>) => {
  const { channelType, name } = await params!
  const search = await searchParams

  const { queryClient } = await prefetch([
    learningResources.offerors({}),
    channelType === ChannelTypeEnum.Unit &&
      learningResources.featured({
        limit: 12,
        offered_by: [name],
      }),
    channelType === ChannelTypeEnum.Unit &&
      testimonials.list({ offerors: [name] }),
    channels.detailByType(channelType, name),
  ])

  const channel = queryClient.getQueryData<UnitChannel>(
    channels.detailByType(channelType, name).queryKey,
  )
  const offerors = queryClient
    .getQueryData<PaginatedLearningResourceOfferorDetailList>(
      learningResources.offerors({}).queryKey,
    )!
    .results.reduce(
      (memo, offeror) => ({
        ...memo,
        [offeror.code]: offeror,
      }),
      [],
    )

  const constantSearchParams = getConstantSearchParams(channel?.search_filter)

  const { facetNames } = getFacets(
    channelType,
    offerors as unknown as Record<string, LearningResourceOfferorDetail>,
    constantSearchParams,
    null,
  )

  const searchRequest = getSearchParams({
    requestParams: validateRequestParams(search!),
    constantSearchParams,
    facetNames,
    page: Number(search!.page ?? 1),
  })

  const { dehydratedState } = await prefetch(
    [learningResources.search(searchRequest as LRSearchRequest)],
    queryClient,
  )
  return (
    <Hydrate state={dehydratedState}>
      <ChannelPage />
    </Hydrate>
  )
}

export default Page
