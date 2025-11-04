import React from "react"
import { HydrationBoundary } from "@tanstack/react-query"
import { prefetch } from "api/ssr/prefetch"
import {
  learningResourceQueries,
  offerorQueries,
} from "api/hooks/learningResources"
import { getMetadataAsync, safeGenerateMetadata } from "@/common/metadata"
import SearchPage from "@/app-pages/SearchPage/SearchPage"
import { facetNames } from "@/app-pages/SearchPage/searchRequests"
import getSearchParams from "@/page-components/SearchDisplay/getSearchParams"
import validateRequestParams from "@/page-components/SearchDisplay/validateRequestParams"
import type { ResourceSearchRequest } from "@/page-components/SearchDisplay/validateRequestParams"
import { LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as LRSearchRequest } from "api"

export async function generateMetadata({ searchParams }: PageProps<"/search">) {
  return safeGenerateMetadata(async () => {
    return getMetadataAsync({
      title: "Search",
      searchParams,
    })
  })
}

const Page: React.FC<PageProps<"/search">> = async ({ searchParams }) => {
  const search = (await searchParams) as ResourceSearchRequest & {
    page?: string
  }

  const params = getSearchParams({
    requestParams: validateRequestParams(search),
    constantSearchParams: {},
    facetNames,
    page: Number(search.page ?? 1),
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
