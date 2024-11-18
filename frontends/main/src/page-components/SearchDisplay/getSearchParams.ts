import {
  LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as LRSearchRequest,
  ResourceCategoryEnum,
  LearningResourcesSearchRetrieveAggregationsEnum,
  LearningResourcesSearchRetrieveCertificationTypeEnum,
  LearningResourcesSearchRetrieveDeliveryEnum,
  LearningResourcesSearchRetrieveDepartmentEnum,
  LearningResourcesSearchRetrieveLevelEnum,
  LearningResourcesSearchRetrieveOfferedByEnum,
  LearningResourcesSearchRetrievePlatformEnum,
  LearningResourcesSearchRetrieveResourceCategoryEnum,
  LearningResourcesSearchRetrieveResourceTypeEnum,
  LearningResourcesSearchRetrieveSearchModeEnum,
  LearningResourcesSearchRetrieveSortbyEnum,
} from "api"
import { UseResourceSearchParamsProps } from "@mitodl/course-search-utils"
import type {
  UseResourceSearchParamsResult,
  Facets,
  BooleanFacets,
} from "@mitodl/course-search-utils"

export const PAGE_SIZE = 20

const toArray = <T>(value?: string | string[]): T[] | undefined => {
  if (Array.isArray(value)) {
    return value as T[]
  }
  if (typeof value === "string") {
    return [value as T]
  }
  return value
}

const toBoolean = (value?: "true" | "false") => {
  return value === "true" ? true : value === "false" ? false : undefined
}

const removeUndefined = <T extends Record<string, unknown>>(
  obj: T,
): Partial<T> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined),
  ) as Partial<T>
}

export type RequestSearchParams = {
  readonly aggregations?:
    | LearningResourcesSearchRetrieveAggregationsEnum
    | Array<LearningResourcesSearchRetrieveAggregationsEnum>
  readonly certification?: "true" | "false" | undefined
  readonly certification_type?:
    | LearningResourcesSearchRetrieveCertificationTypeEnum
    | Array<LearningResourcesSearchRetrieveCertificationTypeEnum>
  readonly content_file_score_weight?: number | null
  readonly course_feature?: Array<string>
  readonly delivery?:
    | LearningResourcesSearchRetrieveDeliveryEnum
    | Array<LearningResourcesSearchRetrieveDeliveryEnum>
  readonly department?:
    | LearningResourcesSearchRetrieveDepartmentEnum
    | Array<LearningResourcesSearchRetrieveDepartmentEnum>
  readonly dev_mode?: "true" | "false" | undefined
  readonly free?: "true" | "false" | undefined
  readonly id?: Array<number>
  readonly level?:
    | LearningResourcesSearchRetrieveLevelEnum
    | Array<LearningResourcesSearchRetrieveLevelEnum>
  readonly limit?: number
  readonly max_incompleteness_penalty?: number | null
  readonly min_score?: number | null
  readonly ocw_topic?: Array<string>
  readonly offered_by?:
    | LearningResourcesSearchRetrieveOfferedByEnum
    | Array<LearningResourcesSearchRetrieveOfferedByEnum>
  readonly offset?: number
  readonly platform?:
    | LearningResourcesSearchRetrievePlatformEnum
    | Array<LearningResourcesSearchRetrievePlatformEnum>
  readonly professional?: "true" | "false" | undefined
  readonly q?: string
  readonly resource_category?:
    | LearningResourcesSearchRetrieveResourceCategoryEnum
    | Array<LearningResourcesSearchRetrieveResourceCategoryEnum>
  readonly resource_type?:
    | LearningResourcesSearchRetrieveResourceTypeEnum
    | Array<LearningResourcesSearchRetrieveResourceTypeEnum>
  readonly search_mode?: LearningResourcesSearchRetrieveSearchModeEnum
  readonly slop?: number | null
  readonly sortby?: LearningResourcesSearchRetrieveSortbyEnum
  readonly topic?: Array<string>
  readonly yearly_decay_percent?: number | null
  page?: "string"
}

/* Maps URLSearchParams on the page URL to request params
 * for useLearningResourcesSearch, converting string boolean
 * values to boolean, single parameter array values to [string]
 * and removing undefined values that would cause a query key
 * mismatch and invalidate the SSR prefetch.
 */
export const getRequestParams = (
  searchParams: RequestSearchParams,
): UseResourceSearchParamsResult["params"] => {
  return removeUndefined({
    ...searchParams!,
    aggregations: toArray<LearningResourcesSearchRetrieveAggregationsEnum>(
      searchParams.aggregations,
    ),
    certification: toBoolean(searchParams!.certification),
    certification_type:
      toArray<LearningResourcesSearchRetrieveCertificationTypeEnum>(
        searchParams.certification_type,
      ),
    course_feature: toArray<string>(searchParams.course_feature),
    delivery: toArray<LearningResourcesSearchRetrieveDeliveryEnum>(
      searchParams.delivery,
    ),
    department: toArray<LearningResourcesSearchRetrieveDepartmentEnum>(
      searchParams.department,
    ),
    dev_mode: toBoolean(searchParams!.dev_mode),
    free: toBoolean(searchParams!.free),
    level: toArray<LearningResourcesSearchRetrieveLevelEnum>(
      searchParams.level,
    ),
    ocw_topic: toArray(searchParams.ocw_topic),
    offered_by: toArray<LearningResourcesSearchRetrieveOfferedByEnum>(
      searchParams.offered_by,
    ),
    platform: toArray<LearningResourcesSearchRetrievePlatformEnum>(
      searchParams.platform,
    ),
    professional: toBoolean(searchParams!.professional),
    resource_category:
      toArray<LearningResourcesSearchRetrieveResourceCategoryEnum>(
        searchParams.resource_category,
      ),
    resource_type: toArray<LearningResourcesSearchRetrieveResourceTypeEnum>(
      searchParams.resource_type,
    ),
  })
}

type SearchParams = {
  searchParams?: URLSearchParams
  requestParams: UseResourceSearchParamsResult["params"] //LRSearchRequest //
  constantSearchParams?: Facets & BooleanFacets
  resourceCategory?: ResourceCategoryEnum
  facetNames: UseResourceSearchParamsProps["facets"]
  page: number
  pageSize?: number
}

const getSearchParams = ({
  searchParams = new URLSearchParams({}),
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
    resource_category: resourceCategory ? [resourceCategory] : null,
    aggregations: (facetNames || []).concat([
      "resource_category",
    ]) as LRSearchRequest["aggregations"],
    ...requestParams,
    offset: (Number(page) - 1) * pageSize,
    limit: pageSize,
  }
}

export default getSearchParams
