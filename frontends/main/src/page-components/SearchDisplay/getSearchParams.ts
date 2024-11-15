import {
  LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as LRSearchRequest,
  ResourceCategoryEnum,
} from "api"
import { UseResourceSearchParamsProps } from "@mitodl/course-search-utils"
import type {
  UseResourceSearchParamsResult,
  Facets,
  BooleanFacets,
} from "@mitodl/course-search-utils"

export const PAGE_SIZE = 20

type SearchParams = {
  searchParams: URLSearchParams
  requestParams: UseResourceSearchParamsResult["params"] //LRSearchRequest //
  constantSearchParams?: Facets & BooleanFacets
  resourceCategory: ResourceCategoryEnum | null
  facetNames: UseResourceSearchParamsProps["facets"]
  page: number
  pageSize?: number
}

const getSearchParams = ({
  searchParams,
  requestParams,
  constantSearchParams = {},
  resourceCategory,
  facetNames,
  page,
  pageSize = PAGE_SIZE,
}: SearchParams) => {
  console.log("SERACH PARAMS", {
    searchParams,
    requestParams,
    constantSearchParams,
    resourceCategory,
    facetNames,
    page,
    pageSize,
  })
  return {
    ...constantSearchParams,
    yearly_decay_percent: searchParams.get("yearly_decay_percent"),
    search_mode: searchParams.get("search_mode"),
    slop: searchParams.get("slop"),
    min_score: searchParams.get("min_score"),
    max_incompleteness_penalty: searchParams.get("max_incompleteness_penalty"),
    content_file_score_weight: searchParams.get("content_file_score_weight"),
    ...requestParams,
    resource_category: resourceCategory && [resourceCategory],
    aggregations: (facetNames || []).concat([
      "resource_category",
    ]) as LRSearchRequest["aggregations"],
    offset: (page - 1) * pageSize,
    limit: pageSize,
  }
}

export default getSearchParams
