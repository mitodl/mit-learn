import type { SimpleSelectOption } from "ol-components"
import type {
  CourseRunEnrollmentV3,
  CourseRunLanguageOption,
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { getBestRun } from "./helpers"

// Debug-only marker for synthetic language-selected runs.
// Do not use this property for product behavior/branching.
type SyntheticCourseRunV2 = CourseRunV2 & { __synthetic: boolean }
type ResolvedLanguageRunV2 = CourseRunV2 | SyntheticCourseRunV2

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

const getDefaultLanguageOptionKey = (
  course: CourseWithCourseRunsSerializerV2,
): string | null => {
  const defaultRunId = course.next_run_id
  if (!defaultRunId) {
    return null
  }

  const directMatch = (course.language_options ?? []).find(
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

  const byCoursewareId = (course.language_options ?? []).find(
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

    ;(course.language_options ?? []).forEach((option) => {
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
  if (!selectedLanguageKey) {
    return null
  }
  return (
    (course.language_options ?? []).find(
      (option) => getLanguageOptionKey(option) === selectedLanguageKey,
    ) ?? null
  )
}

const getCourseRunForSelectedLanguage = (
  course: CourseWithCourseRunsSerializerV2,
  selectedLanguageKey: string,
): CourseRunV2 | null => {
  const languageOption = getSelectedLanguageOption(course, selectedLanguageKey)
  if (!languageOption) {
    return null
  }

  return course.courseruns.find((run) => run.id === languageOption.id) ?? null
}

const getEnrollmentForSelectedLanguage = (
  enrollments: CourseRunEnrollmentV3[],
  selectedLanguageOption: CourseRunLanguageOption | null,
  selectedRun: CourseRunV2 | null,
): CourseRunEnrollmentV3 | null => {
  if (!selectedLanguageOption) {
    return null
  }

  return (
    enrollments.find((enrollment) => {
      return (
        enrollment.run.id === selectedLanguageOption.id ||
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
): ResolvedLanguageRunV2 | null => {
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
  //      one by spreading templateRun and overriding only id/title/courseware_id/
  //      run_tag from the language_options pointer. Dates, products, courseware_url,
  //      and enrollability are inherited from a different-language run because
  //      mitxonline does not currently surface per-language run metadata
  //      pre-enrollment. Removable when the API returns language-specific runs
  //      for non-default languages (see Approach C in feature_work/11088/pr_review.md).
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

  if (selectedEnrollment) {
    if (!templateRun) {
      // Cannot adapt enrollment.run to a CourseRunV2 shape without a scoped
      // template run to supply required base fields.
      return null
    }

    // Return the selected enrollment's run details merged onto a scoped base run
    // so downstream CourseRunV2 consumers get the selected-language run context.
    return {
      ...templateRun,
      id: selectedEnrollment.run.id,
      title: selectedEnrollment.run.title,
      courseware_id: selectedEnrollment.run.courseware_id,
      courseware_url: selectedEnrollment.run.courseware_url,
      run_tag: selectedEnrollment.run.run_tag,
      start_date: selectedEnrollment.run.start_date,
      end_date: selectedEnrollment.run.end_date,
      is_enrollable: selectedEnrollment.run.is_enrollable,
      is_upgradable: selectedEnrollment.run.is_upgradable,
      is_archived: selectedEnrollment.run.is_archived,
      is_self_paced: selectedEnrollment.run.is_self_paced,
      upgrade_deadline: selectedEnrollment.run.upgrade_deadline,
      certificate_available_date:
        selectedEnrollment.run.certificate_available_date,
      course_number: selectedEnrollment.run.course_number,
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

  // Return a synthetic selected-language run id/title/courseware mapped onto a
  // scoped template run so unenrolled language selection can still resolve.
  return {
    ...templateRun,
    id: selectedLanguageOption.id,
    title: selectedLanguageOption.title,
    courseware_id: selectedLanguageOption.courseware_id,
    run_tag: selectedLanguageOption.run_tag,
    __synthetic: true,
  } satisfies SyntheticCourseRunV2
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
