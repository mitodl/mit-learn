import { CourseRunEnrollment, EnrollmentModeEnum } from "api/mitxonline"

import { EnrollmentType } from "./types"
import type { EnrollmentData } from "./types"

const sources = {
  mitxonline: "mitxonline",
}

const mitxonlineCourseToEnrollment = (
  raw: CourseRunEnrollment,
): EnrollmentData => {
  return {
    id: `${sources.mitxonline}-${raw.id}`,
    type: EnrollmentType.Course,
    title: raw.run.title,
    startDate: raw.run.start_date,
    certificateUpgradeDeadline: raw.run.upgrade_deadline,
    certificateUpgradePrice: raw.run.products[0]?.price,
    hasUpgraded: raw.enrollment_mode === EnrollmentModeEnum.Verified,
    hasUserCompleted: !!raw.grades[0]?.passed,
    coursewareUrl: raw.run.courseware_url,
    marketingUrl: raw.run.course.page.page_url,
  }
}
const mitxonlineCoursesToEnrollment = (data: CourseRunEnrollment[]) =>
  data.map((course) => mitxonlineCourseToEnrollment(course))

export { mitxonlineCoursesToEnrollment }
