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

/** Stable key for the "Original / default run" option. */
const DEFAULT_VARIANT_VALUE = ""

const buildVariantKey = (variant: SupportedVariant): string =>
  `language:${variant.language ?? ""}|industry:${variant.variant_industry ?? ""}|length:${variant.variant_length ?? ""}`

const buildVariantLabel = (variant: SupportedVariant): string => {
  const langLabel = variant.language
    ? getNativeLanguageName(variant.language.replace("_", "-"))
    : ""
  const modifiers: string[] = []
  if (variant.variant_industry) {
    modifiers.push(
      VARIANT_INDUSTRY_LABELS[variant.variant_industry] ??
        variant.variant_industry,
    )
  } else {
    modifiers.push("General")
  }
  if (variant.variant_length) {
    modifiers.push(
      VARIANT_LENGTH_LABELS[variant.variant_length] ?? variant.variant_length,
    )
  } else {
    modifiers.push("Full")
  }
  return [langLabel, ...modifiers].filter(Boolean).join(" • ")
}

/**
 * Build deduplicated picker options from the union of `possible_variant_sets`
 * across all courses in a contract.
 *
 * Only active variants are included. Options are sorted alphabetically by
 * label.
 */
const getDistinctContractVariantOptions = (
  courses: CourseWithCourseRunsSerializerV2[],
): SupportedVariant[] => {
  const seen = new Set<string>()
  const options: SupportedVariant[] = []

  for (const course of courses) {
    for (const variant of course.possible_variant_sets ?? []) {
      if (!variant.active) continue
      const value = buildVariantKey(variant)
      if (!seen.has(value)) {
        seen.add(value)
        options.push(variant)
      }
    }
  }

  options.sort((a, b) => {
    const labelA = buildVariantLabel(a)
    const labelB = buildVariantLabel(b)
    return labelA.localeCompare(labelB, undefined, { sensitivity: "base" })
  })

  return options
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
  // selectedVariant: ContractVariantOption,
  selectedVariant: SupportedVariant,
): BaseCourseRun | null => {
  const matching = runs.filter((run) => {
    if (selectedVariant.language && run.language !== selectedVariant.language)
      return false
    if (
      selectedVariant.variant_industry &&
      (run.variant_industry ?? "") !== selectedVariant.variant_industry
    )
      return false
    if (
      selectedVariant.variant_length &&
      (run.variant_length ?? "") !== selectedVariant.variant_length
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
  buildVariantLabel,
  DEFAULT_VARIANT_VALUE,
}
