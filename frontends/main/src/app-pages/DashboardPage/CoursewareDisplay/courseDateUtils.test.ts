import {
  canOpenCourseware,
  getRunTimeState,
  hasCourseStaffRole,
} from "./courseDateUtils"
import moment from "moment"

const future = moment().add(30, "days").toISOString()
const past = moment().subtract(30, "days").toISOString()

describe("getRunTimeState", () => {
  test.each([
    { startDate: future, endDate: null, expected: "upcoming" },
    { startDate: past, endDate: future, expected: "underway" },
    { startDate: past, endDate: past, expected: "ended" },
    { startDate: null, endDate: null, expected: "underway" },
  ])(
    "returns $expected for start=$startDate end=$endDate",
    ({ startDate, endDate, expected }) => {
      expect(getRunTimeState(startDate, endDate)).toBe(expected)
    },
  )
})

/**
 * Only the flag matters here, so the fixtures carry nothing else; the cast
 * stands in for a full enrollment rather than building one.
 */
const enrollmentWith = (flag?: boolean | null) =>
  ({ has_course_staff_role: flag }) as Parameters<typeof hasCourseStaffRole>[0]

describe("hasCourseStaffRole", () => {
  test.each([
    { label: "true", enrollment: enrollmentWith(true), expected: true },
    { label: "false", enrollment: enrollmentWith(false), expected: false },
    // Absent while the generated client lags mitxonline, and null-safe for the
    // sibling rows, which may have no enrollment yet.
    { label: "null", enrollment: enrollmentWith(null), expected: false },
    {
      label: "missing",
      enrollment: enrollmentWith(undefined),
      expected: false,
    },
    { label: "null enrollment", enrollment: null, expected: false },
    { label: "no enrollment", enrollment: undefined, expected: false },
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
    expect(canOpenCourseware(future, { hasCourseStaffRole: true })).toBe(true)
  })

  test("is closed for a learner who is neither", () => {
    expect(
      canOpenCourseware(future, { isStaff: false, hasCourseStaffRole: false }),
    ).toBe(false)
  })
})
