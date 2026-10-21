import type {
  AppPageProps,
  RegisteredSearchParams,
} from "@/common/searchParams"
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
import {
  asRedesignedChannelType,
  featuredParams,
} from "@/app-pages/ChannelPage/topicFeatured"
import { testimonialsQueries } from "api/hooks/testimonials"
import getSearchParams from "@/page-components/SearchDisplay/getSearchParams"
import {
  TOPIC_TABS,
  findActiveTab,
} from "@/page-components/SearchDisplay/tabConfigs"
import validateRequestParams from "@/page-components/SearchDisplay/validateRequestParams"
import {
  getConstantSearchParams,
  getFacets,
} from "@/app-pages/ChannelPage/searchRequests"
import { isInEnum } from "@/common/utils"
import { notFound } from "next/navigation"
import { getQueryClient } from "@/app/getQueryClient"
import { isHybridSearchEnabled } from "@/common/hybridSearch"
import {
  getVectorScoreTuning,
  toUnfacetedVectorSearchParams,
  toVectorSearchParams,
} from "@/page-components/SearchDisplay/vectorSearchParams"

export async function generateMetadata({
  searchParams,
  params,
}: AppPageProps<"/c/[channelType]/[name]">) {
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

const Page: React.FC<AppPageProps<"/c/[channelType]/[name]">> = async ({
  params,
  searchParams,
}) => {
  const { name, channelType } = await params
  if (!isInEnum(channelType, ChannelTypeEnum)) {
    notFound()
  }

  const search = await searchParams

  const queryClient = getQueryClient()
  /* Which of the redesigned pages this is, if it is one of them -- the
     Featured row and the tabs' default both turn on the answer. */
  const redesignedChannelType = asRedesignedChannelType(channelType)

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
    /**
     * The topic hero is drawn differently with no Featured row to carry, so
     * the answer has to be in hand for the first paint: without it the hero
     * renders as though there were a row, then reframes when the row turns
     * out not to exist.
     *
     * Not conditional on the redesign flag, which a server component cannot
     * read. The row is the redesign's, so this is a request the old topic and
     * department pages have no use for.
     */
    redesignedChannelType &&
      queryClient.prefetchQuery(
        channelQueries.featured(featuredParams(redesignedChannelType, name)),
      ),
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

  // RegisteredSearchParams keeps named reads on this copy within the
  // cache-key whitelist; a bare URLSearchParams would accept any name.
  const urlParams: RegisteredSearchParams = new URLSearchParams(
    Object.entries(search).flatMap(([key, value]) =>
      Array.isArray(value)
        ? value.map((v) => [key, v])
        : [[key, String(value)]],
    ),
  )

  const { facetNames } = getFacets(
    channelType,
    offerors as unknown as Record<string, LearningResourceOfferorDetail>,
    constantSearchParams,
    null,
    urlParams,
  )

  // @ts-expect-error -- this will error until mitodl/mit-learn-api-axios is updated
  const requestParams: Parameters<typeof getSearchParams>[0]["requestParams"] =
    validateRequestParams(search)
  const searchRequest = getSearchParams({
    requestParams,
    constantSearchParams,
    facetNames,
    page: Number(search.page ?? 1),
  })

  // Server components cannot read PostHog flags, so this resolves the URL
  // override and the env kill switch only. Setting
  // NEXT_PUBLIC_DISABLE_HYBRID_SEARCH alongside the PostHog flag is what keeps
  // this prefetch on the same endpoint the client will query.
  const isHybridSearch = isHybridSearchEnabled(urlParams)
  // The admin score tuning params are part of the request, so the prefetch
  // must include them or the client would refetch on hydration.
  const scoreTuning = getVectorScoreTuning(urlParams)

  const prefetchSearch = (request: typeof searchRequest) => {
    const hasSearchTerm =
      typeof request.q === "string" && request.q.trim() !== ""
    if (isHybridSearch) {
      return queryClient.prefetchQuery(
        learningResourceQueries.vectorSearch(
          hasSearchTerm
            ? toUnfacetedVectorSearchParams(
                request,
                constantSearchParams,
                scoreTuning,
              )
            : toVectorSearchParams(request, scoreTuning),
        ),
      )
    }
    return queryClient.prefetchQuery(
      learningResourceQueries.search(request as LRSearchRequest),
    )
  }

  /**
   * A redesigned page opens on courses and programs, so a bare URL to one
   * searches for those where every other page searches everything. Which page
   * the client draws is a PostHog flag the server cannot read, so both are
   * prefetched until the flag is gone -- either way the first render is the
   * server's rather than a second request.
   *
   * Every channel type the redesign covers, not the topic alone: they draw
   * the same tabs, so a bare URL to any of them opens on the same groups, and
   * a type left out here is a page that discards what was prefetched for it
   * and asks again.
   */
  const redesignDefaultGroups =
    redesignedChannelType && !search.resource_type_group
      ? findActiveTab(TOPIC_TABS, []).resource_type_groups
      : []

  await Promise.all([
    prefetchSearch(searchRequest),
    redesignDefaultGroups.length > 0 &&
      prefetchSearch(
        getSearchParams({
          requestParams,
          constantSearchParams,
          resourceTypeGroups: redesignDefaultGroups,
          facetNames,
          page: Number(search.page ?? 1),
        }),
      ),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChannelPage />
    </HydrationBoundary>
  )
}

export default Page
