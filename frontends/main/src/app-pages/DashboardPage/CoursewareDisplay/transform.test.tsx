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
      const transformed = transform.mitxonlineEnrollments([apiData])
      expect(transformed).toHaveLength(1)
      expect(transformed[0]).toEqual({
        id: `mitxonline-course-${apiData.run.course.id}`,
        type: DashboardResourceType.Course,
        title: apiData.run.title,
        marketingUrl: apiData.run.course.page.page_url,
        run: {
          startDate: apiData.run.start_date,
          endDate: apiData.run.end_date,
          coursewareUrl: apiData.run.courseware_url,
          certificateUpgradeDeadline: apiData.run.upgrade_deadline,
          certificateUpgradePrice: apiData.run.products[0]?.price,
          canUpgrade: expect.any(Boolean), // check this in a moment
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
    const transformed = transform.mitxonlineEnrollments([apiData])
    expect(transformed).toHaveLength(1)
    expect(transformed[0].run.certificateUpgradePrice).toEqual("10")
  })

  test("sortDashboardCourses sorts courses by enrollment status and program order", () => {
    const { programA, coursesA } = setupProgramsAndCourses()

    const enrollments = [
      mitx.enrollment.courseEnrollment({
        run: { course: { id: coursesA[0].id } },
        grades: [mitx.enrollment.grade({ passed: true })],
        enrollment_mode: "audit",
      }),
      mitx.enrollment.courseEnrollment({
        run: { course: { id: coursesA[1].id } },
        grades: [],
        enrollment_mode: "verified",
      }),
    ]

    const sortedCourses = sortDashboardCourses(
      mitxonlineProgram(programA),
      mitxonlineCourses({ courses: coursesA, enrollments }),
    )

    expect(sortedCourses.map((course) => course.id)).toEqual([
      `mitxonline-course-${coursesA[1].id}`, // Enrolled course
      `mitxonline-course-${coursesA[0].id}`, // Completed course
      `mitxonline-course-${coursesA[2].id}`, // Not enrolled course
      `mitxonline-course-${coursesA[3].id}`, // Not enrolled course
    ])
  })
})
