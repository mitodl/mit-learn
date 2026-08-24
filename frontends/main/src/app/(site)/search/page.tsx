import type { AppPageProps } from "@/common/searchParams"
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

  const urlParams = new URLSearchParams(
    Object.entries(search).flatMap(([key, value]) =>
      Array.isArray(value)
        ? value.map((v) => [key, v])
        : [[key, String(value)]],
    ),
  )

  const params = getSearchParams({
    requestParams: validateRequestParams(search),
    constantSearchParams: {},
    facetNames: [
      ...(defaultFacetNames ?? []),
      ...(getExtraFacetNames(urlParams) ?? []),
    ] as typeof defaultFacetNames,
    page: Number(search.page ?? 1),
  })

  const queryClient = getQueryClient()
  const isVectorSearch = urlParams.get("vector_search") === "true"
  const hasSearchTerm = typeof params.q === "string" && params.q.trim() !== ""

  if (isVectorSearch) {
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
