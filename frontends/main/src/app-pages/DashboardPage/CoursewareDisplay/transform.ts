/**
 * The mitxonline dashboard is expected to contain enrollment data from multiple
 * sources (mitxonline, xpro, ...). Here we transform the source data into
 * a common format.
 */

import {
  ContractPage,
  CourseRunEnrollmentRequestV2,
  CourseWithCourseRunsSerializerV2,
  V2Program,
  V2ProgramCollection,
} from "@mitodl/mitxonline-api-axios/v2"

import { DashboardResourceType, EnrollmentStatus } from "./types"
import type {
  DashboardContract,
  DashboardCourse,
  DashboardCourseEnrollment,
  DashboardProgram,
  DashboardProgramCollection,
} from "./types"
import { groupBy } from "lodash"

const sources = {
  mitxonline: "mitxonline",
}

const CERTIFICATE_LINK_PATTERN = /\/certificate\/([^/]+)\/$/

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

const mitxonlineCourse = (
  raw: CourseWithCourseRunsSerializerV2,
  enrollment?: DashboardCourseEnrollment | undefined,
): DashboardCourse => {
  const run = raw.courseruns[0]
  const transformedCourse = {
    key: getKey({
      source: sources.mitxonline,
      resourceType: DashboardResourceType.Course,
      id: raw.id,
      runId: run?.id,
    }),
    coursewareId: run?.courseware_id ?? null,
    type: DashboardResourceType.Course,
    title: raw.title,
    marketingUrl: raw.page?.page_url,
    run: {
      startDate: run?.start_date,
      endDate: run?.end_date,
      certificateUpgradeDeadline: run?.upgrade_deadline,
      certificateUpgradePrice: run?.products[0]?.price,
      coursewareUrl: run?.courseware_url,
      canUpgrade: !!run?.is_upgradable,
    },
  } as DashboardCourse

  if (enrollment) {
    transformedCourse.enrollment = enrollment
  }
  if (enrollment?.certificate) {
    transformedCourse.run.certificate = enrollment.certificate
  }
  return transformedCourse
}

const transformEnrollmentToDashboard = (
  raw: CourseRunEnrollmentRequestV2,
): DashboardCourseEnrollment => {
  return {
    id: raw.id,
    b2b_contract_id: raw.b2b_contract_id,
    b2b_organization_id: raw.b2b_organization_id,
    status:
      raw.grades.length > 0 && raw.grades[0]?.passed
        ? EnrollmentStatus.Completed
        : EnrollmentStatus.Enrolled,
    mode: raw.enrollment_mode,
    receiveEmails: raw.edx_emails_subscription ?? true,
    certificate: {
      uuid: raw.certificate?.uuid ?? "",
      link:
        raw.certificate?.link?.replace(
          CERTIFICATE_LINK_PATTERN,
          "/certificate/course/$1/",
        ) ?? "",
    },
  }
}

const filterEnrollmentsByOrganization = (
  enrollments: CourseRunEnrollmentRequestV2[],
  organizationId: number,
): CourseRunEnrollmentRequestV2[] => {
  return enrollments.filter(
    (enrollment) => enrollment.b2b_organization_id === organizationId,
  )
}

