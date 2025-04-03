import { factories as mitxOnlineFactories } from "api/mitxonline-test-utils"
import * as transform from "./transform"
import { DashboardResourceType, EnrollmentStatus } from "./types"
import type { DashboardResource } from "./types"

describe("Transforming mitxonline enrollment data to DashboardResource", () => {
  test.each([
    {
      grades: [{ passed: true }],
      enrollmentStatus: EnrollmentStatus.Completed,
    },
    {
      grades: [{ passed: false }],
      enrollmentStatus: EnrollmentStatus.Enrolled,
    },
    { grades: [], enrollmentStatus: EnrollmentStatus.Enrolled },
  ])(
    "Property renames and EnrollmentStatus",
    ({ grades, enrollmentStatus }) => {
      const apiData = mitxOnlineFactories.enrollment.courseEnrollment({
        grades,
      })
      const transformed = transform.mitxonlineEnrollments([apiData])
      expect(transformed).toHaveLength(1)
      expect(transformed[0]).toEqual({
        id: `mitxonline-course-${apiData.id}`,
        type: DashboardResourceType.Course,
        data: {
          marketingUrl: apiData.run.course.page.page_url,
          startDate: apiData.run.start_date,
          endDate: apiData.run.end_date,
          title: apiData.run.title,
          coursewareUrl: apiData.run.courseware_url,
          certificateUpgradeDeadline: apiData.run.upgrade_deadline,
          certificateUpgradePrice: apiData.run.products[0]?.price,
          hasUpgraded: apiData.enrollment_mode === "verified",
          enrollmentStatus,
          canUpgrade: expect.any(Boolean), // check this in a moment
        },
      } satisfies DashboardResource)
    },
  )

  test.each([
    {
      in: { enrollment_mode: "audit", run: { is_upgradable: true } },
      out: { hasUpgraded: true, canUpgrade: true },
    },
    {
      in: { enrollment_mode: "verified", run: { is_upgradable: true } },
      out: { hasUpgraded: true, canUpgrade: false },
    },
    {
      in: { run: { is_upgradable: false } },
      out: { canUpgrade: false },
    },
  ] as const)("canUpgrade is false if user already upgraded", (params) => {
    const apiData = mitxOnlineFactories.enrollment.courseEnrollment(params.in)
    const transformed = transform.mitxonlineEnrollments([apiData])
    expect(transformed).toHaveLength(1)
    expect(transformed[0].data.canUpgrade).toEqual(params.out.canUpgrade)
  })

  test("CertificateUpgradePrice is first price in prices array", () => {
    // Unclear why the mitxonline API has this as an array.
    const apiData = mitxOnlineFactories.enrollment.courseEnrollment({
      // @ts-expect-error not fully implementing product objects
      run: { products: [{ price: "10" }, { price: "20" }] },
    })
    const transformed = transform.mitxonlineEnrollments([apiData])
    expect(transformed).toHaveLength(1)
    expect(transformed[0].data.certificateUpgradePrice).toEqual("10")
  })
})
