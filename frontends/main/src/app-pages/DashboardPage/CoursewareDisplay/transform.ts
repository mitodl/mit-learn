/**
 * The mitxonline dashboard is expected to contain enrollment data from multiple
 * sources (mitxonline, xpro, ...). Here we transform the source data into
 * a common format.
 */

import {
  CourseRunEnrollment,
  V2CourseWithCourseRuns,
  V2Program,
  V2ProgramCollection,
} from "@mitodl/mitxonline-api-axios/v1"

import { DashboardResourceType, EnrollmentStatus } from "./types"
import type {
  DashboardCourse,
  DashboardProgram,
  DashboardProgramCollection,
} from "./types"
import { groupBy } from "lodash"

const sources = {
  mitxonline: "mitxonline",
}
type KeyOpts = {
  source: string
  resourceType: DashboardResourceType
  id: number
  runId?: number
}
const getKey = ({ source, resourceType, id, runId }: KeyOpts) => {
  const base = `${source}-${resourceType}-${id}`
  return runId ? `${base}-${runId}` : base
}

const mitxonlineEnrollment = (raw: CourseRunEnrollment): DashboardCourse => {
  const course = raw.run.course
  return {
    key: getKey({
      source: sources.mitxonline,
      resourceType: DashboardResourceType.Course,
      id: course.id,
      runId: raw.run.id,
    }),
    coursewareId: raw.run.courseware_id ?? null,
    type: DashboardResourceType.Course,
    title: course.title,
    marketingUrl: course.page?.page_url,
    run: {
      startDate: raw.run.start_date,
      endDate: raw.run.end_date,
      certificateUpgradeDeadline: raw.run.upgrade_deadline,
      certificateUpgradePrice: raw.run.products[0]?.price,
      canUpgrade: raw.run.is_upgradable,
      coursewareUrl: raw.run.courseware_url,
    },
    enrollment: {
      id: raw.id,
      mode: raw.enrollment_mode,
      status: raw.grades[0]?.passed
        ? EnrollmentStatus.Completed
        : EnrollmentStatus.Enrolled,
      receiveEmails: raw.edx_emails_subscription ?? true,
    },
  }
}
const mitxonlineEnrollments = (data: CourseRunEnrollment[]) =>
  data.map((course) => mitxonlineEnrollment(course))

const mitxonlineUnenrolledCourse = (
  course: V2CourseWithCourseRuns,
): DashboardCourse => {
  const run = course.courseruns.find((run) => run.id === course.next_run_id)
  return {
    key: getKey({
      source: sources.mitxonline,
      resourceType: DashboardResourceType.Course,
      id: course.id,
      runId: run?.id,
    }),
    coursewareId: run?.courseware_id ?? null,
    type: DashboardResourceType.Course,
    title: course.title,
    marketingUrl: course.page?.page_url,
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
  courses: V2CourseWithCourseRuns[]
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
    id: raw.id,
    key: getKey({
      source: sources.mitxonline,
      resourceType: DashboardResourceType.Program,
      id: raw.id,
    }),
    type: DashboardResourceType.Program,
    title: raw.title,
    programType: raw.program_type,
    courseIds: raw.courses,
    collections: raw.collections,
    description: raw.page.description,
  }
}

const mitxonlineProgramCollection = (
  raw: V2ProgramCollection,
): DashboardProgramCollection => {
  return {
    id: raw.id,
    type: DashboardResourceType.ProgramCollection,
    title: raw.title,
    description: raw.description ?? null,
    programIds: raw.programs,
  }
}

const sortDashboardCourses = (
  program: DashboardProgram,
  courses: DashboardCourse[],
) => {
  return [...courses].sort((a, b) => {
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
    return 0
  })
}

export {
  mitxonlineEnrollments,
  mitxonlineCourses,
  mitxonlineProgram,
  mitxonlineProgramCollection,
  sortDashboardCourses,
}
