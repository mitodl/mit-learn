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

const toArray = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value
  }
  if (typeof value === "string") {
    return [value]
  }
  return value
}

const removeUndefined = <T extends Record<string, unknown>>(
  obj: T,
): Partial<T> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined),
  ) as Partial<T>
}

type SearchParams = {
  searchParams: URLSearchParams
  requestParams: UseResourceSearchParamsResult["params"] //LRSearchRequest //
  constantSearchParams?: Facets & BooleanFacets
  resourceCategory?: ResourceCategoryEnum
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
  return {
    ...constantSearchParams,
    yearly_decay_percent: searchParams.get("yearly_decay_percent"),
    search_mode: searchParams.get("search_mode"),
    slop: searchParams.get("slop"),
    min_score: searchParams.get("min_score"),
    max_incompleteness_penalty: searchParams.get("max_incompleteness_penalty"),
    content_file_score_weight: searchParams.get("content_file_score_weight"),
    ...removeUndefined({
      ...requestParams,
      topic: toArray(requestParams.topic),
      certification_type: toArray(requestParams.certification_type),
    }),
    resource_category: resourceCategory ? [resourceCategory] : null,
    aggregations: (facetNames || []).concat([
      "resource_category",
    ]) as LRSearchRequest["aggregations"],
    offset: (page - 1) * pageSize,
    limit: pageSize,
  }
}

export default getSearchParams
