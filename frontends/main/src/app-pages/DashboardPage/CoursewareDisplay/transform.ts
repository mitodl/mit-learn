/**
 * The mitxonline dashboard is expected to contain enrollment data from multiple
 * sources (mitxonline, xpro, ...). Here we transform the source data into
 * a common format.
 */

import { CourseRunEnrollment } from "api/mitxonline"

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
  const course = raw.run.course
  return {
    id: getId(sources.mitxonline, DashboardResourceType.Course, course.id),
    type: DashboardResourceType.Course,
    title: course.title,
    marketingUrl: course.page.page_url,
    run: {
      startDate: raw.run.start_date,
      endDate: raw.run.end_date,
      certificateUpgradeDeadline: raw.run.upgrade_deadline,
      certificateUpgradePrice: raw.run.products[0]?.price,
      canUpgrade: raw.run.is_upgradable,
      coursewareUrl: raw.run.courseware_url,
    },
    enrollment: {
      mode: raw.enrollment_mode,
      status: raw.grades[0]?.passed
        ? EnrollmentStatus.Completed
        : EnrollmentStatus.Enrolled,
    },
  }
}
const mitxonlineEnrollments = (data: CourseRunEnrollment[]) =>
  data.map((course) => mitxonlineEnrollment(course))

export { mitxonlineEnrollments }
