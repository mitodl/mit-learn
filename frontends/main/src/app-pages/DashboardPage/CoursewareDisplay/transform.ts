/**
 * The mitxonline dashboard is expected to contain enrollment data from multiple
 * sources (mitxonline, xpro, ...). Here we transform the source data into
 * a common format.
 */

import { CourseRunEnrollment, EnrollmentModeEnum } from "api/mitxonline"

import { DashboardResourceType, EnrollmentStatus } from "./types"
import type { DashboardCourse } from "./types"

const sources = {
  mitxonline: "mitxonline",
}
const getId = (
  source: string,
  resourceType: DashboardResourceType,
  id: number,
) => `${source}-${resourceType}-${id}`

const mitxonlineEnrollment = (raw: CourseRunEnrollment): DashboardCourse => {
  const hasUpgraded = raw.enrollment_mode === EnrollmentModeEnum.Verified
  return {
    id: getId(sources.mitxonline, DashboardResourceType.Course, raw.id),
    type: DashboardResourceType.Course,
    data: {
      title: raw.run.title,
      startDate: raw.run.start_date,
      endDate: raw.run.end_date,
      certificateUpgradeDeadline: raw.run.upgrade_deadline,
      certificateUpgradePrice: raw.run.products[0]?.price,
      hasUpgraded,
      canUpgrade: raw.run.is_upgradable && !hasUpgraded,
      enrollmentStatus: raw.grades[0]?.passed
        ? EnrollmentStatus.Completed
        : EnrollmentStatus.Enrolled,
      coursewareUrl: raw.run.courseware_url,
      marketingUrl: raw.run.course.page.page_url,
    },
  }
}
const mitxonlineEnrollments = (data: CourseRunEnrollment[]) =>
  data.map((course) => mitxonlineEnrollment(course))

export { mitxonlineEnrollments }
