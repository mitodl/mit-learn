import * as mitxonline from "api/mitxonline-test-utils"
import { mitxonlineLegacyUrl } from "@/common/mitxonline"
import { DashboardType, getContextMenuItems } from "./ModuleCard"

const EnrollmentMode = {
  Audit: "audit",
  Verified: "verified",
} as const

describe("ModuleCard context menu receipt item", () => {
  test("shows Receipt item for verified enrollment", () => {
    const course = mitxonline.factories.courses.course()
    const run = mitxonline.factories.courses.courseRun({ id: 42 })
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Verified,
      run: { ...run, course },
    })

    const items = getContextMenuItems("Test Course", {
      type: DashboardType.CourseRunEnrollment,
      data: enrollment,
    })

    expect(items.some((item) => item.label === "Receipt")).toBe(true)
  })

  test("does not show Receipt item for audit enrollment", () => {
    const course = mitxonline.factories.courses.course()
    const run = mitxonline.factories.courses.courseRun({ id: 42 })
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Audit,
      run: { ...run, course },
    })

    const items = getContextMenuItems("Test Course", {
      type: DashboardType.CourseRunEnrollment,
      data: enrollment,
    })

    expect(items.some((item) => item.label === "Receipt")).toBe(false)
  })

  test("Receipt item opens the expected MITx Online URL", () => {
    const course = mitxonline.factories.courses.course()
    const run = mitxonline.factories.courses.courseRun({ id: 42 })
    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      enrollment_mode: EnrollmentMode.Verified,
      run: { ...run, course },
    })
    const windowOpenSpy = jest
      .spyOn(window, "open")
      .mockImplementation(() => null)

    const items = getContextMenuItems("Test Course", {
      type: DashboardType.CourseRunEnrollment,
      data: enrollment,
    })
    const receiptItem = items.find((item) => item.label === "Receipt")

    receiptItem?.onClick?.()

    expect(windowOpenSpy).toHaveBeenCalledWith(
      mitxonlineLegacyUrl("/orders/receipt/by-run/42/"),
      "_blank",
    )
    windowOpenSpy.mockRestore()
  })
})
