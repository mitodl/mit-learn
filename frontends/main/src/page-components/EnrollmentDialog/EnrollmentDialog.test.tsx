import React from "react"
import { act } from "@testing-library/react"
import {
  screen,
  waitFor,
  renderWithProviders,
  user,
  setupLocationMock,
} from "@/test-utils"
import { makeRequest, setMockResponse } from "api/test-utils"
import {
  urls as mitxUrls,
  factories as mitxFactories,
} from "api/mitxonline-test-utils"
import type {
  CourseWithCourseRunsSerializerV2,
  V2Program,
} from "@mitodl/mitxonline-api-axios/v2"
import NiceModal from "@ebay/nice-modal-react"
import EnrollmentDialog from "./EnrollmentDialog"
import { upgradeRunUrl } from "@/common/mitxonline"
import { faker } from "@faker-js/faker/locale/en"
import invariant from "tiny-invariant"

const makeCourseRun = mitxFactories.courses.courseRun
const makeProduct = mitxFactories.courses.product
const makeCourse = mitxFactories.courses.course

const enrollableRun: typeof makeCourseRun = (overrides) =>
  makeCourseRun({
    is_enrollable: true,
    enrollment_start: faker.date.past().toISOString(),
    enrollment_end: faker.date.future().toISOString(),
    ...overrides,
  })

const upgradeableRun: typeof makeCourseRun = (overrides) =>
  makeCourseRun({
    is_upgradable: true,
    is_enrollable: true,
    is_archived: false,
    products: [mitxFactories.courses.product()],
    ...overrides,
  })

/**
 * Helper to open the enrollment dialog
 */
const openDialog = async (course: CourseWithCourseRunsSerializerV2) => {
  await act(async () => {
    NiceModal.show(EnrollmentDialog, { type: "course", resource: course })
  })
  return await screen.findByRole("dialog")
}

