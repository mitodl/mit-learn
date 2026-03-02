import {
  LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as ResourceSearchRequest,
  ResourceTypeGroupEnum,
} from "api"
import { UseResourceSearchParamsProps } from "@mitodl/course-search-utils"
import type {
  UseResourceSearchParamsResult,
  Facets,
  BooleanFacets,
} from "@mitodl/course-search-utils"

export const PAGE_SIZE = 20

type SearchParams = {
  searchParams?: URLSearchParams
  requestParams: UseResourceSearchParamsResult["params"]
  constantSearchParams?: Facets & BooleanFacets
  resourceTypeGroup?: ResourceTypeGroupEnum
  facetNames: UseResourceSearchParamsProps["facets"]
  page: number
  pageSize?: number
}

const getSearchParams = ({
  searchParams = new URLSearchParams({}),
  requestParams,
  constantSearchParams = {},
  resourceTypeGroup,
  facetNames,
  page,
  pageSize = PAGE_SIZE,
}: SearchParams) => {
  return {
    ...constantSearchParams,
    yearly_decay_percent: searchParams.get("yearly_decay_percent"),
    search_mode: searchParams.get("search_mode"),
    slop: searchParams.get("slop"),
    min_score: searchParams.get("min_score"),
    max_incompleteness_penalty: searchParams.get("max_incompleteness_penalty"),
    content_file_score_weight: searchParams.get("content_file_score_weight"),
    resource_type_group: resourceTypeGroup ? [resourceTypeGroup] : null,
    aggregations: [...(facetNames || []), "resource_type_group"],
    ...requestParams,
    offset: (Number(page) - 1) * pageSize,
    limit: pageSize,
  }
}

export default getSearchParams

export type { ResourceSearchRequest }
