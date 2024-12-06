import { LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as LearningResourcesSearchRetrieveRequest } from "api"
import { resourceSearchValidators } from "@mitodl/course-search-utils"

type StringOrArray<T> = {
  [K in keyof T]: string | string[]
}

type ResourceSearchRequest =
  StringOrArray<LearningResourcesSearchRetrieveRequest>

/* Validates and transforms URLSearchParams on the page URL to request params
 * for useLearningResourcesSearch, converting string boolean
 * values to boolean, single parameter array values to [string]
 * and removing undefined values that would cause a query key
 * mismatch and invalidate the SSR prefetch.
 * Borrowing from @mitodl/course-search ./hooks/validation
 * but for use on the server.
 */
const validateRequestParams = (
  searchParams: ResourceSearchRequest,
): LearningResourcesSearchRetrieveRequest => {
  return Object.entries(resourceSearchValidators).reduce(
    (acc, [key, validator]) => {
      const paramKey = key as keyof LearningResourcesSearchRetrieveRequest

      if (searchParams[paramKey]) {
        const value = searchParams[paramKey] as string[]
        const validated = validator(toArray(value))

        return { ...acc, [paramKey]: validated }
      }

      return acc
    },
    {},
  )
}

/* Maps strings to [string] to handle Next.js' treatment
 * of repeated search parameters, ie.
 * ?key=value -> { key: "value" }
 * ?key=value1&key=value2 -> { key: ["value1", "value2"] }
 *
 * Search values in @mitodl/course-search are
 * expected to be arrays of strings
 */
const toArray = <T>(value?: string | string[]): T[] => {
  if (Array.isArray(value)) {
    return value as T[]
  }
  if (typeof value === "string") {
    return [value as T]
  }
  return value ?? []
}

export default validateRequestParams
export type { ResourceSearchRequest }
