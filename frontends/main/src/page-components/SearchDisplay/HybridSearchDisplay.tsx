import React, { useMemo } from "react"
import { learningResourceQueries } from "api/hooks/learningResources"
import type { LearningResource } from "api"
import type { Facets, BooleanFacets } from "@mitodl/course-search-utils"
import type {
  LearningResourcesVectorSearchResponse,
  VectorLearningResourcesSearchApiVectorLearningResourcesSearchRetrieveRequest as VectorSearchRequest,
} from "api/v0"
import getSearchParams from "./getSearchParams"
import SearchDisplay, { SearchDisplayProps } from "./SearchDisplay"

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
const toVectorSearchParams = (
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

const VECTOR_CLIENT_FILTER_FACETS = [
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

const toUnfacetedVectorSearchParams = (
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

const normalizeParamValues = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(String)
  }
  if (value === null || value === undefined || value === "") {
    return []
  }
  return [String(value)]
}

const getResourceFacetValues = (
  resource: LearningResource,
  facet: string,
): string[] => {
  switch (facet) {
    case "certification_type":
      return normalizeParamValues(
        "certification_type" in resource
          ? resource.certification_type?.code
          : undefined,
      )
    case "delivery":
      return normalizeParamValues(
        "delivery" in resource ? resource.delivery?.map((d) => d.code) : [],
      )
    case "department":
      return normalizeParamValues(
        resource.departments?.map((d) => d.department_id),
      )
    case "offered_by":
      return normalizeParamValues(resource.offered_by?.code)
    case "topic":
      return normalizeParamValues(resource.topics?.map((t) => t.name))
    case "platform":
      return normalizeParamValues(
        "platform" in resource ? resource.platform?.code : undefined,
      )
    case "level":
      // Level is aggregated from run levels, matching the OpenSearch facet.
      return normalizeParamValues(
        "runs" in resource
          ? resource.runs?.flatMap((run) => run.level.map((l) => l.code))
          : [],
      )
    case "course_feature":
      return normalizeParamValues(
        "course_feature" in resource ? resource.course_feature : [],
      )
    case "free":
    case "professional":
    case "resource_type":
    case "resource_category":
    case "resource_type_group":
      return normalizeParamValues(resource[facet])
    default:
      return []
  }
}

const matchesVectorClientFilters = (
  resource: LearningResource,
  params: ReturnType<typeof getSearchParams>,
  excludedFacet?: string,
) =>
  VECTOR_CLIENT_FILTER_FACETS.every((facet) => {
    if (facet === excludedFacet) {
      return true
    }
    const selectedValues = normalizeParamValues(params[facet])
    if (selectedValues.length === 0) {
      return true
    }
    const resourceValues = getResourceFacetValues(resource, facet)
    return selectedValues.some((value) => resourceValues.includes(value))
  })

const hasVectorClientFilters = (params: ReturnType<typeof getSearchParams>) =>
  VECTOR_CLIENT_FILTER_FACETS.some(
    (facet) => normalizeParamValues(params[facet]).length > 0,
  )

const getVectorClientAggregations = (
  allResults: LearningResource[],
  params: ReturnType<typeof getSearchParams>,
  aggregationNames: string[],
) => {
  return Object.fromEntries(
    aggregationNames.map((name) => {
      const resultsForFacet = allResults.filter((resource) =>
        matchesVectorClientFilters(resource, params, name),
      )
      const counts = new Map<string, number>()
      for (const resource of resultsForFacet) {
        for (const value of getResourceFacetValues(resource, name)) {
          counts.set(value, (counts.get(value) ?? 0) + 1)
        }
      }
      return [
        name,
        Array.from(counts.entries())
          .map(([key, docCount]) => ({ key, doc_count: docCount }))
          .sort(
            (a, b) => b.doc_count - a.doc_count || a.key.localeCompare(b.key),
          ),
      ]
    }),
  )
}

type HybridSearchDisplayProps = SearchDisplayProps & {
  cutoffScore?: number
}

const HybridSearchDisplay: React.FC<HybridSearchDisplayProps> = ({
  cutoffScore,
  setSearchParams,
  ...props
}) => {
  const isVectorQuerySearch =
    typeof props.requestParams.q === "string" &&
    props.requestParams.q.trim() !== ""

  const getQueryOptions = useMemo(
    () => (params: ReturnType<typeof getSearchParams>) => {
      const hasSearchTerm =
        typeof params.q === "string" && params.q.trim() !== ""
      return learningResourceQueries.vectorSearch(
        hasSearchTerm
          ? toUnfacetedVectorSearchParams(
              params,
              props.constantSearchParams,
              cutoffScore,
            )
          : toVectorSearchParams(params, cutoffScore),
      )
    },
    [cutoffScore, props.constantSearchParams],
  )

  const getDisplayData = useMemo(
    () =>
      (
        data:
          | LearningResourcesVectorSearchResponse
          | Parameters<NonNullable<SearchDisplayProps["getDisplayData"]>>[0],
        params: ReturnType<typeof getSearchParams>,
      ) => {
        const vectorData = data as
          | LearningResourcesVectorSearchResponse
          | undefined
        const isVectorQuerySearch =
          typeof params.q === "string" && params.q.trim() !== ""
        if (!isVectorQuerySearch || !vectorData) {
          return vectorData
        }

        const allResults = vectorData.results ?? []
        const results = allResults.filter((resource) =>
          matchesVectorClientFilters(resource, params),
        )
        const hasClientFilters = hasVectorClientFilters(params)

        return {
          ...vectorData,
          count: hasClientFilters ? results.length : vectorData.count,
          next: null,
          previous: null,
          results,
          metadata: {
            ...vectorData.metadata,
            aggregations: hasClientFilters
              ? getVectorClientAggregations(
                  allResults,
                  params,
                  params.aggregations,
                )
              : vectorData.metadata.aggregations,
          },
        }
      },
    [],
  )

  return (
    <SearchDisplay
      {...props}
      setSearchParams={setSearchParams}
      getQueryOptions={getQueryOptions}
      getDisplayData={getDisplayData}
      hidePagination={isVectorQuerySearch}
    />
  )
}

export default HybridSearchDisplay
