import { factories } from "api/mitxonline-test-utils"
import type { EnrollmentMode } from "@mitodl/mitxonline-api-axios/v2"

export const STAY_UPDATED_FORM_ID = "4f423dc7-5b08-430b-a9fb-920b7f9597ed"

/**
 * Sets the Stay Updated Hubspot form ID env var before each test and removes
 * it after. Call inside a describe block.
 */
export const useStayUpdatedEnv = () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID = STAY_UPDATED_FORM_ID
  })
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID
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
