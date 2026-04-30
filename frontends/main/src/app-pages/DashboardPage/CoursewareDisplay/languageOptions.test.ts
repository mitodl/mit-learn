import { factories } from "api/mitxonline-test-utils"
import {
  getDistinctLanguageOptions,
  getEnrollmentForSelectedLanguage,
  getLanguageOptionKey,
  getResolvedRunForSelectedLanguage,
  getSelectedLanguageOption,
} from "./languageOptions"

describe("languageOptions", () => {
  test("normalizes language keys", () => {
    expect(
      getLanguageOptionKey({
        id: 1,
        courseware_id: "cw-1",
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
    })
    const spanishRunA = factories.courses.courseRun({
      id: 102,
      title: "Espanol A",
      courseware_id: "cw-es-a",
    })
    const englishRunB = factories.courses.courseRun({
      id: 201,
      title: "English B",
      courseware_id: "cw-en-b",
    })
    const spanishRunB = factories.courses.courseRun({
      id: 202,
      title: "Espanol B",
      courseware_id: "cw-es-b",
    })
    const spanishRunC = factories.courses.courseRun({
      id: 302,
      title: "Espanol C",
      courseware_id: "cw-es-c",
    })
    const englishRunC = factories.courses.courseRun({
      id: 301,
      title: "English C",
      courseware_id: "cw-en-c",
    })

    const courseA = factories.courses.course({
      courseruns: [englishRunA, spanishRunA],
      next_run_id: englishRunA.id,
      language_options: [
        {
          id: englishRunA.id,
          courseware_id: englishRunA.courseware_id,
          language: "en",
          title: englishRunA.title,
          run_tag: englishRunA.run_tag,
        },
        {
          id: spanishRunA.id,
          courseware_id: spanishRunA.courseware_id,
          language: "es",
          title: spanishRunA.title,
          run_tag: spanishRunA.run_tag,
        },
        {
          id: 999,
          courseware_id: "cw-empty",
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
          language: "en",
          title: englishRunB.title,
          run_tag: englishRunB.run_tag,
        },
        {
          id: spanishRunB.id,
          courseware_id: spanishRunB.courseware_id,
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
          language: "en",
          title: englishRunC.title,
          run_tag: englishRunC.run_tag,
        },
        {
          id: spanishRunC.id,
          courseware_id: spanishRunC.courseware_id,
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

  test("matches selected enrollment by language option courseware id", () => {
    const englishRun = factories.courses.courseRun({
      id: 11,
      courseware_id: "cw-en",
    })
    const spanishRun = factories.courses.courseRun({
      id: 12,
      courseware_id: "cw-es",
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
        language: "es",
        title: spanishRun.title,
        run_tag: spanishRun.run_tag,
      },
      null,
    )

    expect(selectedEnrollment?.run.courseware_id).toBe(spanishRun.courseware_id)
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
          language: "en",
          title: templateRun.title,
          run_tag: templateRun.run_tag,
        },
        {
          id: spanishRun.id,
          courseware_id: spanishRun.courseware_id,
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

  test("synthetic language option without matching run resolves to null", () => {
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
          language: "en",
          title: nonEnrollableContractRun.title,
          run_tag: nonEnrollableContractRun.run_tag,
        },
        {
          id: 1003,
          courseware_id: "cw-contract-es-synthetic",
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
})
