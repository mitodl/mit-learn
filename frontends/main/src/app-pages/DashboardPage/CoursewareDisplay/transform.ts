/**
 * The mitxonline dashboard is expected to contain enrollment data from multiple
 * sources (mitxonline, xpro, ...). Here we transform the source data into
 * a common format.
 */

import {
  CourseRunEnrollment,
  CourseWithCourseRuns,
  V2Program,
} from "api/mitxonline"

import { DashboardResourceType, EnrollmentStatus } from "./types"
import type { DashboardCourse, DashboardProgram } from "./types"
import { groupBy } from "lodash"

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

const mitxonlineUnenrolledCourse = (
  course: CourseWithCourseRuns,
): DashboardCourse => {
  const run = course.courseruns.find((run) => run.id === course.next_run_id)
  return {
    id: getId(sources.mitxonline, DashboardResourceType.Course, course.id),
    type: DashboardResourceType.Course,
    title: course.title,
    marketingUrl: course.page.page_url,
    run: {
      startDate: run?.start_date,
      endDate: run?.end_date,
      certificateUpgradeDeadline: run?.upgrade_deadline,
      certificateUpgradePrice: run?.products[0]?.price,
      coursewareUrl: run?.courseware_url,
      canUpgrade: !!run?.is_upgradable,
    },
  }
}

const mitxonlineCourses = (raw: {
  courses: CourseWithCourseRuns[]
  enrollments: CourseRunEnrollment[]
}) => {
  const enrollmentsByCourseId = groupBy(
    raw.enrollments,
    (enrollment) => enrollment.run.course.id,
  )
  const transformedCourses = raw.courses.map((course) => {
    const enrollments = enrollmentsByCourseId[course.id]
    if (enrollments?.length > 0) {
      const transformed = mitxonlineEnrollments(enrollments)
      const completed = transformed.find(
        (e) => e.enrollment?.status === EnrollmentStatus.Completed,
      )
      if (completed) {
        return completed
      }
      return transformed[0]
    }
    return mitxonlineUnenrolledCourse(course)
  })
  return transformedCourses
}

const mitxonlineProgram = (raw: V2Program): DashboardProgram => {
  return {
    id: getId(sources.mitxonline, DashboardResourceType.Program, raw.id),
    type: DashboardResourceType.Program,
    title: raw.title,
    programType: raw.program_type,
    courseIds: raw.courses,
    description: raw.page.description,
  }
}

const sortDashboardCourses = (
  program: DashboardProgram,
  courses: DashboardCourse[],
) => {
  return courses.sort((a, b) => {
    const aCompleted = a.enrollment?.status === EnrollmentStatus.Completed
    const bCompleted = b.enrollment?.status === EnrollmentStatus.Completed
    const aEnrolled = a.enrollment?.status === EnrollmentStatus.Enrolled
    const bEnrolled = b.enrollment?.status === EnrollmentStatus.Enrolled
    if (aEnrolled && !bEnrolled) {
      return -1
    }
    if (!aEnrolled && bEnrolled) {
      return 1
    }
    if (aCompleted && !bCompleted) {
      return -1
    }
    if (!aCompleted && bCompleted) {
      return 1
    }
    return (
      program.courseIds.findIndex(
        (id) =>
          getId(sources.mitxonline, DashboardResourceType.Course, id) === a.id,
      ) -
      program.courseIds.findIndex(
        (id) =>
          getId(sources.mitxonline, DashboardResourceType.Course, id) === b.id,
      )
    )
  })
}

export {
  mitxonlineEnrollments,
  mitxonlineCourses,
  mitxonlineProgram,
  sortDashboardCourses,
}
