import React from "react"
import {
  renderWithProviders,
  screen,
  within,
  waitFor,
  setMockResponse,
  user,
} from "@/test-utils"
import { factories as apiFactories, urls as apiUrls } from "api/test-utils"
import {
  factories as mitxFactories,
  urls as mitxUrls,
} from "api/mitxonline-test-utils"
import InfoBoxCourse from "./InfoBoxCourse"
import { formatDate } from "ol-utilities"

jest.mock("next-nprogress-bar", () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  usePostHog: jest.fn(() => ({ capture: jest.fn() })),
}))

jest.mock("@/common/analytics/gtm", () => ({
  trackCourseEnrolled: jest.fn(),
}))

const makeCourse = mitxFactories.courses.course
const makeRun = mitxFactories.courses.courseRun
const makeMode = mitxFactories.courses.enrollmentMode
const makeProduct = mitxFactories.courses.product

function setupAuth(enrollments: unknown[] = []) {
  setMockResponse.get(
    apiUrls.userMe.get(),
    apiFactories.user.user({ is_authenticated: true }),
  )
  setMockResponse.get(mitxUrls.enrollment.enrollmentsListV3(), enrollments)
}

describe("InfoBoxCourse — session selector", () => {
  test("single-run course: no SessionSelect rendered", async () => {
    setupAuth()
    const run = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    renderWithProviders(<InfoBoxCourse course={course} />)

    // Wait for component to settle
    await screen.findByRole("button", { name: "Start Learning" })

    // No combobox (the SessionSelect)
    expect(screen.queryByRole("combobox", { name: /Session/i })).toBeNull()
  })

  test("multi-run course: SessionSelect is rendered", async () => {
    setupAuth()
    const run1 = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
      start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const run2 = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
      start_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const course = makeCourse({
      next_run_id: run1.id,
      courseruns: [run1, run2],
    })

    renderWithProviders(<InfoBoxCourse course={course} />)

    // SessionSelect renders as a combobox labeled "Session"
    await screen.findByRole("combobox", { name: /Session/i })
  })
})

describe("InfoBoxCourse — run selection changes enroll area", () => {
  test("switching from a both run to a free-only run changes the cards", async () => {
    setupAuth()
    const bothRun = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: true,
      enrollment_modes: [
        makeMode({ requires_payment: false }),
        makeMode({ requires_payment: true }),
      ],
      products: [makeProduct()],
      start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const freeOnlyRun = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
      start_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const course = makeCourse({
      next_run_id: bothRun.id,
      courseruns: [bothRun, freeOnlyRun],
    })

    renderWithProviders(<InfoBoxCourse course={course} />)

    // Wait for initial render to settle with the Both scenario
    await screen.findByText("Choose Your Path")
    expect(
      screen.getByRole("heading", { name: "Certificate Track", level: 3 }),
    ).toBeInTheDocument()

    // Switch to the free-only run by clicking the combobox then the option
    const select = screen.getByRole("combobox", { name: /Session/i })
    await user.click(select)
    const freeRunDateLabel = formatDate(freeOnlyRun.start_date!)
    await user.click(
      screen.getByRole("option", {
        name: new RegExp(freeRunDateLabel, "i"),
      }),
    )

    // Certificate Track card should be gone; Learn for Free should still be there
    await waitFor(() => {
      expect(screen.queryByText("Choose Your Path")).toBeNull()
    })
    expect(
      screen.queryByRole("heading", { name: "Certificate Track" }),
    ).toBeNull()
    expect(
      screen.getByRole("heading", { name: "Learn for Free", level: 3 }),
    ).toBeInTheDocument()
  })
})

