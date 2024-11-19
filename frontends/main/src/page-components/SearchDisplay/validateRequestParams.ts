import {
  LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as ResourceSearchRequest,
  ResourceTypeEnum,
  LearningResourcesSearchRetrieveDepartmentEnum as DepartmentEnum,
  LearningResourcesSearchRetrieveLevelEnum as LevelEnum,
  LearningResourcesSearchRetrievePlatformEnum as PlatformEnum,
  LearningResourcesSearchRetrieveOfferedByEnum as OfferedByEnum,
  LearningResourcesSearchRetrieveSortbyEnum as SortByEnum,
  LearningResourcesSearchRetrieveAggregationsEnum as AggregationsEnum,
  LearningResourcesSearchRetrieveDeliveryEnum as DeliveryEnum,
  LearningResourcesSearchRetrieveResourceCategoryEnum as ResourceCategoryEnum,
  LearningResourcesSearchRetrieveSearchModeEnum as SearchModeEnum,
  CertificationTypeEnum,
} from "api"

/* Validates and transforms URLSearchParams on the page URL to request params
 * for useLearningResourcesSearch, converting string boolean
 * values to boolean, single parameter array values to [string]
 * and removing undefined values that would cause a query key
 * mismatch and invalidate the SSR prefetch.
 * Borrowing from @mitodl/course-search ./hooks/validation
 * but for use on the server.
 */
const validateRequestParams = (
  searchParams: Partial<ResourceSearchRequest>,
) => {
  return Object.entries(resourceSearchValidators).reduce<
    Partial<ResourceSearchRequest>
  >((acc, [key, validator]) => {
    const paramKey = key as keyof ResourceSearchRequest

    if (searchParams[paramKey]) {
      const value = searchParams[paramKey] as string[]

      const validated = validator(toArray(value))

      return { ...acc, [paramKey]: validated }
    }

    return acc
  }, {})
}

/* Maps strings to [string] to handle Next.js' treatment
 * of repeated search parameters, ie.
 * ?key=value -> { key: "value" }
 * ?key=value1&key=value2 -> { key: ["value1", "value2"] }
 *
 * Additionally, all search values in @mitodl/course-search are
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

const withinEnum =
  <T>(allowed: T[]) =>
  (values: string[]) =>
    values.filter((v) => (allowed as string[]).includes(v)) as T[]

const first = (values: string[]) => {
  if (Array.isArray(values)) return values[0]
  return values
}
const identity = <T>(v: T) => v
const firstBoolean = (values: string[]): boolean | undefined => {
  if (values.includes("true")) return true
  if (values.includes("false")) return false
  return undefined
}
const numbers = (values: string[]) =>
  values.map((v) => parseInt(v)).filter(Number.isNaN)

const firstNumber = (values: string[]) => numbers(values)[0]

const floats = (values: string[]) =>
  values.map((v) => parseFloat(v)).filter(Number.isNaN)
const firstFloat = (values: string[]) => floats(values)[0]

type QueryParamValidators<ReqParams> = {
  [k in keyof Required<ReqParams>]: (v: string[]) => ReqParams[k]
}

const resourceSearchValidators: QueryParamValidators<ResourceSearchRequest> = {
  resource_type: withinEnum(Object.values(ResourceTypeEnum)),
  department: withinEnum(Object.values(DepartmentEnum)),
  level: withinEnum(Object.values(LevelEnum)),
  platform: withinEnum(Object.values(PlatformEnum)),
  offered_by: withinEnum(Object.values(OfferedByEnum)),
  sortby: (values) => withinEnum(Object.values(SortByEnum))(values)?.[0],
  q: first,
  topic: identity,
  certification: firstBoolean,
  professional: firstBoolean,
  aggregations: withinEnum(Object.values(AggregationsEnum)),
  course_feature: identity,
  limit: firstNumber,
  offset: firstNumber,
  id: numbers,
  free: firstBoolean,
  delivery: withinEnum(Object.values(DeliveryEnum)),
  certification_type: withinEnum(Object.values(CertificationTypeEnum)),
  resource_category: withinEnum(Object.values(ResourceCategoryEnum)),
  yearly_decay_percent: firstFloat,
  dev_mode: firstBoolean,
  max_incompleteness_penalty: firstFloat,
  min_score: firstFloat,
  search_mode: (values) =>
    withinEnum(Object.values(SearchModeEnum))(values)?.[0],
  slop: firstNumber,
  content_file_score_weight: firstFloat,
  ocw_topic: identity,
}

export default validateRequestParams
export { resourceSearchValidators }
export type { QueryParamValidators }
