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
import type { CourseWithCourseRunsSerializerV2 } from "@mitodl/mitxonline-api-axios/v2"
import NiceModal from "@ebay/nice-modal-react"
import CourseEnrollmentDialog from "./CourseEnrollmentDialog"
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

describe("CourseEnrollmentDialog", () => {
  const openDialog = async (course: CourseWithCourseRunsSerializerV2) => {
    await act(async () => {
      NiceModal.show(CourseEnrollmentDialog, { course })
    })
    return await screen.findByRole("dialog")
  }

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

      setMockResponse.post(mitxUrls.enrollment.enrollmentsListV1(), {})
      await user.click(enrollButton)

      await waitFor(() => {
        expect(makeRequest).toHaveBeenCalledWith(
          "post",
          mitxUrls.enrollment.enrollmentsListV1(),
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
