import { factories as mitx } from "api/mitxonline-test-utils"
import * as transform from "./transform"
import { DashboardResourceType, EnrollmentStatus } from "./types"
import type { DashboardResource } from "./types"
import {
  mitxonlineCourses,
  mitxonlineProgram,
  sortDashboardCourses,
} from "./transform"
import { setupProgramsAndCourses } from "./test-utils"

describe("Transforming mitxonline enrollment data to DashboardResource", () => {
  test.each([
    {
      grades: [mitx.enrollment.grade({ passed: true })],
      enrollmentStatus: EnrollmentStatus.Completed,
    },
    {
      grades: [mitx.enrollment.grade({ passed: false })],
      enrollmentStatus: EnrollmentStatus.Enrolled,
    },
    { grades: [], enrollmentStatus: EnrollmentStatus.Enrolled },
  ])(
    "Property renames and EnrollmentStatus",
    ({ grades, enrollmentStatus }) => {
      const apiData = mitx.enrollment.courseEnrollment({
        grades,
      })
      const transformed = transform.mitxonlineEnrollmentsToDashboardCourses([
        apiData,
      ])
      expect(transformed).toHaveLength(1)
      expect(transformed[0]).toEqual({
        key: `mitxonline-course-${apiData.run.course.id}-${apiData.run.id}`,
        coursewareId: apiData.run.courseware_id ?? null,
        type: DashboardResourceType.Course,
        title: apiData.run.title,
        marketingUrl: apiData.run.course.page?.page_url,
        run: {
          startDate: apiData.run.start_date,
          endDate: apiData.run.end_date,
          coursewareUrl: apiData.run.courseware_url,
          certificateUpgradeDeadline: apiData.run.upgrade_deadline,
          certificateUpgradePrice: apiData.run.products[0]?.price,
          canUpgrade: expect.any(Boolean), // check this in a moment
          certificate: {
            uuid: apiData.certificate?.uuid ?? "",
            link: apiData.certificate?.link ?? "",
          },
        },
        enrollment: {
          id: apiData.id,
          status: enrollmentStatus,
          mode: apiData.enrollment_mode,
          receiveEmails: apiData.edx_emails_subscription,
        },
      } satisfies DashboardResource)
    },
  )

  test("CertificateUpgradePrice is first price in prices array", () => {
    // Unclear why the mitxonline API has this as an array.
    const apiData = mitx.enrollment.courseEnrollment({
      // @ts-expect-error not fully implementing product objects
      run: { products: [{ price: "10" }, { price: "20" }] },
    })
    const transformed = transform.mitxonlineEnrollmentsToDashboardCourses([
      apiData,
    ])
    expect(transformed).toHaveLength(1)
    expect(transformed[0].run.certificateUpgradePrice).toEqual("10")
  })

  test("sortDashboardCourses sorts courses by enrollment status and program order", () => {
    const { programA, coursesA } = setupProgramsAndCourses()

    const enrollments = [
      mitx.enrollment.courseEnrollment({
        run: {
          id: coursesA[0].courseruns[0].id,
          course: { id: coursesA[0].id },
        },
        grades: [mitx.enrollment.grade({ passed: true })],
        enrollment_mode: "audit",
      }),
      mitx.enrollment.courseEnrollment({
        run: {
          id: coursesA[1].courseruns[0].id,
          course: { id: coursesA[1].id },
        },
        grades: [],
        enrollment_mode: "verified",
      }),
    ]

    const transformedCourses = mitxonlineCourses({
      courses: coursesA,
      enrollments,
    })
    const sortedCourses = sortDashboardCourses(
      mitxonlineProgram(programA),
      transformedCourses,
    )

    const enrolledCourse = sortedCourses.find(
      (course) => course.enrollment?.status === EnrollmentStatus.Enrolled,
    )
    const completedCourse = sortedCourses.find(
      (course) => course.enrollment?.status === EnrollmentStatus.Completed,
    )
    const notEnrolledCourses = sortedCourses.filter(
      (course) =>
        !course.enrollment ||
        course.enrollment.status === EnrollmentStatus.NotEnrolled,
    )

    // Verify we found all expected courses
    expect(enrolledCourse).toBeDefined()
    expect(completedCourse).toBeDefined()
    expect(notEnrolledCourses).toHaveLength(2)

    // Verify sorting: enrolled first, then completed, then not enrolled
    expect(sortedCourses[0]).toEqual(enrolledCourse) // Enrolled course should be first
    expect(sortedCourses[1]).toEqual(completedCourse) // Completed course should be second
    expect(sortedCourses[2]).toEqual(notEnrolledCourses[0]) // First not enrolled course
    expect(sortedCourses[3]).toEqual(notEnrolledCourses[1]) // Second not enrolled course
  })
})