describe("EnrollmentDialog (Courses)", () => {
  setupLocationMock()

  describe("Course run dropdown", () => {
    test("Shows one entry for each enrollable course run", async () => {
      const run1 = enrollableRun()
      const run2 = enrollableRun()
      const run3 = enrollableRun()
      const course = makeCourse({ courseruns: [run1, run2, run3] })

      renderWithProviders(null)
      await openDialog(course)

      const select = screen.getByRole("combobox", { name: /choose a date/i })
      await user.click(select)

      const options = await screen.findAllByRole("option")
      // Should have 4 options: 1 "Please Select" + 3 course runs
      expect(options).toHaveLength(4)

      // Verify the actual run options (excluding "Please Select")
      const runOptions = options.slice(1)
      expect(runOptions).toHaveLength(3)
    })

    test("Does NOT include non-enrollable course runs in dropdown", async () => {
      const run1 = enrollableRun()
      const nonEnrollableRun = makeCourseRun({ is_enrollable: false })
      const archivedRun = makeCourseRun({
        is_archived: true,
        is_enrollable: true,
      })
      const course = makeCourse({
        courseruns: [run1, nonEnrollableRun, archivedRun],
      })

      renderWithProviders(<div />)
      await openDialog(course)

      const select = screen.getByRole("combobox", { name: /choose a date/i })
      await user.click(select)

      const options = await screen.findAllByRole("option")
      expect(options).toHaveLength(3) // 1 "Please Select" + 2 enrollable runs
    })

    test("Course run label indicates whether certificate upgrade is available", async () => {
      const run1 = upgradeableRun({
        start_date: "2024-01-01T00:00:00Z",
        end_date: "2024-06-01T00:00:00Z",
      })
      const nonUpgradableRun = enrollableRun({
        start_date: "2024-07-01T00:00:00Z",
        end_date: "2024-12-01T00:00:00Z",
        is_upgradable: false,
      })
      const course = makeCourse({ courseruns: [run1, nonUpgradableRun] })

      renderWithProviders(<div />)
      await openDialog(course)

      const select = screen.getByRole("combobox", { name: /choose a date/i })
      await user.click(select)

      // Verify upgradable run does NOT have "(No certificate available)" text
      const options = await screen.findAllByRole("option")
      expect(options.map((opt) => opt.textContent)).toEqual([
        "Please Select",
        "Jan 1, 2024 - Jun 1, 2024",
        "Jul 1, 2024 - Dec 1, 2024 (No certificate available)",
      ])
    })
  })

  describe("Certificate upgrade display", () => {
    test("When upgradeable run is chosen, upgrade button is enabled with price and deadline", async () => {
      const run = upgradeableRun({
        upgrade_deadline: "2024-02-15T00:00:00Z",
        products: [makeProduct({ price: "149.00" })],
      })
      const course = makeCourse({ courseruns: [run] })

      renderWithProviders(<div />)
      await openDialog(course)

      // The single run should be auto-selected
      const certificatePrice = await screen.findByText(/Get Certificate: \$149/)
      expect(certificatePrice).toBeInTheDocument()

      // Check for deadline text (date format may vary)
      const deadline = screen.getByText(/Payment due:/)
      expect(deadline).toBeInTheDocument()

      const upgradeButton = screen.getByRole("button", {
        name: /Add to Cart.*to get a Certificate/i,
      })
      expect(upgradeButton).toBeEnabled()
    })

    test("When non-upgradeable run is chosen, upgrade display is disabled with appropriate text", async () => {
      const nonUpgradableRun = enrollableRun({
        is_upgradable: false,
        products: [],
      })
      const run2 = upgradeableRun()
      const course = makeCourse({ courseruns: [nonUpgradableRun, run2] })

      renderWithProviders(<div />)
      await openDialog(course)

      // Select the non-upgradable run
      const select = screen.getByRole("combobox", { name: /choose a date/i })
      await user.click(select)

      const nonUpgradableOption = screen.getByRole("option", {
        name: /No certificate available/i,
      })
      await user.click(nonUpgradableOption)

      // Should show "Not available" text
      const notAvailable = await screen.findByText("Not available")
      expect(notAvailable).toBeInTheDocument()

      // Upgrade button should be disabled
      const upgradeButton = screen.getByRole("button", {
        name: /Add to Cart.*to get a Certificate/i,
      })
      expect(upgradeButton).toBeDisabled()
    })
  })

  describe("Initial run selection", () => {
    test("If exactly 1 enrollable run exists, it is initially chosen", async () => {
      const singleRun = enrollableRun({
        start_date: "2024-01-01T00:00:00Z",
        end_date: "2024-06-01T00:00:00Z",
      })
      const course = makeCourse({ courseruns: [singleRun] })

      renderWithProviders(<div />)
      await openDialog(course)

      const select = screen.getByRole("combobox", { name: /choose a date/i })
      expect(select).toHaveTextContent(/Jan 1, 2024 - Jun 1, 2024/i)

      // The enroll button should be enabled
      const enrollButton = screen.getByRole("button", {
        name: /Enroll for Free without a certificate/i,
      })
      expect(enrollButton).toBeEnabled()
    })

    test("If multiple enrollable runs exist, none is initially chosen", async () => {
      const run1 = enrollableRun()
      const run2 = enrollableRun()
      const course = makeCourse({ courseruns: [run1, run2] })

      renderWithProviders(<div />)
      await openDialog(course)

      // The select should show "Please Select" (check the hidden input)
      const select = screen.getByRole("combobox", { name: /choose a date/i })
      expect(select).toHaveTextContent(/please select/i)

      // The enroll button should be disabled
      const enrollButton = screen.getByRole("button", {
        name: /Enroll for Free without a certificate/i,
      })
      expect(enrollButton).toBeDisabled()
    })

    test("Initial selection is reset when dialog is reopened", async () => {
      const run1 = enrollableRun()
      const run2 = enrollableRun()
      const course = makeCourse({ courseruns: [run1, run2] })

      renderWithProviders(<div />)

      // First open: no initial selection with multiple runs
      await openDialog(course)
      const select = screen.getByRole("combobox", { name: /choose a date/i })
      expect(select).toHaveTextContent(/please select/i)

      // Select an option
      await user.click(select)
      const options = screen.getAllByRole("option")
      await user.click(options[1]) // Select first run (index 0 is "Please Select")

      // Close the dialog
      const closeButton = screen.getByRole("button", { name: /close/i })
      await user.click(closeButton)
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      })

      // Reopen the dialog
      await openDialog(course)

      // Verify selection is reset to "Please Select"
      const reopenedSelect = screen.getByRole("combobox", {
        name: /choose a date/i,
      })
      expect(reopenedSelect).toHaveTextContent(/please select/i)
    })
  })

  describe("Enrollment and upgrade actions", () => {
    test("Clicking enrollment button submits enrollment form", async () => {
      const run = enrollableRun()
      const course = makeCourse({ courseruns: [run] })

      renderWithProviders(<div />)
      await openDialog(course)

      const enrollButton = screen.getByRole("button", {
        name: /Enroll for Free without a certificate/i,
      })

      expect(enrollButton).toBeEnabled()

      setMockResponse.post(mitxUrls.enrollment.enrollmentsListV2(), {})
      await user.click(enrollButton)

      await waitFor(() => {
        expect(makeRequest).toHaveBeenCalledWith(
          "post",
          mitxUrls.enrollment.enrollmentsListV2(),
          { run_id: run.id },
        )
      })
    })

    test("Clicking upgrade button redirects to MITxOnline cart with correct URL", async () => {
      const assign = jest.mocked(window.location.assign)

      const run = upgradeableRun()
      const product = run.products[0]
      invariant(product, "Upgradeable run must have a product")
      const course = mitxFactories.courses.course({ courseruns: [run] })

      renderWithProviders(<div />)
      await openDialog(course)

      const upgradeButton = screen.getByRole("button", {
        name: /Add to Cart.*to get a Certificate/i,
      })

      // Verify the button is enabled before clicking
      expect(upgradeButton).toBeEnabled()

      await user.click(upgradeButton)

      // Verify redirect URL includes product_id parameter
      await waitFor(() => {
        expect(assign).toHaveBeenCalledWith(upgradeRunUrl(product))
      })
    })
  })
})

