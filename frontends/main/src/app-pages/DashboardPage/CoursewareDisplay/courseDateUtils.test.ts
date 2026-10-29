import { canOpenCourseware, hasCourseStaffRole } from "./courseDateUtils"
import moment from "moment"
import * as mitxonline from "api/mitxonline-test-utils"

const future = moment().add(30, "days").toISOString()
const past = moment().subtract(30, "days").toISOString()

/**
 * A real enrollment with the flag spread on top. Built from the factory rather
 * than cast from a bare object, so a required field going missing is a type
 * error here rather than something these tests quietly tolerate.
 */
const enrollmentWith = (flag: boolean) => ({
  ...mitxonline.factories.enrollment.courseEnrollment(),
  has_course_staff_role: flag,
})

describe("hasCourseStaffRole", () => {
  test.each([
    { label: "true", enrollment: enrollmentWith(true), expected: true },
    { label: "false", enrollment: enrollmentWith(false), expected: false },
  ])("reads $label as $expected", ({ enrollment, expected }) => {
    expect(hasCourseStaffRole(enrollment)).toBe(expected)
  })
})

describe("canOpenCourseware", () => {
  test("is open once the run has started", () => {
    expect(canOpenCourseware(past)).toBe(true)
  })

  test("is closed before the run starts", () => {
    expect(canOpenCourseware(future)).toBe(false)
  })

  test("is open before the run starts for mitxonline site staff", () => {
    expect(canOpenCourseware(future, { isStaff: true })).toBe(true)
  })

  /**
   * Open edX lets a course staff or instructor on the run into the courseware
   * before it starts, whether or not they are site staff, so the dashboard has
   * to offer the link to them too.
   */
  test("is open before the run starts for course staff", () => {
    expect(canOpenCourseware(future, { isCourseStaff: true })).toBe(true)
  })

  test("is closed for a learner who is neither", () => {
    expect(
      canOpenCourseware(future, { isStaff: false, isCourseStaff: false }),
    ).toBe(false)
  })
})
