import { factories } from "api/mitxonline-test-utils"
import type {
  CourseRunEnrollmentV3,
  CourseRunLanguageOption,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  getCourseRunForSelectedLanguage,
  getDistinctLanguageOptions,
  getEnrollmentForSelectedLanguage,
  getLanguageOptionKey,
  getResolvedRunForSelectedLanguage,
  getSelectedLanguageOption,
  selectBestContractEnrollmentForLanguage,
} from "./languageOptions"

type LanguageOptionWithEnrollability = CourseRunLanguageOption & {
  is_enrollable: boolean
}

describe("languageOptions", () => {
  test("normalizes language keys", () => {
    expect(
      getLanguageOptionKey({
        id: 1,
        courseware_id: "cw-1",
        courseware_url: "https://example.com/cw-1",
        language: "pt_BR",
        title: "Run",
        run_tag: "R1",
      }),
    ).toBe("language:pt-br")
  })

  test("builds distinct language options sorted by majority default language", () => {
    const englishRunA = factories.courses.courseRun({
      id: 101,
      title: "English A",
      courseware_id: "cw-en-a",
      courseware_url: "https://example.com/cw-en-a",
      is_enrollable: true,
    })
    const spanishRunA = factories.courses.courseRun({
      id: 102,
      title: "Espanol A",
      courseware_id: "cw-es-a",
      courseware_url: "https://example.com/cw-es-a",
      is_enrollable: true,
    })
    const englishRunB = factories.courses.courseRun({
      id: 201,
      title: "English B",
      courseware_id: "cw-en-b",
      courseware_url: "https://example.com/cw-en-b",
      is_enrollable: true,
    })
    const spanishRunB = factories.courses.courseRun({
      id: 202,
      title: "Espanol B",
      courseware_id: "cw-es-b",
      courseware_url: "https://example.com/cw-es-b",
      is_enrollable: true,
    })
    const spanishRunC = factories.courses.courseRun({
      id: 302,
      title: "Espanol C",
      courseware_id: "cw-es-c",
      courseware_url: "https://example.com/cw-es-c",
      is_enrollable: true,
    })
    const englishRunC = factories.courses.courseRun({
      id: 301,
      title: "English C",
      courseware_id: "cw-en-c",
      courseware_url: "https://example.com/cw-en-c",
      is_enrollable: true,
    })

    const courseA = factories.courses.course({
      courseruns: [englishRunA, spanishRunA],
      next_run_id: englishRunA.id,
      language_options: [
        {
          id: englishRunA.id,
          courseware_id: englishRunA.courseware_id,
          courseware_url: englishRunA.courseware_url ?? "",
          language: "en",
          title: englishRunA.title,
          run_tag: englishRunA.run_tag,
        },
        {
          id: spanishRunA.id,
          courseware_id: spanishRunA.courseware_id,
          courseware_url: spanishRunA.courseware_url ?? "",
          language: "es",
          title: spanishRunA.title,
          run_tag: spanishRunA.run_tag,
        },
        {
          id: 999,
          courseware_id: "cw-empty",
          courseware_url: "https://example.com/cw-empty",
          language: "",
          title: "No Language",
          run_tag: "R0",
        },
      ],
    })
    const courseB = factories.courses.course({
      courseruns: [englishRunB, spanishRunB],
      next_run_id: englishRunB.id,
      language_options: [
        {
          id: englishRunB.id,
          courseware_id: englishRunB.courseware_id,
          courseware_url: englishRunB.courseware_url ?? "",
          language: "en",
          title: englishRunB.title,
          run_tag: englishRunB.run_tag,
        },
        {
          id: spanishRunB.id,
          courseware_id: spanishRunB.courseware_id,
          courseware_url: spanishRunB.courseware_url ?? "",
          language: "es",
          title: spanishRunB.title,
          run_tag: spanishRunB.run_tag,
        },
      ],
    })
    const courseC = factories.courses.course({
      courseruns: [englishRunC, spanishRunC],
      next_run_id: spanishRunC.id,
      language_options: [
        {
          id: englishRunC.id,
          courseware_id: englishRunC.courseware_id,
          courseware_url: englishRunC.courseware_url ?? "",
          language: "en",
          title: englishRunC.title,
          run_tag: englishRunC.run_tag,
        },
        {
          id: spanishRunC.id,
          courseware_id: spanishRunC.courseware_id,
          courseware_url: spanishRunC.courseware_url ?? "",
          language: "es",
          title: spanishRunC.title,
          run_tag: spanishRunC.run_tag,
        },
      ],
    })

    const options = getDistinctLanguageOptions([courseA, courseB, courseC])

    expect(options).toHaveLength(2)
    expect(options[0]).toEqual({
      value: "language:en",
      label: "English",
    })
    expect(options[1]).toEqual({
      value: "language:es",
      label: "Español",
    })
  })

  test("builds distinct options when language option ids differ from run ids", () => {
    const englishRun = factories.courses.courseRun({
      id: 4001,
      title: "English Run",
      courseware_id: "cw-en-4001",
      courseware_url: "https://example.com/cw-en-4001",
      is_enrollable: true,
    })
    const spanishRun = factories.courses.courseRun({
      id: 4002,
      title: "Spanish Run",
      courseware_id: "cw-es-4002",
      courseware_url: "https://example.com/cw-es-4002",
      is_enrollable: true,
    })

    const course = factories.courses.course({
      courseruns: [englishRun, spanishRun],
      next_run_id: englishRun.id,
      language_options: [
        {
          id: 9001,
          courseware_id: englishRun.courseware_id,
          courseware_url: englishRun.courseware_url ?? "",
          language: "en",
          title: englishRun.title,
          run_tag: englishRun.run_tag,
        },
        {
          id: 9002,
          courseware_id: spanishRun.courseware_id,
          courseware_url: spanishRun.courseware_url ?? "",
          language: "es",
          title: spanishRun.title,
          run_tag: spanishRun.run_tag,
        },
      ],
    })

    const options = getDistinctLanguageOptions([course])
    const selectedRun = getCourseRunForSelectedLanguage(course, "language:es")

    expect(options).toHaveLength(2)
    expect(options.map((option) => option.value)).toEqual([
      "language:en",
      "language:es",
    ])
    expect(selectedRun?.id).toBe(spanishRun.id)
  })

  test("keeps language when one of multiple matching runs is enrollable", () => {
    const englishRun = factories.courses.courseRun({
      id: 6101,
      title: "English",
      courseware_id: "cw-en-6101",
      courseware_url: "https://example.com/cw-en-6101",
      is_enrollable: true,
    })
    const spanishUnenrollable = factories.courses.courseRun({
      id: 6102,
      title: "Spanish Old",
      courseware_id: "cw-es-shared",
      courseware_url: "https://example.com/cw-es-shared",
      is_enrollable: false,
    })
    const spanishEnrollable = factories.courses.courseRun({
      id: 6103,
      title: "Spanish New",
      courseware_id: "cw-es-shared",
      courseware_url: "https://example.com/cw-es-shared",
      is_enrollable: true,
    })

    const course = factories.courses.course({
      courseruns: [englishRun, spanishUnenrollable, spanishEnrollable],
      next_run_id: englishRun.id,
      language_options: [
        {
          id: 9101,
          courseware_id: englishRun.courseware_id,
          courseware_url: englishRun.courseware_url ?? "",
          language: "en",
          title: englishRun.title,
          run_tag: englishRun.run_tag,
        },
        {
          id: 9102,
          courseware_id: spanishEnrollable.courseware_id,
          courseware_url: spanishEnrollable.courseware_url ?? "",
          language: "es",
          title: spanishEnrollable.title,
          run_tag: spanishEnrollable.run_tag,
        },
      ],
    })

    const options = getDistinctLanguageOptions([course])
    const selectedOption = getSelectedLanguageOption(course, "language:es")
    const selectedRun = getCourseRunForSelectedLanguage(course, "language:es")

    expect(options.map((option) => option.value)).toEqual([
      "language:en",
      "language:es",
    ])
    expect(selectedOption).not.toBeNull()
    expect(selectedRun?.id).toBe(spanishEnrollable.id)
  })

  test("includes language options even when no language variant exists in courseruns", () => {
    const templateRun = factories.courses.courseRun({
      id: 6201,
      title: "English Template",
      courseware_id: "cw-template-en",
      courseware_url: "https://example.com/cw-template-en",
      is_enrollable: true,
    })

    const course = factories.courses.course({
      courseruns: [templateRun],
      next_run_id: templateRun.id,
      language_options: [
        {
          id: templateRun.id,
          courseware_id: templateRun.courseware_id,
          courseware_url: templateRun.courseware_url ?? "",
          language: "en",
          title: templateRun.title,
          run_tag: templateRun.run_tag,
        },
        {
          id: 6202,
          courseware_id: "cw-template-es",
          courseware_url: "https://example.com/cw-template-es",
          language: "es",
          title: "Modulo Espanol",
          run_tag: templateRun.run_tag,
        },
      ],
    })

    const options = getDistinctLanguageOptions([course])
    expect(options.map((option) => option.value)).toEqual([
      "language:en",
      "language:es",
    ])
  })

  test("filters out unenrollable options when is_enrollable is provided", () => {
    const run = factories.courses.courseRun({
      id: 6301,
      title: "English",
      courseware_id: "cw-en-6301",
      courseware_url: "https://example.com/cw-en-6301",
      is_enrollable: true,
    })

    const course = factories.courses.course({
      courseruns: [run],
      next_run_id: run.id,
      language_options: [
        {
          id: run.id,
          courseware_id: run.courseware_id,
          courseware_url: run.courseware_url ?? "",
          language: "en",
          title: run.title,
          run_tag: run.run_tag,
          is_enrollable: true,
        } as LanguageOptionWithEnrollability,
        {
          id: 6302,
          courseware_id: "cw-es-6302",
          courseware_url: "https://example.com/cw-es-6302",
          language: "es",
          title: "Modulo Espanol",
          run_tag: run.run_tag,
          is_enrollable: false,
        } as LanguageOptionWithEnrollability,
      ],
    })

    const options = getDistinctLanguageOptions([course])
    expect(options.map((option) => option.value)).toEqual(["language:en"])
  })

  test("matches selected enrollment by language option courseware id", () => {
    const englishRun = factories.courses.courseRun({
      id: 11,
      courseware_id: "cw-en",
      courseware_url: "https://example.com/cw-en",
    })
    const spanishRun = factories.courses.courseRun({
      id: 12,
      courseware_id: "cw-es",
      courseware_url: "https://example.com/cw-es",
    })

    const englishEnrollment = factories.enrollment.courseEnrollment({
      run: {
        id: englishRun.id,
        course: { id: 1, title: "Course" },
        title: englishRun.title,
        courseware_id: englishRun.courseware_id,
      },
    })
    const spanishEnrollment = factories.enrollment.courseEnrollment({
      run: {
        id: spanishRun.id,
        course: { id: 1, title: "Course" },
        title: spanishRun.title,
        courseware_id: spanishRun.courseware_id,
      },
    })

    const selectedEnrollment = getEnrollmentForSelectedLanguage(
      [englishEnrollment, spanishEnrollment],
      {
        id: spanishRun.id,
        courseware_id: spanishRun.courseware_id,
        courseware_url: spanishRun.courseware_url ?? "",
        language: "es",
        title: spanishRun.title,
        run_tag: spanishRun.run_tag,
      },
      null,
    )

    expect(selectedEnrollment?.run.courseware_id).toBe(spanishRun.courseware_id)
  })

  test("matches enrollment when course has no language options", () => {
    const run = factories.courses.courseRun({
      id: 7001,
      title: "Enrolled Course",
      courseware_id: "cw-enrolled-7001",
      courseware_url: "https://example.com/cw-enrolled-7001",
      is_enrollable: true,
    })

    const course = factories.courses.course({
      courseruns: [run],
      next_run_id: run.id,
      language_options: [],
    })

    const selectedRun = getCourseRunForSelectedLanguage(course, "")
    const enrollment = factories.enrollment.courseEnrollment({
      run: {
        id: run.id,
        course: { id: course.id, title: course.title },
        title: run.title,
        courseware_id: run.courseware_id,
        courseware_url: run.courseware_url,
      },
    })

    const selectedEnrollment = getEnrollmentForSelectedLanguage(
      [enrollment],
      null,
      selectedRun,
    )

    expect(selectedRun?.id).toBe(run.id)
    expect(selectedEnrollment?.run.id).toBe(run.id)
  })

  test("adapts V3 enrollment run into V2-shaped run context", () => {
    const templateRun = factories.courses.courseRun({
      id: 500,
      title: "Template",
      courseware_id: "cw-template",
      courseware_url: "https://example.com/template",
      enrollment_start: "2026-01-01T00:00:00Z",
    })
    const spanishRun = factories.courses.courseRun({
      id: 501,
      title: "Titulo Espanol",
      courseware_id: "cw-es",
      courseware_url: "https://example.com/es",
      is_enrollable: true,
    })
    const course = factories.courses.course({
      courseruns: [templateRun, spanishRun],
      next_run_id: templateRun.id,
      language_options: [
        {
          id: templateRun.id,
          courseware_id: templateRun.courseware_id,
          courseware_url: templateRun.courseware_url ?? "",
          language: "en",
          title: templateRun.title,
          run_tag: templateRun.run_tag,
        },
        {
          id: spanishRun.id,
          courseware_id: spanishRun.courseware_id,
          courseware_url: spanishRun.courseware_url ?? "",
          language: "es",
          title: spanishRun.title,
          run_tag: spanishRun.run_tag,
        },
      ],
    })

    const spanishOption = getSelectedLanguageOption(course, "language:es")
    const enrollment = factories.enrollment.courseEnrollment({
      run: {
        id: spanishRun.id,
        course: { id: course.id, title: course.title },
        title: spanishRun.title,
        courseware_id: spanishRun.courseware_id,
        courseware_url: spanishRun.courseware_url,
        run_tag: spanishRun.run_tag,
        start_date: spanishRun.start_date,
        end_date: spanishRun.end_date,
        is_enrollable: spanishRun.is_enrollable,
        is_upgradable: spanishRun.is_upgradable,
        is_archived: spanishRun.is_archived,
        is_self_paced: spanishRun.is_self_paced,
        upgrade_deadline: spanishRun.upgrade_deadline,
        certificate_available_date: spanishRun.certificate_available_date,
        course_number: spanishRun.course_number,
      },
    })

    const resolved = getResolvedRunForSelectedLanguage(
      course,
      spanishOption,
      spanishRun,
      enrollment,
      undefined,
    )

    expect(resolved?.id).toBe(spanishRun.id)
    expect(resolved?.title).toBe(spanishRun.title)
    expect(resolved?.courseware_url).toBe(spanishRun.courseware_url)
    expect(resolved?.enrollment_start).toBe(spanishRun.enrollment_start)
  })

  test("returns synthetic run when selected language has no concrete run", () => {
    const contractId = 77
    const nonEnrollableContractRun = factories.courses.courseRun({
      id: 1001,
      title: "English Contract Run",
      courseware_id: "cw-contract-en",
      courseware_url: "https://openedx.example.com/contract-english",
      b2b_contract: contractId,
      is_enrollable: false,
    })
    const enrollableNonContractRun = factories.courses.courseRun({
      id: 1002,
      title: "Fallback Enrollable Run",
      courseware_id: "cw-fallback-enrollable",
      courseware_url: "https://openedx.example.com/fallback-enrollable",
      b2b_contract: null,
      is_enrollable: true,
    })
    const course = factories.courses.course({
      courseruns: [nonEnrollableContractRun, enrollableNonContractRun],
      next_run_id: nonEnrollableContractRun.id,
      language_options: [
        {
          id: nonEnrollableContractRun.id,
          courseware_id: nonEnrollableContractRun.courseware_id,
          courseware_url: nonEnrollableContractRun.courseware_url ?? "",
          language: "en",
          title: nonEnrollableContractRun.title,
          run_tag: nonEnrollableContractRun.run_tag,
        },
        {
          id: 1003,
          courseware_id: "cw-contract-es-synthetic",
          courseware_url: "https://openedx.example.com/contract-spanish",
          language: "es",
          title: "Modulo sintetico",
          run_tag: "spanish",
        },
      ],
    })

    const spanishOption = getSelectedLanguageOption(course, "language:es")

    const resolved = getResolvedRunForSelectedLanguage(
      course,
      spanishOption,
      null,
      null,
      contractId,
    )

    expect(resolved?.id).toBe(1003)
    expect(resolved?.title).toBe("Modulo sintetico")
    expect(resolved?.courseware_url).toBe(
      "https://openedx.example.com/contract-spanish",
    )
  })

  test("returns null when contract-scoped template run does not exist", () => {
    const contractId = 88
    const nonContractRun = factories.courses.courseRun({
      id: 2001,
      title: "Non-contract run",
      courseware_id: "cw-non-contract",
      courseware_url: "https://openedx.example.com/non-contract",
      b2b_contract: null,
    })
    const course = factories.courses.course({
      courseruns: [nonContractRun],
      next_run_id: nonContractRun.id,
      language_options: [
        {
          id: 2002,
          courseware_id: "cw-contract-es-synthetic",
          courseware_url: "https://openedx.example.com/contract-spanish",
          language: "es",
          title: "Modulo sintetico",
          run_tag: "spanish",
        },
      ],
    })

    const spanishOption = getSelectedLanguageOption(course, "language:es")

    const resolved = getResolvedRunForSelectedLanguage(
      course,
      spanishOption,
      null,
      null,
      contractId,
    )

    expect(resolved).toBeNull()
  })

  test("ignores unenrollable options and picks enrollable option for the same language", () => {
    const unenrollableEnglish = factories.courses.courseRun({
      id: 3001,
      courseware_id: "cw-en-unenrollable",
      courseware_url: "https://openedx.example.com/en-unenrollable",
      is_enrollable: false,
    })
    const enrollableEnglish = factories.courses.courseRun({
      id: 3002,
      courseware_id: "cw-en-enrollable",
      courseware_url: "https://openedx.example.com/en-enrollable",
      is_enrollable: true,
    })
    const course = factories.courses.course({
      courseruns: [unenrollableEnglish, enrollableEnglish],
      next_run_id: unenrollableEnglish.id,
      language_options: [
        {
          id: unenrollableEnglish.id,
          courseware_id: unenrollableEnglish.courseware_id,
          courseware_url: unenrollableEnglish.courseware_url ?? "",
          language: "en",
          title: unenrollableEnglish.title,
          run_tag: unenrollableEnglish.run_tag,
        },
        {
          id: enrollableEnglish.id,
          courseware_id: enrollableEnglish.courseware_id,
          courseware_url: enrollableEnglish.courseware_url ?? "",
          language: "en",
          title: enrollableEnglish.title,
          run_tag: enrollableEnglish.run_tag,
        },
      ],
    })

    const selectedOption = getSelectedLanguageOption(course, "language:en")
    const selectedRun = getCourseRunForSelectedLanguage(course, "language:en")
    const resolvedRun = getResolvedRunForSelectedLanguage(
      course,
      selectedOption,
      selectedRun,
      null,
      undefined,
    )

    expect(selectedOption?.id).toBe(enrollableEnglish.id)
    expect(resolvedRun?.id).toBe(enrollableEnglish.id)
  })

  test("ignores malformed enrollments without run data", () => {
    const run = factories.courses.courseRun({
      id: 5001,
      courseware_id: "cw-en-5001",
      courseware_url: "https://example.com/cw-en-5001",
      is_enrollable: true,
    })
    const course = factories.courses.course({
      courseruns: [run],
      next_run_id: run.id,
      language_options: [
        {
          id: run.id,
          courseware_id: run.courseware_id,
          courseware_url: run.courseware_url ?? "",
          language: "en",
          title: run.title,
          run_tag: run.run_tag,
        },
      ],
    })

    const selectedOption = getSelectedLanguageOption(course, "language:en")
    const selectedRun = getCourseRunForSelectedLanguage(course, "language:en")
    const malformedEnrollment = {
      ...factories.enrollment.courseEnrollment(),
      run: undefined,
    } as unknown as CourseRunEnrollmentV3

    expect(
      getEnrollmentForSelectedLanguage(
        [malformedEnrollment],
        selectedOption,
        selectedRun,
      ),
    ).toBeNull()

    expect(
      getResolvedRunForSelectedLanguage(
        course,
        selectedOption,
        selectedRun,
        malformedEnrollment,
      ),
    ).toEqual(selectedRun)
  })

  describe("selectBestContractEnrollmentForLanguage", () => {
    test("surfaces older-run enrollment when next_run_id points at unenrolled newer run", () => {
      const oldRun = factories.courses.courseRun({
        id: 544,
        courseware_id: "course-v1:UAI+UAI.13+2025",
        courseware_url: "https://example.com/2025",
        is_enrollable: false,
      })
      const newRun = factories.courses.courseRun({
        id: 2325,
        courseware_id: "course-v1:UAI+UAI.13+2026",
        courseware_url: "https://example.com/2026",
        is_enrollable: true,
      })
      const course = factories.courses.course({
        courseruns: [oldRun, newRun],
        next_run_id: newRun.id,
        language_options: [
          {
            id: oldRun.id,
            courseware_id: oldRun.courseware_id,
            courseware_url: oldRun.courseware_url ?? "",
            language: "en",
            title: oldRun.title,
            run_tag: oldRun.run_tag,
          },
          {
            id: newRun.id,
            courseware_id: newRun.courseware_id,
            courseware_url: newRun.courseware_url ?? "",
            language: "en",
            title: newRun.title,
            run_tag: newRun.run_tag,
          },
        ],
      })

      const oldEnrollment = factories.enrollment.courseEnrollment({
        run: {
          id: oldRun.id,
          course: { id: course.id, title: course.title },
          title: oldRun.title,
          courseware_id: oldRun.courseware_id,
          courseware_url: oldRun.courseware_url,
        },
      })

      const result = selectBestContractEnrollmentForLanguage(
        course,
        [oldEnrollment],
        "",
      )

      expect(result?.run.id).toBe(oldRun.id)
    })

    test("returns null when user has no enrollment for the selected language", () => {
      const englishRun = factories.courses.courseRun({
        id: 1,
        courseware_id: "cw-en",
        is_enrollable: true,
      })
      const spanishRun = factories.courses.courseRun({
        id: 2,
        courseware_id: "cw-es",
        is_enrollable: true,
      })
      const course = factories.courses.course({
        courseruns: [englishRun, spanishRun],
        next_run_id: englishRun.id,
        language_options: [
          {
            id: englishRun.id,
            courseware_id: englishRun.courseware_id,
            courseware_url: englishRun.courseware_url ?? "",
            language: "en",
            title: englishRun.title,
            run_tag: englishRun.run_tag,
          },
          {
            id: spanishRun.id,
            courseware_id: spanishRun.courseware_id,
            courseware_url: spanishRun.courseware_url ?? "",
            language: "es",
            title: spanishRun.title,
            run_tag: spanishRun.run_tag,
          },
        ],
      })

      const spanishEnrollment = factories.enrollment.courseEnrollment({
        run: {
          id: spanishRun.id,
          course: { id: course.id, title: course.title },
          title: spanishRun.title,
          courseware_id: spanishRun.courseware_id,
        },
      })

      expect(
        selectBestContractEnrollmentForLanguage(
          course,
          [spanishEnrollment],
          "language:en",
        ),
      ).toBeNull()
    })

    test("falls back to legacy best enrollment on single-language courses when language-option run matching fails", () => {
      const languageRunA = factories.courses.courseRun({
        id: 101,
        courseware_id: "cw-en-a",
        is_enrollable: true,
      })
      const languageRunB = factories.courses.courseRun({
        id: 102,
        courseware_id: "cw-en-b",
        is_enrollable: true,
      })
      const enrolledRun = factories.courses.courseRun({
        id: 103,
        courseware_id: "cw-enrolled",
        is_enrollable: false,
      })

      const course = factories.courses.course({
        courseruns: [languageRunA, languageRunB, enrolledRun],
        next_run_id: languageRunA.id,
        language_options: [
          {
            id: languageRunA.id,
            courseware_id: languageRunA.courseware_id,
            courseware_url: languageRunA.courseware_url ?? "",
            language: "en",
            title: languageRunA.title,
            run_tag: languageRunA.run_tag,
          },
          {
            id: languageRunB.id,
            courseware_id: languageRunB.courseware_id,
            courseware_url: languageRunB.courseware_url ?? "",
            language: "en",
            title: languageRunB.title,
            run_tag: languageRunB.run_tag,
          },
        ],
      })

      const enrolledRunEnrollment = factories.enrollment.courseEnrollment({
        run: {
          id: enrolledRun.id,
          course: { id: course.id, title: course.title },
          title: enrolledRun.title,
          courseware_id: enrolledRun.courseware_id,
          courseware_url: enrolledRun.courseware_url,
        },
      })

      const result = selectBestContractEnrollmentForLanguage(
        course,
        [enrolledRunEnrollment],
        "",
      )

      expect(result?.run.id).toBe(enrolledRun.id)
    })

    test("prefers higher-graded enrollment when multiple match the language", () => {
      const olderRun = factories.courses.courseRun({
        id: 10,
        courseware_id: "cw-old",
      })
      const newerRun = factories.courses.courseRun({
        id: 20,
        courseware_id: "cw-new",
      })
      const course = factories.courses.course({
        courseruns: [olderRun, newerRun],
        next_run_id: newerRun.id,
        language_options: [
          {
            id: olderRun.id,
            courseware_id: olderRun.courseware_id,
            courseware_url: olderRun.courseware_url ?? "",
            language: "en",
            title: olderRun.title,
            run_tag: olderRun.run_tag,
          },
          {
            id: newerRun.id,
            courseware_id: newerRun.courseware_id,
            courseware_url: newerRun.courseware_url ?? "",
            language: "en",
            title: newerRun.title,
            run_tag: newerRun.run_tag,
          },
        ],
      })

      const newerEnrollment = factories.enrollment.courseEnrollment({
        run: {
          id: newerRun.id,
          course: { id: course.id, title: course.title },
          title: newerRun.title,
          courseware_id: newerRun.courseware_id,
        },
        grades: [factories.enrollment.grade({ grade: 0.4, passed: false })],
      })
      const olderEnrollment = factories.enrollment.courseEnrollment({
        run: {
          id: olderRun.id,
          course: { id: course.id, title: course.title },
          title: olderRun.title,
          courseware_id: olderRun.courseware_id,
        },
        grades: [factories.enrollment.grade({ grade: 0.95, passed: true })],
      })

      const result = selectBestContractEnrollmentForLanguage(
        course,
        [newerEnrollment, olderEnrollment],
        "language:en",
      )

      expect(result?.run.id).toBe(olderRun.id)
    })
  })
})
