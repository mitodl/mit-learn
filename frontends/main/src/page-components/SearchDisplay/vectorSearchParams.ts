import type { Facets, BooleanFacets } from "@mitodl/course-search-utils"
import type { VectorLearningResourcesSearchApiVectorLearningResourcesSearchRetrieveRequest as VectorSearchRequest } from "api/v0"
import getSearchParams from "./getSearchParams"

const mapVectorSortby = (
  sortby?: string,
): VectorSearchRequest["sortby"] | undefined => {
  switch (sortby) {
    case "-views":
    case "popular":
      return "-views"
    case "upcoming":
      return "next_start_date"
    case "new":
      return "-created_on"
    default:
      return undefined
  }
}

/**
 * Extracts only the fields supported by the vector search API from a broader
 * search params object, dropping admin-only params (e.g., content_file_score_weight)
 * that the vector endpoint does not accept.
 *
 * The `as` casts for enum arrays are safe because the v0 and v1 generated
 * clients define separate (but structurally identical) enum types for the same
 * string-literal values (e.g., delivery: 'online' | 'hybrid' | ...).
 */
export const toVectorSearchParams = (
  params: ReturnType<typeof getSearchParams> & { sortby?: string },
  cutoffScore?: number,
): VectorSearchRequest => ({
  aggregations: params.aggregations as VectorSearchRequest["aggregations"],
  certification: params.certification,
  certification_type:
    params.certification_type as VectorSearchRequest["certification_type"],
  course_feature: params.course_feature,
  delivery: params.delivery as VectorSearchRequest["delivery"],
  department: params.department as VectorSearchRequest["department"],
  free: params.free,
  level: params.level as VectorSearchRequest["level"],
  limit: params.limit,
  ocw_topic: params.ocw_topic,
  offered_by: params.offered_by as VectorSearchRequest["offered_by"],
  offset: params.offset,
  platform: params.platform as VectorSearchRequest["platform"],
  professional: params.professional,
  q: params.q,
  resource_category:
    params.resource_category as VectorSearchRequest["resource_category"],
  resource_type: params.resource_type as VectorSearchRequest["resource_type"],
  resource_type_group:
    params.resource_type_group as VectorSearchRequest["resource_type_group"],
  score_cutoff: cutoffScore,
  sortby: mapVectorSortby(params.sortby),
  topic: params.topic,
  hybrid_search: true,
})

export const VECTOR_CLIENT_FILTER_FACETS = [
  "resource_type",
  "certification_type",
  "delivery",
  "department",
  "topic",
  "offered_by",
  "free",
  "professional",
  "resource_category",
  "resource_type_group",
  "level",
  "platform",
  "course_feature",
] as const

type VectorClientFilterFacet = (typeof VECTOR_CLIENT_FILTER_FACETS)[number]

export const toUnfacetedVectorSearchParams = (
  params: ReturnType<typeof getSearchParams> & { sortby?: string },
  constantSearchParams: Facets & BooleanFacets = {},
  cutoffScore?: number,
): VectorSearchRequest => {
  const {
    offset: _offset,
    limit: _limit,
    ...vectorParams
  } = toVectorSearchParams(params, cutoffScore)

  return Object.fromEntries(
    Object.entries(vectorParams).filter(
      ([key]) =>
        !VECTOR_CLIENT_FILTER_FACETS.includes(key as VectorClientFilterFacet) ||
        key in constantSearchParams,
    ),
  ) as VectorSearchRequest
}
