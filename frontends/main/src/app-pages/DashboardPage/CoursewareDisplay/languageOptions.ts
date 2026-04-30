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
  "es-419": "Español latinoamericano",
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

  return (
    course.courseruns.find(
      (run) =>
        run.courseware_id === languageOption.courseware_id ||
        run.id === languageOption.id,
    ) ?? null
  )
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
  const templateRun =
    selectedRun ??
    getBestRun(course, { enrollableOnly: true, contractId }) ??
    course.courseruns[0] ??
    null
  if (!templateRun) {
    return null
  }

  if (selectedEnrollment) {
    // TODO: Temporary V3 -> V2 run adapter.
    // Remove once dashboard card/run context is migrated to V3-native types.
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

  if (selectedRun) {
    return selectedRun
  }

  if (!selectedLanguageOption) {
    return null
  }

  return {
    ...templateRun,
    id: selectedLanguageOption.id,
    title: selectedLanguageOption.title,
    courseware_id: selectedLanguageOption.courseware_id,
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
