import { factories } from "api/mitxonline-test-utils"
import type { EnrollmentMode } from "@mitodl/mitxonline-api-axios/v2"

const generateStayUpdatedTestFormId = () => {
  const cryptoUuid = globalThis.crypto?.randomUUID?.()
  if (cryptoUuid) return cryptoUuid

  return `stay-updated-test-${Math.random().toString(36).slice(2)}`
}

export const STAY_UPDATED_FORM_ID = generateStayUpdatedTestFormId()

/**
 * Sets the Stay Updated Hubspot form ID env var before each test and removes
 * it after. Call inside a describe block.
 */
export const useStayUpdatedEnv = () => {
  let previousFormId: string | undefined

  beforeEach(() => {
    previousFormId = process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID
    process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID = STAY_UPDATED_FORM_ID
  })

  afterEach(() => {
    if (previousFormId === undefined) {
      delete process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID
    } else {
      process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID = previousFormId
    }
  })
}

/**
 * Shared test.each cases for the "Stay Updated button is hidden" scenarios on
 * program-level enrollment_modes (used by ProgramPage and ProgramAsCoursePage).
 */
export const PROGRAM_HIDE_STAY_UPDATED_CASES: {
  label: string
  enrollment_modes: EnrollmentMode[]
}[] = [
  {
    label: "program has a non-verified enrollment mode",
    enrollment_modes: [
      factories.courses.enrollmentMode({ mode_slug: "audit" }),
    ],
  },
  {
    label: "program has mixed verified and non-verified modes",
    enrollment_modes: [
      factories.courses.enrollmentMode({ mode_slug: "verified" }),
      factories.courses.enrollmentMode({ mode_slug: "audit" }),
    ],
  },
  {
    label: "program has no enrollment modes",
    enrollment_modes: [],
  },
]
