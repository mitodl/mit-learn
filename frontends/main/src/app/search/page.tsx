import React from "react"
import { Hydrate } from "@tanstack/react-query"
import { prefetch } from "api/ssr/prefetch"
import { learningResources } from "api/hooks/learningResources"
import type { PageParams } from "@/app/types"
import { getMetadataAsync } from "@/common/metadata"
import SearchPage from "@/app-pages/SearchPage/SearchPage"
import { facetNames } from "@/app-pages/SearchPage/searchRequests"
import getSearchParams from "@/page-components/SearchDisplay/getSearchParams"
import {
  LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as LRSearchRequest,
  ResourceCategoryEnum,
} from "api"

type SearchParams = Omit<LRSearchRequest, "free"> & {
  resource_category?: ResourceCategoryEnum
  free: "true" | "false"
}

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

const Page: React.FC = async ({ searchParams }: PageParams<SearchParams>) => {
  const requestParams = await searchParams

  const params = getSearchParams({
    searchParams: new URLSearchParams({}),
    requestParams: {
      ...requestParams!,
      free:
        requestParams!.free === "true"
          ? true
          : requestParams!.free === "false"
            ? false
            : undefined,
    },
    constantSearchParams: {},
    resourceCategory: requestParams!.resource_category,
    facetNames,
    page: 1,
  })

  const { dehydratedState } = await prefetch([
    learningResources.offerors({}),
    learningResources.search(params as LRSearchRequest),
  ])

  return (
    <Hydrate state={dehydratedState}>
      <SearchPage />
    </Hydrate>
  )
}

export default Page