const userEnrollmentsToDashboardCourses = (
  data: CourseRunEnrollmentRequestV2[],
): DashboardCourse[] => {
  return data.map((enrollment) => {
    const course = enrollment.run.course
    const run = enrollment.run
    const dashboardEnrollment = transformEnrollmentToDashboard(enrollment)

    return {
      key: getKey({
        source: sources.mitxonline,
        resourceType: DashboardResourceType.Course,
        id: course.id,
        runId: run.id,
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
        canUpgrade: run?.is_upgradable,
        coursewareUrl: run?.courseware_url,
        certificate: dashboardEnrollment.certificate,
      },
      enrollment: dashboardEnrollment,
    }
  })
}

const mitxonlineOrgContract = (raw: ContractPage): DashboardContract => {
  return {
    id: raw.id,
    active: raw.active,
    contract_end: raw.contract_end,
    contract_start: raw.contract_start,
    description: raw.description,
    integration_type: raw.integration_type,
    name: raw.name,
    organization: raw.organization,
    slug: raw.slug,
  }
}

const enrollmentsToOrgDashboardEnrollments = (
  data: CourseRunEnrollmentRequestV2[],
): DashboardCourseEnrollment[] => data.map(transformEnrollmentToDashboard)

const createOrgUnenrolledCourse = (
  course: CourseWithCourseRunsSerializerV2,
  contracts: ContractPage[] | undefined,
): DashboardCourse => {
  const contractIds = contracts?.map((contract) => contract.id)
  const run = course.courseruns.find((run) => {
    return run.b2b_contract && contractIds?.includes(run.b2b_contract)
  })
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

const organizationCoursesWithContracts = (raw: {
  courses: CourseWithCourseRunsSerializerV2[]
  contracts?: ContractPage[] // Make optional
  enrollments: CourseRunEnrollmentRequestV2[]
}): DashboardCourse[] => {
  const enrollmentsByCourseId = groupBy(
    raw.enrollments,
    (enrollment) => enrollment.run.course.id,
  )

  // Get contract IDs for easy lookup
  const contractIds = raw.contracts?.map((contract) => contract.id) || []

  const transformedCourses = raw.courses.map((course) => {
    const enrollments = enrollmentsByCourseId[course.id]

    if (enrollments?.length > 0) {
      const transformedEnrollments =
        enrollmentsToOrgDashboardEnrollments(enrollments)
      if (raw.contracts && raw.contracts.length > 0) {
        // Filter enrollments to only include those with valid contracts
        const validEnrollments = transformedEnrollments.filter((enrollment) => {
          const courseRunContractId = enrollment.b2b_contract_id
          return (
            courseRunContractId && contractIds.includes(courseRunContractId)
          )
        })

        if (validEnrollments.length > 0) {
          const dashboardCourse = mitxonlineCourse(course, validEnrollments[0])
          return dashboardCourse
        }

        // If contracts are provided but a matching one isn't found, treat it as unenrolled
        return createOrgUnenrolledCourse(course, raw.contracts)
      } else if (enrollments?.length > 0) {
        // If no contracts provided, just find the matching enrollment to the course
        const matchingEnrollment = enrollments.find(
          (enrollment) =>
            course.courseruns.find((run) => run.id === enrollment.run.id)
              ?.id === enrollment.run.id,
        )
        if (matchingEnrollment) {
          return mitxonlineCourse(
            course,
            transformEnrollmentToDashboard(matchingEnrollment),
          )
        }
      }
    }

    // If no enrollments or no matching enrollment found, treat it as unenrolled
    return createOrgUnenrolledCourse(course, raw.contracts)
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
    programs: raw.programs,
  }
}

const sortDashboardCourses = (
  program: DashboardProgram,
  courses: DashboardCourse[],
) => {
  return [...courses].sort((a, b) => {
    const getStatusPriority = (course: DashboardCourse): number => {
      if (course.enrollment?.status === EnrollmentStatus.Enrolled) return 1
      if (course.enrollment?.status === EnrollmentStatus.Completed) return 2
      return 3 // Not enrolled or no enrollment
    }

    return getStatusPriority(a) - getStatusPriority(b)
  })
}

export {
  mitxonlineCourse,
  userEnrollmentsToDashboardCourses,
  transformEnrollmentToDashboard,
  mitxonlineOrgContract,
  enrollmentsToOrgDashboardEnrollments,
  organizationCoursesWithContracts,
  createOrgUnenrolledCourse,
  mitxonlineProgram,
  mitxonlineProgramCollection,
  sortDashboardCourses,
  filterEnrollmentsByOrganization,
}
