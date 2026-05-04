import type { SimpleSelectOption } from "ol-components"
import type {
  CourseRunEnrollmentV3,
  CourseRunLanguageOption,
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { getBestRun } from "./helpers"

const LANGUAGE_CODE_TO_NATIVE_NAME: Record<string, string> = {
  ar: "العربية",
  de: "Deutsch",
  "de-de": "Deutsch",
  el: "Ελληνικά",
  es: "Español",
  "es-419": "Español (Latinoamérica)",
  fr: "Français",
  pt: "Português",
  ja: "日本語",
  "pt-br": "Português (Brasil)",
  zh: "中文",
  "zh-hans": "简体中文",
  en: "English",
}

const getLanguageCode = (option: CourseRunLanguageOption): string | null => {
  const normalized = option.language?.trim().toLowerCase().replace(/_/g, "-")
  return normalized || null
}

const getLanguageOptionKey = (option: CourseRunLanguageOption): string => {
  const languageCode = getLanguageCode(option)
  return languageCode ? `language:${languageCode}` : ""
}

const getLanguageCodeFromOptionKey = (optionKey: string): string | null => {
  if (!optionKey.startsWith("language:")) {
    return null
  }
  const code = optionKey.replace("language:", "").trim().toLowerCase()
  return code || null
}

const getLanguageOptionLabel = (option: CourseRunLanguageOption): string => {
  const languageCode = getLanguageCode(option)
  if (!languageCode) {
    return ""
  }

  const exact = LANGUAGE_CODE_TO_NATIVE_NAME[languageCode]
  if (exact) {
    return exact
  }

  const baseCode = languageCode.split("-")[0]
  return LANGUAGE_CODE_TO_NATIVE_NAME[baseCode] ?? languageCode
}

type ExtendedLanguageOption = CourseRunLanguageOption & {
  is_enrollable?: boolean
}

const isLanguageOptionEnrollable = (
  course: CourseWithCourseRunsSerializerV2,
  option: CourseRunLanguageOption,
): boolean => {
  const enrollable = (option as ExtendedLanguageOption).is_enrollable
  if (typeof enrollable === "boolean") {
    return enrollable
  }

  const exactRunMatch = (course.courseruns ?? []).find(
    (run) => run.id === option.id,
  )
  if (exactRunMatch) {
    return Boolean(exactRunMatch.is_enrollable)
  }

  // If enrollability is not present on language_options payload, keep the
  // option available instead of hiding potentially valid languages.
  return true
}

const getRunsForLanguageOption = (
  course: CourseWithCourseRunsSerializerV2,
  option: CourseRunLanguageOption,
): CourseRunV2[] => {
  const runs = course.courseruns ?? []

  const byId = runs.filter((run) => run.id === option.id)
  const byCoursewareId = runs.filter(
    (run) => run.courseware_id === option.courseware_id,
  )
  const byCoursewareUrl = option.courseware_url
    ? runs.filter((run) => run.courseware_url === option.courseware_url)
    : []

  const seen = new Set<number>()
  const combined = [...byId, ...byCoursewareId, ...byCoursewareUrl]
  return combined.filter((run) => {
    if (seen.has(run.id)) {
      return false
    }
    seen.add(run.id)
    return true
  })
}

const getEnrollableLanguageOptions = (
  course: CourseWithCourseRunsSerializerV2,
): CourseRunLanguageOption[] => {
  return (course.language_options ?? []).filter((option) => {
    return isLanguageOptionEnrollable(course, option)
  })
}

const getDefaultLanguageOptionKey = (
  course: CourseWithCourseRunsSerializerV2,
): string | null => {
  const enrollableLanguageOptions = getEnrollableLanguageOptions(course)
  const defaultRunId = course.next_run_id
  if (!defaultRunId) {
    return null
  }

  const directMatch = enrollableLanguageOptions.find(
    (option) => option.id === defaultRunId,
  )
  if (directMatch) {
    const key = getLanguageOptionKey(directMatch)
    return key || null
  }

  const defaultRun = course.courseruns.find((run) => run.id === defaultRunId)
  if (!defaultRun) {
    return null
  }

  const byCoursewareId = enrollableLanguageOptions.find(
    (option) => option.courseware_id === defaultRun.courseware_id,
  )
  if (!byCoursewareId) {
    return null
  }

  const key = getLanguageOptionKey(byCoursewareId)
  return key || null
}

const getDistinctLanguageOptions = (
  courses: CourseWithCourseRunsSerializerV2[],
): SimpleSelectOption[] => {
  const optionsByKey = new Map<string, SimpleSelectOption>()
  const defaultLanguageCounts = new Map<string, number>()

  courses.forEach((course) => {
    const defaultLanguageKey = getDefaultLanguageOptionKey(course)
    if (defaultLanguageKey) {
      defaultLanguageCounts.set(
        defaultLanguageKey,
        (defaultLanguageCounts.get(defaultLanguageKey) ?? 0) + 1,
      )
    }

    getEnrollableLanguageOptions(course).forEach((option) => {
      const key = getLanguageOptionKey(option)
      const label = getLanguageOptionLabel(option)
      if (!key || !label) {
        return
      }
      if (!optionsByKey.has(key)) {
        optionsByKey.set(key, {
          value: key,
          label,
        })
      }
    })
  })

  return Array.from(optionsByKey.values()).sort((a, b) => {
    const defaultCountA = defaultLanguageCounts.get(String(a.value)) ?? 0
    const defaultCountB = defaultLanguageCounts.get(String(b.value)) ?? 0
    if (defaultCountA !== defaultCountB) {
      return defaultCountB - defaultCountA
    }
    return String(a.label).localeCompare(String(b.label))
  })
}

const getSelectedLanguageOption = (
  course: CourseWithCourseRunsSerializerV2,
  selectedLanguageKey: string,
): CourseRunLanguageOption | null => {
  const resolvedLanguageKey =
    selectedLanguageKey || getDefaultLanguageOptionKey(course) || ""

  if (!resolvedLanguageKey) {
    return null
  }

  const matchingOptions = getEnrollableLanguageOptions(course).filter(
    (option) => getLanguageOptionKey(option) === resolvedLanguageKey,
  )

  if (matchingOptions.length === 0) {
    return null
  }

  const nextRunMatch = matchingOptions.find(
    (option) => option.id === course.next_run_id,
  )
  if (nextRunMatch) {
    return nextRunMatch
  }

  const bestEnrollableRun = getBestRun(course, { enrollableOnly: true })
  const bestRunMatch = matchingOptions.find((option) => {
    return (
      option.id === bestEnrollableRun?.id ||
      option.courseware_id === bestEnrollableRun?.courseware_id ||
      (Boolean(option.courseware_url) &&
        option.courseware_url === bestEnrollableRun?.courseware_url)
    )
  })
  if (bestRunMatch) {
    return bestRunMatch
  }

  return matchingOptions[0] ?? null
}

const getCourseRunForSelectedLanguage = (
  course: CourseWithCourseRunsSerializerV2,
  selectedLanguageKey: string,
): CourseRunV2 | null => {
  const languageOption = getSelectedLanguageOption(course, selectedLanguageKey)
  if (!languageOption) {
    return (
      getBestRun(course, { enrollableOnly: true }) ??
      course.courseruns.find((run) => run.id === course.next_run_id) ??
      course.courseruns.find((run) => run.is_enrollable) ??
      course.courseruns[0] ??
      null
    )
  }

  const matchingRuns = getRunsForLanguageOption(course, languageOption)
  if (matchingRuns.length === 0) {
    return null
  }

  const nextRunMatch = matchingRuns.find((run) => run.id === course.next_run_id)
  if (nextRunMatch) {
    return nextRunMatch
  }

  const bestEnrollableRun = getBestRun(course, { enrollableOnly: true })
  const bestRunMatch = matchingRuns.find(
    (run) => run.id === bestEnrollableRun?.id,
  )
  if (bestRunMatch) {
    return bestRunMatch
  }

  return (
    matchingRuns.find((run) => run.is_enrollable) ?? matchingRuns[0] ?? null
  )
}

const getEnrollmentForSelectedLanguage = (
  enrollments: CourseRunEnrollmentV3[],
  selectedLanguageOption: CourseRunLanguageOption | null,
  selectedRun: CourseRunV2 | null,
): CourseRunEnrollmentV3 | null => {
  if (!selectedLanguageOption) {
    if (!selectedRun) {
      return null
    }

    return (
      enrollments.find((enrollment) => {
        if (!enrollment.run) {
          return false
        }

        return (
          enrollment.run.id === selectedRun.id ||
          enrollment.run.courseware_id === selectedRun.courseware_id
        )
      }) ?? null
    )
  }

  return (
    enrollments.find((enrollment) => {
      if (!enrollment.run) {
        return false
      }

      return (
        enrollment.run.id === selectedLanguageOption.id ||
        enrollment.run.courseware_id === selectedLanguageOption.courseware_id ||
        (selectedRun ? enrollment.run.id === selectedRun.id : false)
      )
    }) ?? null
  )
}

const getResolvedRunForSelectedLanguage = (
  course: CourseWithCourseRunsSerializerV2,
  selectedLanguageOption: CourseRunLanguageOption | null,
  selectedRun: CourseRunV2 | null,
  selectedEnrollment: CourseRunEnrollmentV3 | null,
  contractId?: number,
): CourseRunV2 | null => {
  // Returns a CourseRunV2 representing the user's effective run for the selected
  // language. Three cases:
  //
  //   1. User is enrolled in the language: shape a V2 run from the V3 enrollment
  //      by spreading templateRun and overriding 13 fields. Removable when
  //      dashboard card/run context migrates to V3-native types.
  //
  //   2. A real CourseRunV2 exists in course.courseruns for the language:
  //      return it directly.
  //
  //   3. Pre-enrollment, no real CourseRunV2 exists for the language: synthesize
  //      one by spreading templateRun and overriding only
  //      id/title/courseware_id/courseware_url/run_tag from the
  //      language_options pointer. Dates, products, and enrollability are
  //      inherited from a different-language run because mitxonline does not
  //      currently surface per-language run metadata pre-enrollment.
  //      Removable when the API returns language-specific runs for non-default
  //      languages.
  let scopedSelectedRun: CourseRunV2 | null = selectedRun
  if (
    typeof contractId === "number" &&
    selectedRun?.b2b_contract !== contractId
  ) {
    scopedSelectedRun = null
  }

  let templateRun: CourseRunV2 | null = scopedSelectedRun
  if (!templateRun) {
    templateRun =
      typeof contractId === "number"
        ? (getBestRun(course, { contractId }) ?? null)
        : (getBestRun(course) ?? null)
  }

  const enrollmentRun = selectedEnrollment?.run
  if (enrollmentRun) {
    if (!templateRun) {
      // Cannot adapt enrollment.run to a CourseRunV2 shape without a scoped
      // template run to supply required base fields.
      return null
    }

    // Return the selected enrollment's run details merged onto a scoped base run
    // so downstream CourseRunV2 consumers get the selected-language run context.
    return {
      ...templateRun,
      id: enrollmentRun.id,
      title: enrollmentRun.title,
      courseware_id: enrollmentRun.courseware_id,
      courseware_url: enrollmentRun.courseware_url,
      run_tag: enrollmentRun.run_tag,
      start_date: enrollmentRun.start_date,
      end_date: enrollmentRun.end_date,
      is_enrollable: enrollmentRun.is_enrollable,
      is_upgradable: enrollmentRun.is_upgradable,
      is_archived: enrollmentRun.is_archived,
      is_self_paced: enrollmentRun.is_self_paced,
      upgrade_deadline: enrollmentRun.upgrade_deadline,
      certificate_available_date: enrollmentRun.certificate_available_date,
      course_number: enrollmentRun.course_number,
    }
  }

  if (scopedSelectedRun) {
    // Return the exact selected run when it already exists in this course's
    // scoped runs and matches the optional contract constraint.
    return scopedSelectedRun
  }

  if (!selectedLanguageOption || !templateRun) {
    // No selected language option, or no scoped template run to anchor one,
    // so there is no safe run context to return.
    return null
  }

  // Pre-enrollment fallback when selected language has no concrete CourseRunV2
  // in this payload: project selected-language identifiers onto a scoped base
  // run so UI can render the chosen language title/URL context.
  return {
    ...templateRun,
    id: selectedLanguageOption.id,
    title: selectedLanguageOption.title,
    courseware_id: selectedLanguageOption.courseware_id,
    courseware_url: selectedLanguageOption.courseware_url,
    run_tag: selectedLanguageOption.run_tag,
  }
}

export {
  getLanguageCodeFromOptionKey,
  getLanguageOptionKey,
  getDistinctLanguageOptions,
  getSelectedLanguageOption,
  getCourseRunForSelectedLanguage,
  getEnrollmentForSelectedLanguage,
  getResolvedRunForSelectedLanguage,
}
