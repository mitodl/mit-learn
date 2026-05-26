/**
 * Variant picker model for B2B contract dashboards.
 *
 * A "variant" is a combination of language, industry focus, and run length
 * (e.g. "English / Energy / Short"). The picker is driven by the union of
 * `possible_variant_sets` across all courses in a contract.
 *
 * Union semantics: a variant appears in the dropdown if ANY course in the
 * contract supports it. Courses that lack a given variant fall back to their
 * default run (`next_run_id`).
 */
import type {
  BaseCourseRun,
  CourseWithCourseRunsSerializerV2,
  SupportedVariant,
} from "@mitodl/mitxonline-api-axios/v2"
import { getNativeLanguageName } from "../languageOptions"

const VARIANT_INDUSTRY_LABELS: Record<string, string> = {
  E: "Energy",
  F: "Finance",
  HC: "Healthcare",
}

const VARIANT_LENGTH_LABELS: Record<string, string> = {
  S: "Short",
  F: "Full",
}

/**
 * A single option in the contract-level variant picker.
 *
 * `value` is the stable string key used for React state.
 * `language`, `industry`, and `length` carry the raw codes sent to the API.
 * `isDefault` signals that no variant-runs API call is needed (show each
 * course's default run via `next_run_id`).
 */
type ContractVariantOption = {
  value: string
  label: string
  language: string
  industry: string
  length: string
  isDefault: boolean
}

/** Stable key for the "Original / default run" option. */
const DEFAULT_VARIANT_VALUE = ""

/** Pre-built picker option that represents "show each course's default run". */
const DEFAULT_VARIANT_OPTION: ContractVariantOption = {
  value: DEFAULT_VARIANT_VALUE,
  label: "Original",
  language: "",
  industry: "",
  length: "",
  isDefault: true,
}

const buildVariantKey = (
  language: string,
  industry: string,
  length: string,
): string => `language:${language}|industry:${industry}|length:${length}`

const buildVariantLabel = (
  language: string,
  industry: string,
  length: string,
): string => {
  const langLabel = language ? getNativeLanguageName(language) : ""
  const modifiers: string[] = []
  if (industry) modifiers.push(VARIANT_INDUSTRY_LABELS[industry] ?? industry)
  if (length) modifiers.push(VARIANT_LENGTH_LABELS[length] ?? length)
  const suffix = modifiers.length ? ` (${modifiers.join(", ")})` : ""
  return `${langLabel}${suffix}`
}

const variantToOption = (variant: SupportedVariant): ContractVariantOption => {
  const language = variant.language ?? ""
  const industry = (variant.variant_industry as string) ?? ""
  const length = (variant.variant_length as string) ?? ""
  return {
    value: buildVariantKey(language, industry, length),
    label: buildVariantLabel(language, industry, length),
    language,
    industry,
    length,
    isDefault: variant.default_variant,
  }
}

/**
 * Build deduplicated picker options from the union of `possible_variant_sets`
 * across all courses in a contract.
 *
 * Only active variants are included. A "Default / Original" option is always
 * prepended. Options are sorted alphabetically by label after the default.
 */
const getDistinctContractVariantOptions = (
  courses: CourseWithCourseRunsSerializerV2[],
): ContractVariantOption[] => {
  const seen = new Set<string>()
  const options: ContractVariantOption[] = []

  for (const course of courses) {
    for (const variant of course.possible_variant_sets ?? []) {
      if (!variant.active || variant.default_variant) continue
      const opt = variantToOption(variant)
      if (!seen.has(opt.value)) {
        seen.add(opt.value)
        options.push(opt)
      }
    }
  }

  options.sort((a, b) =>
    String(a.label).localeCompare(String(b.label), undefined, {
      sensitivity: "base",
    }),
  )

  return [DEFAULT_VARIANT_OPTION, ...options]
}

/**
 * Given the list of runs the API returned for one course (which may include
 * both the course's default-variant runs AND the requested-variant runs),
 * return the single best run that matches the selected variant combination.
 *
 * Matching is exact on every non-empty field of the selected variant
 * (language, industry, length).  If the course has no run for that combination
 * the function returns `null`, signalling to the caller that it should fall
 * back to the course's `next_run_id`-based default.
 *
 * Among matching runs, the one with the nearest *upcoming* start date is
 * preferred; if all start dates are in the past the most-recent past run wins;
 * runs with no start date are last.
 */
const selectVariantRunForCourse = (
  runs: BaseCourseRun[],
  selectedVariant: ContractVariantOption,
): BaseCourseRun | null => {
  const matching = runs.filter((run) => {
    if (selectedVariant.language && run.language !== selectedVariant.language)
      return false
    if (
      selectedVariant.industry &&
      (run.variant_industry ?? "") !== selectedVariant.industry
    )
      return false
    if (
      selectedVariant.length &&
      (run.variant_length ?? "") !== selectedVariant.length
    )
      return false
    return true
  })

  if (matching.length === 0) return null

  const now = Date.now()
  return (
    [...matching].sort((a, b) => {
      const aMs = a.start_date ? new Date(a.start_date).getTime() : null
      const bMs = b.start_date ? new Date(b.start_date).getTime() : null
      const aFuture = aMs !== null && aMs >= now
      const bFuture = bMs !== null && bMs >= now
      if (aFuture && bFuture) return aMs! - bMs! // nearest upcoming first
      if (aFuture) return -1
      if (bFuture) return 1
      if (aMs !== null && bMs !== null) return bMs - aMs // most-recent past first
      if (aMs !== null) return -1
      if (bMs !== null) return 1
      return 0
    })[0] ?? null
  )
}

export {
  getDistinctContractVariantOptions,
  selectVariantRunForCourse,
  buildVariantKey,
  DEFAULT_VARIANT_OPTION,
  DEFAULT_VARIANT_VALUE,
}
export type { ContractVariantOption }
