import React from "react"
import { HydrationBoundary } from "@tanstack/react-query"
import { prefetch } from "api/ssr/prefetch"
import {
  learningResourceQueries,
  offerorQueries,
} from "api/hooks/learningResources"
import type { PageParams } from "@/app/types"
import { getMetadataAsync } from "@/common/metadata"
import SearchPage from "@/app-pages/SearchPage/SearchPage"
import { facetNames } from "@/app-pages/SearchPage/searchRequests"
import getSearchParams from "@/page-components/SearchDisplay/getSearchParams"
import validateRequestParams from "@/page-components/SearchDisplay/validateRequestParams"
import type { ResourceSearchRequest } from "@/page-components/SearchDisplay/validateRequestParams"
import { LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as LRSearchRequest } from "api"

export async function generateMetadata({ searchParams }: PageParams) {
  return await getMetadataAsync({
    title: "Search",
    searchParams,
  })
}

/**
 * The search page uses Next's `useSearchParams`. This requires either:
 *  1. wrap the <SearchPage /> in Suspense
 *  2. or force-dynamic.
 *
 * (1) caused a hydration error for authenticated users. We have not found
 * the root cause of the hydration error.
 *
 * (2) seems to work well.
 */
export const dynamic = "force-dynamic"

const Page: React.FC = async ({
  searchParams,
}: PageParams<ResourceSearchRequest & { page?: string }>) => {
  const search = await searchParams

  const params = getSearchParams({
    requestParams: validateRequestParams(search!),
    constantSearchParams: {},
    facetNames,
    page: Number(search!.page ?? 1),
  })

  const { dehydratedState } = await prefetch([
    offerorQueries.list({}),
    learningResourceQueries.search(params as LRSearchRequest),
  ])

  return (
    <HydrationBoundary state={dehydratedState}>
      <SearchPage />
    </HydrationBoundary>
  )
}

export default Page