describe("EnrollmentDialog (Programs)", () => {
  setupLocationMock()

  const makeProgram = mitxFactories.programs.program

  const COURSE_PAGE_SIZE = 100
  const setupCourseApis = (courses: CourseWithCourseRunsSerializerV2[]) => {
    setMockResponse.get(
      mitxUrls.courses.coursesList({
        id: courses.map((course) => course.id),
        page_size: COURSE_PAGE_SIZE,
      }),
      {
        results: courses,
        count: courses.length,
        next: null,
        previous: null,
      },
    )
  }

  /**
   * Helper to open the program enrollment dialog
   */
  const openProgramDialog = async (program: V2Program) => {
    await act(async () => {
      NiceModal.show(EnrollmentDialog, { type: "program", resource: program })
    })
    return await screen.findByRole("dialog")
  }

  describe("Dialog title and basic display", () => {
    test("Dialog opens with program title", async () => {
      const program = makeProgram({ title: "Test Program Title" })
      setupCourseApis([])

      renderWithProviders(null)
      await openProgramDialog(program)

      expect(screen.getByRole("dialog")).toBeInTheDocument()
      expect(screen.getByText("Test Program Title")).toBeInTheDocument()
    })
  })

  describe("Course dropdown states and options", () => {
    test("Dropdown shows 'Please Select' initially when courses load", async () => {
      const course1 = makeCourse({ courseruns: [enrollableRun()] })
      const program = makeProgram({ courses: [course1.id] })
      setupCourseApis([course1])

      renderWithProviders(null)
      await openProgramDialog(program)

      const select = screen.getByRole("combobox", { name: /choose a date/i })
      expect(select).toHaveTextContent(/please select/i)
    })

    test("Dropdown shows loading state while courses load", async () => {
      const program = makeProgram()
      const courseResponse = Promise.withResolvers()
      setMockResponse.get(
        expect.stringContaining(mitxUrls.courses.coursesList()),
        courseResponse.promise,
      )
      renderWithProviders(null)
      await openProgramDialog(program)

      const select = screen.getByRole("combobox", { name: /choose a date/i })
      await user.click(select)

      expect(
        screen.getByRole("option", { name: /loading courses/i }),
      ).toBeInTheDocument()
    })

    test("Dropdown shows error state when courses fail to load", async () => {
      const program = makeProgram()
      setMockResponse.get(
        expect.stringContaining(mitxUrls.courses.coursesList()),
        "Failed to load courses",
        { code: 500 },
      )

      renderWithProviders(null)
      await openProgramDialog(program)

      const select = screen.getByRole("combobox", { name: /choose a date/i })
      await waitFor(() => {
        expect(select).toHaveAttribute("aria-invalid", "true")
      })
    })

    test("Dropdown shows course options once loaded", async () => {
      const run1 = enrollableRun({ course_number: "6.001" })
      const run2 = enrollableRun({ course_number: "6.002" })
      const course1 = makeCourse({
        courseruns: [run1],
        title: "Introduction to CS",
        next_run_id: run1.id,
      })
      const course2 = makeCourse({
        courseruns: [run2],
        title: "Advanced CS",
        next_run_id: run2.id,
      })
      const program = makeProgram({ courses: [course1.id, course2.id] })
      setupCourseApis([course1, course2])

      renderWithProviders(null)
      await openProgramDialog(program)

      const select = screen.getByRole("combobox", { name: /choose a date/i })
      await user.click(select)

      const options = screen.getAllByRole("option")
      // Should have 3 options: 1 "Please Select" + 2 courses
      expect(options).toHaveLength(3)
    })

    test("Course options include course title suffixed by the chosen run id", async () => {
      const run = enrollableRun({ course_number: "6.001x" })
      const course = makeCourse({
        courseruns: [run],
        title: "Introduction to Computer Science",
        next_run_id: run.id,
      })
      const program = makeProgram({ courses: [course.id] })
      setupCourseApis([course])

      renderWithProviders(null)
      await openProgramDialog(program)

      const select = screen.getByRole("combobox", { name: /choose a date/i })
      await user.click(select)

      expect(
        screen.getByRole("option", {
          name: /Introduction to Computer Science - 6.001x/i,
        }),
      ).toBeInTheDocument()
    })

    test("If no run is available, '(No available runs)' shows as suffix", async () => {
      const course = makeCourse({
        courseruns: [],
        title: "Course Without Runs",
        next_run_id: null,
      })
      const program = makeProgram({ courses: [course.id] })
      setupCourseApis([course])

      renderWithProviders(null)
      await openProgramDialog(program)

      const select = screen.getByRole("combobox", { name: /choose a date/i })
      await user.click(select)

      screen.getByRole("option", {
        name: "Course Without Runs - (No available runs)",
      })
    })

    test("If the chosen run is not upgradeable, '(No certificate available)' shows as suffix", async () => {
      const nonUpgradableRun = enrollableRun({
        course_number: "6.003",
        is_upgradable: false,
      })
      const course = makeCourse({
        courseruns: [nonUpgradableRun],
        title: "Non-Upgradable Course",
        next_run_id: nonUpgradableRun.id,
      })
      const program = makeProgram({ courses: [course.id] })
      setupCourseApis([course])

      renderWithProviders(null)
      await openProgramDialog(program)

      const select = screen.getByRole("combobox", { name: /choose a date/i })
      await user.click(select)

      expect(
        screen.getByRole("option", {
          name: /Non-Upgradable Course - 6.003 \(No certificate available\)/i,
        }),
      ).toBeInTheDocument()
    })

    test("Upgradeable runs do NOT show '(No certificate available)' suffix", async () => {
      const upgradableRun = upgradeableRun({ course_number: "6.004" })
      const course = makeCourse({
        courseruns: [upgradableRun],
        title: "Upgradable Course",
        next_run_id: upgradableRun.id,
      })
      const program = makeProgram({ courses: [course.id] })
      setupCourseApis([course])

      renderWithProviders(null)
      await openProgramDialog(program)

      const select = screen.getByRole("combobox", { name: /choose a date/i })
      await user.click(select)

      const option = screen.getByRole("option", {
        name: /Upgradable Course - 6.004$/i,
      })
      expect(option).toBeInTheDocument()
      expect(option.textContent).not.toContain("No certificate available")
    })
  })

  describe("Certificate upgrade and enrollment actions", () => {
    test("Clicking 'Add to cart' redirects to cart page appropriately", async () => {
      const assign = jest.mocked(window.location.assign)

      const run = upgradeableRun({ course_number: "6.005" })
      const product = run.products[0]
      invariant(product, "Upgradeable run must have a product")
      const course = makeCourse({
        courseruns: [run],
        title: "Test Course",
        next_run_id: run.id,
      })
      const program = makeProgram({ courses: [course.id] })

      setMockResponse.get(
        expect.stringContaining(mitxUrls.courses.coursesList()),
        {
          results: [course],
          count: 1,
          next: null,
          previous: null,
        },
      )

      renderWithProviders(null)
      await openProgramDialog(program)

      // Select the course
      const select = screen.getByRole("combobox", { name: /choose a date/i })
      await user.click(select)
      const courseOption = screen.getByRole("option", {
        name: /Test Course - 6.005/i,
      })
      await user.click(courseOption)

      // Wait for certificate upgrade section to appear
      await screen.findByText(/Get Certificate/)

      // Click "Add to Cart" button
      const upgradeButton = screen.getByRole("button", {
        name: /Add to Cart.*to get a Certificate/i,
      })
      await user.click(upgradeButton)

      // Verify redirect URL includes product_id parameter
      await waitFor(() => {
        expect(assign).toHaveBeenCalledWith(upgradeRunUrl(product))
      })
    })

    test("Clicking 'No thanks, I'll take the course...' button enrolls in the course", async () => {
      const run = enrollableRun({ course_number: "6.006" })
      const course = makeCourse({
        courseruns: [run],
        title: "Algorithms",
        next_run_id: run.id,
      })
      const program = makeProgram({ courses: [course.id] })
      setupCourseApis([course])

      renderWithProviders(null)
      await openProgramDialog(program)

      // Select the course
      const select = screen.getByRole("combobox", { name: /choose a date/i })
      await user.click(select)
      const courseOption = screen.getByRole("option", {
        name: /Algorithms - 6.006/i,
      })
      await user.click(courseOption)

      // Wait for enrollment button to be enabled
      const enrollButton = await screen.findByRole("button", {
        name: /No thanks, I'll take the course for free without a certificate/i,
      })
      expect(enrollButton).toBeEnabled()

      // Mock the enrollment API call
      setMockResponse.post(mitxUrls.enrollment.enrollmentsListV2(), {})

      // Click the enrollment button
      await user.click(enrollButton)

      // Verify the enrollment request was made
      await waitFor(() => {
        expect(makeRequest).toHaveBeenCalledWith(
          "post",
          mitxUrls.enrollment.enrollmentsListV2(),
          { run_id: run.id },
        )
      })
    })

    test("Enrollment button is disabled when no course is selected", async () => {
      const run = enrollableRun()
      const course = makeCourse({
        courseruns: [run],
        title: "Test Course",
        next_run_id: run.id,
      })
      const program = makeProgram({ courses: [course.id] })
      setupCourseApis([course])

      renderWithProviders(null)
      await openProgramDialog(program)

      // Don't select any course, just check button state
      const enrollButton = screen.getByRole("button", {
        name: /No thanks, I'll take the course for free without a certificate/i,
      })
      expect(enrollButton).toBeDisabled()
    })

    test("Enrollment button is disabled when course with no runs is selected", async () => {
      const course = makeCourse({
        courseruns: [],
        title: "Course Without Runs",
        next_run_id: null,
      })
      const program = makeProgram({ courses: [course.id] })
      setupCourseApis([course])

      renderWithProviders(null)
      await openProgramDialog(program)

      // Try to select the course without runs
      const select = screen.getByRole("combobox", { name: /choose a date/i })
      await user.click(select)
      const courseOption = screen.getByRole("option", {
        name: /No available runs/i,
      })
      await user.click(courseOption)

      // Enrollment button should be disabled
      const enrollButton = screen.getByRole("button", {
        name: /No thanks, I'll take the course for free without a certificate/i,
      })
      expect(enrollButton).toBeDisabled()
    })
  })
})
