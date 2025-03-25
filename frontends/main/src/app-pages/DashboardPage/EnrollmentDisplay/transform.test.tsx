import { factories as mitxOnlineFactories } from "api/mitxonline-test-utils"
import * as transform from "./transform"
import { EnrollmentData, EnrollmentType } from "./types"

describe("Transforming mitxonline data to EnrollmentData", () => {
  test("Property renames", () => {
    const apiData = mitxOnlineFactories.enrollment.courseEnrollment()
    const transformed = transform.mitxonlineCoursesToEnrollment([apiData])
    expect(transformed).toHaveLength(1)
    expect(transformed[0]).toEqual({
      hasUserCompleted: !!apiData.grades[0]?.passed,
      id: `mitxonline-${apiData.id}`,
      marketingUrl: apiData.run.course.page.page_url,
      startDate: apiData.run.start_date,
      endDate: apiData.run.end_date,
      title: apiData.run.title,
      type: EnrollmentType.Course,
      coursewareUrl: apiData.run.courseware_url,
      certificateUpgradeDeadline: apiData.run.upgrade_deadline,
      certificateUpgradePrice: apiData.run.products[0]?.price,
      hasUpgraded: apiData.enrollment_mode === "verified",
      canUpgrade: expect.any(Boolean), // check this in a moment
    } satisfies EnrollmentData)
  })

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
    const transformed = transform.mitxonlineCoursesToEnrollment([apiData])
    expect(transformed).toHaveLength(1)
    expect(transformed[0].canUpgrade).toEqual(params.out.canUpgrade)
  })

  test("CertificateUpgradePrice is first price in prices array", () => {
    // Unclear why the mitxonline API has this as an array.
    const apiData = mitxOnlineFactories.enrollment.courseEnrollment({
      // @ts-expect-error not fully implementing product objects
      run: { products: [{ price: "10" }, { price: "20" }] },
    })
    const transformed = transform.mitxonlineCoursesToEnrollment([apiData])
    expect(transformed).toHaveLength(1)
    expect(transformed[0].certificateUpgradePrice).toEqual("10")
  })
})
