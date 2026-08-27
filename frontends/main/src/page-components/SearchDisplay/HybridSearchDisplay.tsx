import React, { useMemo } from "react"
import {
  learningResourceQueries,
  useOfferorsList,
} from "api/hooks/learningResources"
import type { LearningResource } from "api"
import type { LearningResourcesVectorSearchResponse } from "api/v0"
import getSearchParams from "./getSearchParams"
import SearchDisplay, { SearchDisplayProps } from "./SearchDisplay"
import {
  VECTOR_CLIENT_FILTER_FACETS,
  toUnfacetedVectorSearchParams,
  toVectorSearchParams,
} from "./vectorSearchParams"

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
  displayOfferorCodes: string[],
) => {
  return Object.fromEntries(
    aggregationNames.map((name) => {
      const resultsForFacet = allResults.filter((resource) =>
        matchesVectorClientFilters(resource, params, name),
      )
      const counts = new Map<string, number>()
      for (const resource of resultsForFacet) {
        for (const value of getResourceFacetValues(resource, name)) {
          // only show offerors with display_facet set, matching SearchDisplay
          if (name === "offered_by" && !displayOfferorCodes.includes(value)) {
            continue
          }
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

  const offerorsQuery = useOfferorsList()
  const displayOfferorCodes = useMemo(
    () =>
      (offerorsQuery.data?.results ?? [])
        .filter((offeror) => offeror.code && offeror.display_facet)
        .map((offeror) => offeror.code),
    [offerorsQuery.data?.results],
  )

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
                  displayOfferorCodes,
                )
              : vectorData.metadata.aggregations,
          },
        }
      },
    [displayOfferorCodes],
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