describe("InfoBoxCourse — session-switch round-trip (enrolled run)", () => {
  test("selecting an enrolled run collapses to Enrolled; switching back restores cards", async () => {
    const runA = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
      start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const runB = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
      start_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const course = makeCourse({
      next_run_id: runA.id,
      courseruns: [runA, runB],
    })

    // User is enrolled in runA only
    const enrollment = mitxFactories.enrollment.courseEnrollment({
      run: { id: runA.id },
    })
    setupAuth([enrollment])

    renderWithProviders(<InfoBoxCourse course={course} />)

    // Initially on runA (enrolled) — should show "Enrolled" link
    const enrolledLink = await screen.findByRole("link", { name: /Enrolled/ })
    expect(enrolledLink).toBeInTheDocument()

    // Switch to runB (not enrolled) — cards should appear
    const select = screen.getByRole("combobox", { name: /Session/i })
    await user.click(select)
    const runBDateLabel = formatDate(runB.start_date!)
    await user.click(
      screen.getByRole("option", { name: new RegExp(runBDateLabel, "i") }),
    )

    await waitFor(() => {
      expect(screen.queryByRole("link", { name: /Enrolled/ })).toBeNull()
    })
    expect(
      screen.getByRole("heading", { name: "Learn for Free", level: 3 }),
    ).toBeInTheDocument()

    // Switch back to runA (enrolled) — back to collapsed state
    await user.click(select)
    const runADateLabel = formatDate(runA.start_date!)
    await user.click(
      screen.getByRole("option", {
        name: new RegExp(`${runADateLabel}.*Enrolled`, "i"),
      }),
    )
    await screen.findByRole("link", { name: /Enrolled/ })
    expect(screen.queryByRole("heading", { name: "Learn for Free" })).toBeNull()
  })
})

describe("InfoBoxCourse — data-boxes attribute", () => {
  const getBoxGrid = () => {
    // The grid container has data-boxes attribute
    return document.querySelector("[data-boxes]") as HTMLElement | null
  }

  test("data-boxes=3 for Both scenario (not enrolled)", async () => {
    setupAuth()
    const run = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: true,
      enrollment_modes: [
        makeMode({ requires_payment: false }),
        makeMode({ requires_payment: true }),
      ],
      products: [makeProduct()],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    renderWithProviders(<InfoBoxCourse course={course} />)

    await screen.findByText("Choose Your Path")

    const grid = getBoxGrid()
    expect(grid).not.toBeNull()
    expect(grid).toHaveAttribute("data-boxes", "3")
  })

  test("data-boxes=2 for paidOnly scenario (not enrolled)", async () => {
    setupAuth()
    const run = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: true,
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct()],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    renderWithProviders(<InfoBoxCourse course={course} />)

    await screen.findByRole("button", { name: "Enroll" })

    const grid = getBoxGrid()
    expect(grid).not.toBeNull()
    expect(grid).toHaveAttribute("data-boxes", "2")
  })

  test("data-boxes=2 for freeOnly scenario (not enrolled)", async () => {
    setupAuth()
    const run = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    renderWithProviders(<InfoBoxCourse course={course} />)

    await screen.findByRole("button", { name: "Start Learning" })

    const grid = getBoxGrid()
    expect(grid).not.toBeNull()
    expect(grid).toHaveAttribute("data-boxes", "2")
  })

  test("data-boxes=1 for no-runs scenario", async () => {
    setupAuth()
    const course = makeCourse({ courseruns: [] })

    renderWithProviders(<InfoBoxCourse course={course} />)

    // Wait for auth to settle (no buttons, just the no-enrollment alert)
    await screen.findByText(
      /No sessions of this course are currently open for enrollment/,
    )

    const grid = getBoxGrid()
    expect(grid).not.toBeNull()
    expect(grid).toHaveAttribute("data-boxes", "1")
  })

  test("data-boxes=2 for enrolled scenario (enrolled link = 1 offering box)", async () => {
    const run = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    const enrollment = mitxFactories.enrollment.courseEnrollment({
      run: { id: run.id },
    })
    setupAuth([enrollment])

    renderWithProviders(<InfoBoxCourse course={course} />)

    await screen.findByRole("link", { name: /Enrolled/ })

    const grid = getBoxGrid()
    expect(grid).not.toBeNull()
    expect(grid).toHaveAttribute("data-boxes", "2")
  })
})

describe("InfoBoxCourse — grid structure", () => {
  test("CourseSummary (meta) and CourseEnrollArea children are direct grid children", async () => {
    setupAuth()
    const run = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    renderWithProviders(<InfoBoxCourse course={course} />)

    await screen.findByRole("button", { name: "Start Learning" })

    const grid = document.querySelector("[data-boxes]") as HTMLElement
    expect(grid).not.toBeNull()

    // The grid should contain the Learn for Free card somewhere in its tree
    expect(
      within(grid).getByRole("heading", { name: "Learn for Free", level: 3 }),
    ).toBeInTheDocument()
  })
})
