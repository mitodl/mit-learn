const EnrollmentType = {
  Course: "course",
  Program: "program",
} as const
type EnrollmentType = (typeof EnrollmentType)[keyof typeof EnrollmentType]

type EnrollmentData = {
  type: EnrollmentType
  title: string
  id: string
  /**
   * Date at which course starts
   */
  startDate?: string | null
  /**
   * End Date of the course
   */
  endDate?: string | null
  /**
   * Date before which user can upgrade
   */
  certificateUpgradeDeadline?: string | null
  /**
   * Cost to upgrade to verified certificate
   */
  certificateUpgradePrice?: string | null
  /**
   * Whether user has upgraded to verified certificate
   */
  hasUpgraded: boolean
  /**
   * Whether user can upgrade to verified certificate
   * (e.g., upgrade may be disabled after a certain date, or user may have
   * already upgraded)
   */
  canUpgrade: boolean
  /**
   * Whether user has completed the course
   */
  hasUserCompleted: boolean
  /**
   * URL to courseware
   */
  coursewareUrl: string | null
  /**
   * URL to marketing page
   */
  marketingUrl: string
}

export { EnrollmentType }
export type { EnrollmentData }
