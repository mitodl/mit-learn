import type {
  AppPageProps,
  RegisteredSearchParams,
} from "@/common/searchParams"
import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import {
  learningResourceQueries,
  offerorQueries,
} from "api/hooks/learningResources"
import { getMetadataAsync, safeGenerateMetadata } from "@/common/metadata"
import SearchPage from "@/app-pages/SearchPage/SearchPage"
import {
  defaultFacetNames,
  getExtraFacetNames,
} from "@/app-pages/SearchPage/searchRequests"
import getSearchParams from "@/page-components/SearchDisplay/getSearchParams"
import {
  toUnfacetedVectorSearchParams,
  toVectorSearchParams,
} from "@/page-components/SearchDisplay/vectorSearchParams"
import validateRequestParams from "@/page-components/SearchDisplay/validateRequestParams"
import { LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as LRSearchRequest } from "api"
import { getQueryClient } from "@/app/getQueryClient"
import { isHybridSearchEnabled } from "@/common/hybridSearch"

export async function generateMetadata({
  searchParams,
}: AppPageProps<"/search">) {
  return safeGenerateMetadata(async () => {
    return getMetadataAsync({
      title: "Search",
      searchParams,
    })
  })
}

const Page: React.FC<AppPageProps<"/search">> = async ({ searchParams }) => {
  const search = await searchParams

  // RegisteredSearchParams keeps named reads on this copy within the
  // cache-key whitelist; a bare URLSearchParams would accept any name.
  const urlParams: RegisteredSearchParams = new URLSearchParams(
    Object.entries(search).flatMap(([key, value]) =>
      Array.isArray(value)
        ? value.map((v) => [key, v])
        : [[key, String(value)]],
    ),
  )

  const params = getSearchParams({
    // @ts-expect-error -- this will error until mitodl/mit-learn-api-axios is updated
    requestParams: validateRequestParams(search),
    constantSearchParams: {},
    facetNames: [
      ...(defaultFacetNames ?? []),
      ...(getExtraFacetNames(urlParams) ?? []),
    ] as typeof defaultFacetNames,
    page: Number(search.page ?? 1),
  })

  const queryClient = getQueryClient()
  // Server components cannot read PostHog flags, so this resolves the URL
  // override and the env kill switch only. Setting
  // NEXT_PUBLIC_DISABLE_HYBRID_SEARCH alongside the PostHog flag is what keeps
  // this prefetch on the same endpoint the client will query.
  const isHybridSearch = isHybridSearchEnabled(urlParams)
  const hasSearchTerm = typeof params.q === "string" && params.q.trim() !== ""

  if (isHybridSearch) {
    await Promise.all([
      queryClient.prefetchQuery(offerorQueries.list({})),
      queryClient.prefetchQuery(
        learningResourceQueries.vectorSearch(
          hasSearchTerm
            ? toUnfacetedVectorSearchParams(params)
            : toVectorSearchParams(params),
        ),
      ),
    ])
  } else {
    await Promise.all([
      queryClient.prefetchQuery(offerorQueries.list({})),
      queryClient.prefetchQuery(
        learningResourceQueries.search(params as LRSearchRequest),
      ),
    ])
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SearchPage />
    </HydrationBoundary>
  )
}

export default Page
