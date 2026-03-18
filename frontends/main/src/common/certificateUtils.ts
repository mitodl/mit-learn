import type { V2CourseRunCertificate } from "@mitodl/mitxonline-api-axios/v2"

const WALMART_SPOC_READABLE_ID_FRAGMENT = "SCx_WM"

/**
 * Determines whether a course certificate belongs to a SPOC (Small Private
 * Online Course) and returns the appropriate program name for display.
 */
export const getCourseSpocInfo = (
  certificate: V2CourseRunCertificate,
): {
  isSpoc: boolean
  programName: string
  displayType: string
  shortDisplayType: string
} => {
  const isSpoc =
    certificate.course_run.course.readable_id?.includes(
      WALMART_SPOC_READABLE_ID_FRAGMENT,
    ) ?? false

  const programName = isSpoc
    ? "MIT CTL Supply Chain Education Program"
    : "Universal Artificial Intelligence"

  const displayType = isSpoc ? "Certificate" : "Module Certificate"
  const shortDisplayType = isSpoc ? "" : "module"
  return { isSpoc, programName, displayType, shortDisplayType }
}
