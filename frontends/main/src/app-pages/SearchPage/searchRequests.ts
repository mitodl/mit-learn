import {
  BOOLEAN_FACET_NAMES,
  type Facets,
  type UseResourceSearchParamsProps,
} from "@mitodl/course-search-utils"
import { LearningResourcesSearchRetrieveAggregationsEnum } from "api"

export const defaultFacetNames = [
  "resource_type",
  "certification_type",
  "delivery",
  "department",
  "topic",
  "offered_by",
  "free",
  "resource_category",
] as UseResourceSearchParamsProps["facets"]

const NON_FACET_PARAMS = new Set<string>([
  ...BOOLEAN_FACET_NAMES,
  "resource_type_group",
])

const ALL_FACETS = Object.values(
  LearningResourcesSearchRetrieveAggregationsEnum,
).filter((name) => !NON_FACET_PARAMS.has(name)) as (keyof Facets)[]

export const getExtraFacetNames = (
  searchParams: URLSearchParams,
  baseFacetNames: UseResourceSearchParamsProps["facets"] = defaultFacetNames,
): UseResourceSearchParamsProps["facets"] => {
  const base = new Set<string>(baseFacetNames ?? [])
  const valid = new Set<string>(ALL_FACETS)
  const extra: string[] = []
  for (const key of searchParams.keys()) {
    if (valid.has(key) && !base.has(key) && !extra.includes(key)) {
      extra.push(key)
    }
  }
  return extra as UseResourceSearchParamsProps["facets"]
}
