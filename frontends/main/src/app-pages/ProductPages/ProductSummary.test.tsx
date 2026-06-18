import React from "react"
import { factories, urls } from "api/mitxonline-test-utils"
import {
  setMockResponse,
  urls as apiUrls,
  factories as apiFactories,
} from "api/test-utils"
import { renderWithProviders, screen, within, user } from "@/test-utils"
import { CourseSummary, ProgramSummary, TestIds } from "./ProductSummary"
import { formatDate } from "ol-utilities"
import { formatPrice, mitxonlineLegacyUrl } from "@/common/mitxonline"
import invariant from "tiny-invariant"
import { faker } from "@faker-js/faker/locale/en"

const shuffle = faker.helpers.shuffle
const makeRun = factories.courses.courseRun
const makeCourse = factories.courses.course
const makeProduct = factories.courses.product
const makeFlexiblePrice = factories.products.flexiblePrice
const makeEnrollmentMode = factories.courses.enrollmentMode
const { RequirementTreeBuilder } = factories.requirements

/** ISO date string relative to now. Positive = future, negative = past. */
const monthsFromNow = (months: number): string => {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}

// Enrollment mode helpers for common test setups
const freeMode = () => makeEnrollmentMode({ requires_payment: false })
const paidMode = () => makeEnrollmentMode({ requires_payment: true })
const bothModes = () => [freeMode(), paidMode()]

describe("CourseSummary", () => {
  test.each([
    { hasRun: false, expectAlert: true },
    { hasRun: true, expectAlert: false },
  ])(
    "If no run is found, renders an alert (alert=$expectAlert)",
    ({ hasRun, expectAlert }) => {
      const run = makeRun()
      const course = makeCourse({ courseruns: hasRun ? [run] : [] })
      const selectedRun = hasRun ? run : undefined
      renderWithProviders(
        <CourseSummary course={course} selectedRun={selectedRun} />,
      )
      const alertMessage = screen.queryByText(
        /No sessions of this course are currently open for enrollment/,
      )

      if (expectAlert) {
        invariant(alertMessage)
        const alert = alertMessage.closest("[role='alert']")
        expect(alert).toBeInTheDocument()
      } else {
        expect(alertMessage).toBeNull()
      }
    },
  )

  test.each([
    { overrides: { is_archived: true }, expectAlert: true },
    { overrides: { is_archived: false }, expectAlert: false },
  ])(
    "Renders an alert if run is archived (alert = $expectAlert)",
    ({ overrides, expectAlert }) => {
      const run = makeRun(overrides)
      const course = makeCourse({ courseruns: [run] })
      renderWithProviders(<CourseSummary course={course} selectedRun={run} />)
      const alert = screen.queryByRole("alert")

      if (expectAlert) {
        invariant(alert)
        expect(alert).toHaveTextContent(
          "This course is no longer active, but you can still access selected content.",
        )
      } else {
        expect(alert).toBeNull()
      }
    },
  )

  describe("Dates Row", () => {
    test("Renders expected start/end dates", async () => {
      const run = makeRun({ is_enrollable: true })
      const nonEnrollableRun = makeRun({ is_enrollable: false })
      const course = makeCourse({
        availability: "dated",
        next_run_id: run.id,
        courseruns: shuffle([run, nonEnrollableRun]),
      })
      renderWithProviders(<CourseSummary course={course} selectedRun={run} />)

      const datesRow = screen.getByTestId(TestIds.DatesRow)

      invariant(run.start_date)
      expect(datesRow).toHaveTextContent(`Start: ${formatDate(run.start_date)}`)

      invariant(run.end_date)
      expect(datesRow).toHaveTextContent(`End: ${formatDate(run.end_date)}`)
    })

    test("Renders 'Start: Anytime' plus and end date for start anytime courses", () => {
      // For "Anytime" to show, run must be self-paced, not archived, and have a start date in the past
      const run = makeRun({
        start_date: monthsFromNow(-12),
        is_self_paced: true,
        is_archived: false,
        is_enrollable: true,
      })
      const course = makeCourse({
        availability: "anytime",
        courseruns: [run],
        next_run_id: run.id,
      })
      renderWithProviders(<CourseSummary course={course} selectedRun={run} />)

      const datesRow = screen.getByTestId(TestIds.DatesRow)

      expect(datesRow).toHaveTextContent("Start: Anytime")

      invariant(run.end_date)
      expect(datesRow).toHaveTextContent(`End: ${formatDate(run.end_date)}`)
    })

    test("Renders nothing if next run has no start date and is only enrollable run", () => {
      const run = makeRun({ start_date: null, is_enrollable: true })
      const nonEnrollableRun = makeRun({ is_enrollable: false })
      const course = makeCourse({
        availability: "dated",
        courseruns: shuffle([run, nonEnrollableRun]),
        next_run_id: run.id,
      })
      renderWithProviders(<CourseSummary course={course} selectedRun={run} />)

      const datesRow = screen.getByTestId(TestIds.DatesRow)

      // Dates row exists but shows no date information
      expect(datesRow).not.toHaveTextContent("Start")
      expect(datesRow).not.toHaveTextContent("End")
    })

    test("Renders no end date if end date missing", () => {
      const run = makeRun({ end_date: null })
      const course = makeCourse({
        availability: "dated",
        courseruns: shuffle([run, makeRun()]),
        next_run_id: run.id,
      })
      renderWithProviders(<CourseSummary course={course} selectedRun={run} />)

      const datesRow = screen.getByTestId(TestIds.DatesRow)

      expect(datesRow).not.toHaveTextContent("End")
    })

    test("Displays a single date without 'More Dates' toggle when only one enrollable run", () => {
      const run = makeRun({
        is_enrollable: true,
        is_archived: false,
        is_self_paced: false,
      })
      const nonEnrollableRun = makeRun({
        is_enrollable: false,
      })
      const course = makeCourse({
        next_run_id: run.id,
        courseruns: [run, nonEnrollableRun],
      })
      renderWithProviders(<CourseSummary course={course} selectedRun={run} />)

      const datesRow = screen.getByTestId(TestIds.DatesRow)

      // Should show the start and end dates
      invariant(run.start_date)
      expect(datesRow).toHaveTextContent(`Start: ${formatDate(run.start_date)}`)
      invariant(run.end_date)
      expect(datesRow).toHaveTextContent(`End: ${formatDate(run.end_date)}`)

      // Should NOT have a "More Dates" toggle
      expect(
        within(datesRow).queryByRole("button", { name: /More Dates/i }),
      ).toBeNull()
      expect(datesRow).not.toHaveTextContent("Dates Available")
    })

    test("Displays 'More Dates' toggle when multiple enrollable runs exist", () => {
      const run1 = makeRun({
        is_enrollable: true,
        is_self_paced: false,
      })
      const run2 = makeRun({
        is_enrollable: true,
        is_self_paced: false,
      })
      const course = makeCourse({
        next_run_id: run1.id,
        courseruns: [run1, run2],
      })
      renderWithProviders(<CourseSummary course={course} selectedRun={run1} />)

      const datesRow = screen.getByTestId(TestIds.DatesRow)

      // Should show "Dates Available" label
      expect(datesRow).toHaveTextContent("Dates Available")

      // Should show "More Dates" button
      const moreDatesButton = within(datesRow).getByRole("button", {
        name: "More Dates",
      })
      expect(moreDatesButton).toBeInTheDocument()
    })

    test("Clicking 'More Dates' expands to show all enrollable dates, clicking 'Show Less' collapses back", async () => {
      const run1 = makeRun({
        is_enrollable: true,
        is_self_paced: false,
        start_date: monthsFromNow(3),
        end_date: monthsFromNow(5),
      })
      const run2 = makeRun({
        is_enrollable: true,
        is_self_paced: false,
        is_archived: false,
        start_date: monthsFromNow(6),
        end_date: monthsFromNow(8),
      })
      const run3 = makeRun({
        is_enrollable: true,
        is_self_paced: false,
        is_archived: false,
        start_date: monthsFromNow(9),
        end_date: monthsFromNow(11),
      })
      const course = makeCourse({
        next_run_id: run1.id,
        courseruns: [run1, run2, run3],
      })
      renderWithProviders(<CourseSummary course={course} selectedRun={run1} />)

      const datesRow = screen.getByTestId(TestIds.DatesRow)

      // Initially, only the next_run date should be visible
      invariant(run1.start_date)
      expect(datesRow).toHaveTextContent(formatDate(run1.start_date))

      // Other dates should NOT be visible
      invariant(run2.start_date)
      invariant(run3.start_date)
      expect(datesRow).not.toHaveTextContent(formatDate(run2.start_date))
      expect(datesRow).not.toHaveTextContent(formatDate(run3.start_date))

      // Click "More Dates"
      const moreDatesButton = within(datesRow).getByRole("button", {
        name: "More Dates",
      })
      await user.click(moreDatesButton)

      // Now all dates should be visible
      expect(datesRow).toHaveTextContent(formatDate(run1.start_date))
      expect(datesRow).toHaveTextContent(formatDate(run2.start_date))
      expect(datesRow).toHaveTextContent(formatDate(run3.start_date))

      // Button text should change to "Show Less"
      const fewerDatesButton = within(datesRow).getByRole("button", {
        name: "Show Less",
      })
      expect(fewerDatesButton).toBeInTheDocument()

      // Click "Show Less" to collapse
      await user.click(fewerDatesButton)

      // Should be back to showing only the next_run date
      expect(datesRow).toHaveTextContent(formatDate(run1.start_date))
      expect(datesRow).not.toHaveTextContent(formatDate(run2.start_date))
      expect(datesRow).not.toHaveTextContent(formatDate(run3.start_date))

      // Button should be back to "More Dates"
      expect(
        within(datesRow).getByRole("button", { name: "More Dates" }),
      ).toBeInTheDocument()
    })

    test("Multiple enrollable dates are displayed chronologically newest to oldest", async () => {
      const oldestRun = makeRun({
        is_enrollable: true,
        is_self_paced: true, // This will show "Start: Anytime" (past date)
        is_archived: false,
        start_date: monthsFromNow(-12),
        end_date: monthsFromNow(3),
      })
      const middleRun = makeRun({
        is_enrollable: true,
        is_self_paced: false, // Ensure dates display normally (not "Anytime")
        is_archived: false,
        start_date: monthsFromNow(6),
        end_date: monthsFromNow(8),
      })
      const newestRun = makeRun({
        is_enrollable: true,
        is_self_paced: false, // Ensure dates display normally (not "Anytime")
        is_archived: false,
        start_date: monthsFromNow(9),
        end_date: monthsFromNow(11),
      })

      const course = makeCourse({
        next_run_id: middleRun.id,
        // Shuffle the runs to ensure sorting works regardless of input order
        courseruns: shuffle([oldestRun, middleRun, newestRun]),
      })
      renderWithProviders(
        <CourseSummary course={course} selectedRun={middleRun} />,
      )

      const datesRow = screen.getByTestId(TestIds.DatesRow)

      // Click "More Dates" to show all dates
      const moreDatesButton = within(datesRow).getByRole("button", {
        name: "More Dates",
      })
      await user.click(moreDatesButton)

      // Get all the date strings that should appear
      invariant(newestRun.start_date)
      invariant(middleRun.start_date)
      invariant(oldestRun.start_date)

      const newestDateString = formatDate(newestRun.start_date)
      const middleDateString = formatDate(middleRun.start_date)
      const oldestDateString = formatDate(oldestRun.start_date)

      // Get the date entry containers
      const dateEntryContainers = within(datesRow).getAllByTestId("date-entry")

      // Verify we have 3 date entries
      expect(dateEntryContainers).toHaveLength(3)

      // Verify the dates appear in chronological order (newest to oldest)
      const firstDateContainer = dateEntryContainers[0]
      const secondDateContainer = dateEntryContainers[1]
      const thirdDateContainer = dateEntryContainers[2]

      expect(firstDateContainer?.textContent).toContain(newestDateString)
      expect(secondDateContainer?.textContent).toContain(middleDateString)
      // The oldest run should show "Anytime" instead of the actual date
      expect(thirdDateContainer?.textContent).toContain("Start: Anytime")
      expect(thirdDateContainer?.textContent).not.toContain(oldestDateString)
    })

    test("Initially displays the date for the run with next_run_id when multiple enrollable runs exist", () => {
      const run1 = makeRun({
        is_enrollable: true,
        start_date: monthsFromNow(1),
        end_date: monthsFromNow(3),
      })
      const run2 = makeRun({
        is_enrollable: true,
        start_date: monthsFromNow(6),
        end_date: monthsFromNow(8),
      })
      const run3 = makeRun({
        is_enrollable: true,
        start_date: monthsFromNow(9),
        end_date: monthsFromNow(11),
      })

      const course = makeCourse({
        next_run_id: run2.id, // Select the middle run as next
        courseruns: shuffle([run1, run2, run3]),
      })
      renderWithProviders(<CourseSummary course={course} selectedRun={run2} />)

      const datesRow = screen.getByTestId(TestIds.DatesRow)

      // Should show run2's date (the next_run_id)
      invariant(run2.start_date)
      invariant(run2.end_date)
      expect(datesRow).toHaveTextContent(formatDate(run2.start_date))
      expect(datesRow).toHaveTextContent(formatDate(run2.end_date))

      // Should NOT show other runs' dates initially
      invariant(run1.start_date)
      invariant(run3.start_date)
      expect(datesRow).not.toHaveTextContent(formatDate(run1.start_date))
      expect(datesRow).not.toHaveTextContent(formatDate(run3.start_date))
    })

    test("Collapsed dates row shows selectedRun's date, not next_run_id run's date, when they differ", () => {
      const runA = makeRun({
        is_enrollable: true,
        start_date: monthsFromNow(1),
        end_date: monthsFromNow(3),
      })
      const runB = makeRun({
        is_enrollable: true,
        start_date: monthsFromNow(6),
        end_date: monthsFromNow(8),
      })

      const course = makeCourse({
        next_run_id: runA.id, // course's default run is A
        courseruns: shuffle([runA, runB]),
      })
      // User has selected run B — collapsed view must show run B, not run A
      renderWithProviders(<CourseSummary course={course} selectedRun={runB} />)

      const datesRow = screen.getByTestId(TestIds.DatesRow)

      invariant(runB.start_date)
      expect(datesRow).toHaveTextContent(formatDate(runB.start_date))

      invariant(runA.start_date)
      expect(datesRow).not.toHaveTextContent(formatDate(runA.start_date))
    })

    test("Never displays dates for non-enrollable runs", async () => {
      const enrollableRun = makeRun({
        is_enrollable: true,
        start_date: monthsFromNow(6),
        end_date: monthsFromNow(8),
      })
      const nonEnrollableRun1 = makeRun({
        is_enrollable: false,
        start_date: monthsFromNow(1),
        end_date: monthsFromNow(3),
      })
      const nonEnrollableRun2 = makeRun({
        is_enrollable: false,
        start_date: monthsFromNow(9),
        end_date: monthsFromNow(11),
      })

      const course = makeCourse({
        next_run_id: enrollableRun.id,
        courseruns: shuffle([
          enrollableRun,
          nonEnrollableRun1,
          nonEnrollableRun2,
        ]),
      })
      renderWithProviders(
        <CourseSummary course={course} selectedRun={enrollableRun} />,
      )

      const datesRow = screen.getByTestId(TestIds.DatesRow)

      // Should show only the enrollable run's date
      invariant(enrollableRun.start_date)
      expect(datesRow).toHaveTextContent(formatDate(enrollableRun.start_date))

      // Should NOT show non-enrollable runs' dates
      invariant(nonEnrollableRun1.start_date)
      invariant(nonEnrollableRun2.start_date)
      expect(datesRow).not.toHaveTextContent(
        formatDate(nonEnrollableRun1.start_date),
      )
      expect(datesRow).not.toHaveTextContent(
        formatDate(nonEnrollableRun2.start_date),
      )

      // Should NOT have "More Dates" toggle since only one enrollable run
      expect(
        within(datesRow).queryByRole("button", { name: /More Dates/i }),
      ).toBeNull()
    })

    test("Shows dates available header but no date entries when all enrollable runs have no start date", () => {
      const run1 = makeRun({
        is_enrollable: true,
        start_date: null,
      })
      const run2 = makeRun({
        is_enrollable: true,
        start_date: null,
      })
      const course = makeCourse({
        next_run_id: run1.id,
        courseruns: [run1, run2],
      })
      renderWithProviders(<CourseSummary course={course} selectedRun={run1} />)

      const datesRow = screen.getByTestId(TestIds.DatesRow)

      // Dates row renders because multiple enrollable runs exist
      expect(datesRow).toHaveTextContent("Dates Available")

      // But no actual date information is shown
      expect(datesRow).not.toHaveTextContent("Start")
      expect(datesRow).not.toHaveTextContent("End")
    })

    test("When multiple enrollable runs exist, only shows runs with start dates after expanding", async () => {
      const runWithDate = makeRun({
        is_enrollable: true,
      })
      const runWithoutDate = makeRun({
        is_enrollable: true,
        start_date: null,
      })
      const anotherRunWithDate = makeRun({
        is_enrollable: true,
      })

      const course = makeCourse({
        next_run_id: runWithDate.id,
        courseruns: shuffle([runWithDate, runWithoutDate, anotherRunWithDate]),
      })
      renderWithProviders(
        <CourseSummary course={course} selectedRun={runWithDate} />,
      )

      const datesRow = screen.getByTestId(TestIds.DatesRow)

      // Click "More Dates"
      const moreDatesButton = within(datesRow).getByRole("button", {
        name: "More Dates",
      })
      await user.click(moreDatesButton)

      // Should show dates for runs with start dates
      invariant(runWithDate.start_date)
      invariant(anotherRunWithDate.start_date)
      expect(datesRow).toHaveTextContent(formatDate(runWithDate.start_date))
      expect(datesRow).toHaveTextContent(
        formatDate(anotherRunWithDate.start_date),
      )

      // The run without a start date should not appear
      // Count the number of date entry containers
      const dateEntryContainers = within(datesRow).getAllByTestId("date-entry")
      expect(dateEntryContainers).toHaveLength(2)
    })

    test("End date is not displayed for runs without end date when expanded", async () => {
      const runWithEndDate = makeRun({
        is_enrollable: true,
      })
      const runWithoutEndDate = makeRun({
        is_enrollable: true,
        end_date: null,
      })

      const course = makeCourse({
        next_run_id: runWithEndDate.id,
        courseruns: [runWithEndDate, runWithoutEndDate],
      })
      renderWithProviders(
        <CourseSummary course={course} selectedRun={runWithEndDate} />,
      )

      const datesRow = screen.getByTestId(TestIds.DatesRow)

      // Click "More Dates"
      const moreDatesButton = within(datesRow).getByRole("button", {
        name: "More Dates",
      })
      await user.click(moreDatesButton)

      // Both start dates should be visible
      invariant(runWithEndDate.start_date)
      invariant(runWithoutEndDate.start_date)
      expect(datesRow).toHaveTextContent(formatDate(runWithEndDate.start_date))
      expect(datesRow).toHaveTextContent(
        formatDate(runWithoutEndDate.start_date),
      )

      // Should only show one "End" label (for the run with end date)
      const dateEntries = within(datesRow).getAllByTestId("date-entry")
      const dateEntriesWithEnd = dateEntries.filter((entry) =>
        entry.textContent?.includes("End:"),
      )
      expect(dateEntriesWithEnd).toHaveLength(1)

      // Should show the end date that exists
      invariant(runWithEndDate.end_date)
      expect(datesRow).toHaveTextContent(formatDate(runWithEndDate.end_date))
    })

    test("Shows 'Start: Anytime' for self-paced runs with past start dates when multiple dates exist", async () => {
      // Run that should show "Anytime" (self-paced, not archived, past start date)
      const anytimeRun = makeRun({
        is_enrollable: true,
        is_self_paced: true,
        is_archived: false,
        start_date: monthsFromNow(-12),
        end_date: monthsFromNow(12),
      })

      // Run that should show actual date (not self-paced)
      const instructorPacedRun = makeRun({
        is_enrollable: true,
        is_self_paced: false,
        is_archived: false,
        start_date: monthsFromNow(6),
        end_date: monthsFromNow(8),
      })

      // Run that should show actual date (self-paced but future start date)
      const futureRun = makeRun({
        is_enrollable: true,
        is_self_paced: true,
        is_archived: false,
        start_date: monthsFromNow(9),
        end_date: monthsFromNow(11),
      })

      const course = makeCourse({
        next_run_id: anytimeRun.id,
        courseruns: [anytimeRun, instructorPacedRun, futureRun],
      })
      renderWithProviders(
        <CourseSummary course={course} selectedRun={anytimeRun} />,
      )

      const datesRow = screen.getByTestId(TestIds.DatesRow)

      // Click "More Dates" to see all
      const moreDatesButton = within(datesRow).getByRole("button", {
        name: "More Dates",
      })
      await user.click(moreDatesButton)

      // Should show "Anytime" for the self-paced run with past start date
      expect(datesRow).toHaveTextContent("Start: Anytime")

      // Should show actual dates for the other runs
      invariant(instructorPacedRun.start_date)
      invariant(futureRun.start_date)
      expect(datesRow).toHaveTextContent(
        formatDate(instructorPacedRun.start_date),
      )
      expect(datesRow).toHaveTextContent(formatDate(futureRun.start_date))

      // All should show end dates
      invariant(anytimeRun.end_date)
      invariant(instructorPacedRun.end_date)
      invariant(futureRun.end_date)
      expect(datesRow).toHaveTextContent(formatDate(anytimeRun.end_date))
      expect(datesRow).toHaveTextContent(
        formatDate(instructorPacedRun.end_date),
      )
      expect(datesRow).toHaveTextContent(formatDate(futureRun.end_date))
    })

    test("Archived runs show actual dates even if they meet anytime criteria", async () => {
      // Archived run that would show "Anytime" if not archived
      const archivedRun = makeRun({
        is_enrollable: true,
        is_self_paced: true,
        is_archived: true, // Archived!
        start_date: monthsFromNow(-18),
        end_date: monthsFromNow(-3),
      })

      // Active anytime run for comparison
      const anytimeRun = makeRun({
        is_enrollable: true,
        is_self_paced: true,
        is_archived: false,
        start_date: monthsFromNow(-6),
        end_date: monthsFromNow(12),
      })

      const course = makeCourse({
        next_run_id: archivedRun.id,
        courseruns: [archivedRun, anytimeRun],
      })
      renderWithProviders(
        <CourseSummary course={course} selectedRun={archivedRun} />,
      )

      const datesRow = screen.getByTestId(TestIds.DatesRow)

      // Click "More Dates" to see all
      const moreDatesButton = within(datesRow).getByRole("button", {
        name: "More Dates",
      })
      await user.click(moreDatesButton)

      // Active run should show "Anytime"
      expect(datesRow).toHaveTextContent("Start: Anytime")

      // Archived run should show actual date, not "Anytime"
      invariant(archivedRun.start_date)
      expect(datesRow).toHaveTextContent(formatDate(archivedRun.start_date))

      // Both should show end dates
      invariant(archivedRun.end_date)
      invariant(anytimeRun.end_date)
      expect(datesRow).toHaveTextContent(formatDate(archivedRun.end_date))
      expect(datesRow).toHaveTextContent(formatDate(anytimeRun.end_date))
    })
  })

  describe("Format Row", () => {
    test.each([
      {
        descrip: "self-paced",
        overrides: { is_self_paced: true, is_archived: false },
      },
      {
        descrip: "archived",
        overrides: { is_archived: true },
      },
    ])(
      "Renders self-paced for $descrip courses with appropriate dialog",
      async ({ overrides }) => {
        const run = makeRun(overrides)
        const course = makeCourse({
          availability: "dated",
          next_run_id: run.id,
          courseruns: shuffle([run, makeRun()]),
        })
        renderWithProviders(<CourseSummary course={course} selectedRun={run} />)

        const formatRow = screen.getByTestId(TestIds.PaceRow)
        expect(formatRow).toHaveTextContent("Course Format: Self-Paced")

        const dialogTitle = "What are Self-Paced courses?"
        const button = within(formatRow).getByRole("button", {
          name: dialogTitle,
        })
        await user.click(button)
        const dialog = await screen.findByRole("dialog", {
          name: dialogTitle,
        })

        await user.click(within(dialog).getByRole("button", { name: "Close" }))

        expect(dialog).not.toBeVisible()
      },
    )

    test("Renders instructor-led for non-self-paced courses", async () => {
      const run = makeRun({ is_self_paced: false, is_archived: false })
      const course = makeCourse({
        availability: "dated",
        next_run_id: run.id,
        courseruns: shuffle([run, makeRun()]),
      })
      renderWithProviders(<CourseSummary course={course} selectedRun={run} />)

      const formatRow = screen.getByTestId(TestIds.PaceRow)
      expect(formatRow).toHaveTextContent("Course Format: Instructor-Paced")

      const dialogTitle = "What are Instructor-Paced courses?"
      const button = within(formatRow).getByRole("button", {
        name: dialogTitle,
      })

      await user.click(button)
      const dialog = await screen.findByRole("dialog", {
        name: dialogTitle,
      })

      await user.click(within(dialog).getByRole("button", { name: "Close" }))

      expect(dialog).not.toBeVisible()
    })
  })

  describe("Duration Row", () => {
    test.each([
      {
        length: "5 weeks",
        effort: "3-5 hours per week",
        expected: "5 weeks, 3-5 hours per week",
      },
      { length: "6 weeks", effort: null, expected: "6 weeks" },
      { length: "", expected: null },
    ])(
      "Renders expected duration in weeks and effort",
      ({ length, effort, expected }) => {
        const course = makeCourse({
          page: { length, effort },
        })

        renderWithProviders(
          <CourseSummary course={course} selectedRun={undefined} />,
        )

        if (!length) {
          expect(screen.queryByTestId(TestIds.DurationRow)).toBeNull()
        } else {
          const durationRow = screen.getByTestId(TestIds.DurationRow)
          expect(durationRow).toHaveTextContent(`Estimated: ${expected}`)
        }
      },
    )

    test("Duration row displays even when there is no next run", () => {
      const course = makeCourse({
        next_run_id: null,
        courseruns: [],
        page: {
          length: "5 weeks",
          effort: "10 hours/week",
        },
      })
      renderWithProviders(
        <CourseSummary course={course} selectedRun={undefined} />,
      )

      const durationRow = screen.getByTestId(TestIds.DurationRow)

      expect(durationRow).toBeInTheDocument()
      expect(durationRow).toHaveTextContent("Estimated: 5 weeks, 10 hours/week")
    })
  })

  describe("Payment Deadline", () => {
    test("Shows payment deadline when selected run has upgrade_deadline and is not archived", () => {
      const upgradeDeadline = monthsFromNow(1)
      const run = makeRun({
        upgrade_deadline: upgradeDeadline,
        is_archived: false,
      })
      const course = makeCourse({ courseruns: [run] })
      renderWithProviders(<CourseSummary course={course} selectedRun={run} />)
      expect(screen.getByText(/Payment deadline/)).toBeInTheDocument()
      expect(
        screen.getByText(new RegExp(formatDate(upgradeDeadline))),
      ).toBeInTheDocument()
    })

    test("Does not show payment deadline when selected run is archived", () => {
      const run = makeRun({
        upgrade_deadline: monthsFromNow(1),
        is_archived: true,
      })
      const course = makeCourse({ courseruns: [run] })
      renderWithProviders(<CourseSummary course={course} selectedRun={run} />)
      expect(screen.queryByText(/Payment deadline/)).toBeNull()
    })

    test("Does not show payment deadline when selected run has no upgrade_deadline", () => {
      const run = makeRun({ upgrade_deadline: null, is_archived: false })
      const course = makeCourse({ courseruns: [run] })
      renderWithProviders(<CourseSummary course={course} selectedRun={run} />)
      expect(screen.queryByText(/Payment deadline/)).toBeNull()
    })
  })

  test("Renders sessionSelect in place of dates when provided", () => {
    const run = makeRun({ is_enrollable: true })
    const course = makeCourse({ courseruns: [run], next_run_id: run.id })
    renderWithProviders(
      <CourseSummary
        course={course}
        selectedRun={run}
        sessionSelect={
          <div data-testid="session-select-slot">Session Picker</div>
        }
      />,
    )
    expect(screen.getByTestId("session-select-slot")).toBeInTheDocument()
    expect(screen.queryByText(/^Start:/)).toBeNull()
  })
})

describe("ProgramSummary", () => {
  beforeEach(() => {
    setMockResponse.get(
      apiUrls.userMe.get(),
      apiFactories.user.user({ is_authenticated: false }),
    )
  })

  test("renders program summary rows", async () => {
    const program = factories.programs.program({
      enrollment_modes: bothModes(),
    })
    renderWithProviders(<ProgramSummary program={program} />)

    screen.getByTestId(TestIds.PriceRow)
  })

  describe("RequirementsRow", () => {
    test("Renders requirement count with required + elective courses", () => {
      const requirements = new RequirementTreeBuilder()
      const required = requirements.addOperator({ operator: "all_of" })
      required.addCourse()
      required.addCourse()
      required.addCourse()
      const electives = requirements.addOperator({
        operator: "min_number_of",
        operator_value: "2",
      })
      electives.addCourse()
      electives.addCourse()
      electives.addCourse()
      electives.addCourse()

      const program = factories.programs.program({
        requirements: {
          courses: {
            required:
              required.children?.map((n) => ({
                id: n.id,
                readable_id: `readale-${n.id}`,
              })) ?? [],
            electives:
              electives.children?.map((n) => ({
                id: n.id,
                readable_id: `readale-${n.id}`,
              })) ?? [],
          },
          programs: { required: [], electives: [] },
        },
        req_tree: requirements.serialize(),
      })

      renderWithProviders(<ProgramSummary program={program} />)

      const reqRow = screen.getByTestId(TestIds.RequirementsRow)

      // The text is split more nicely on screen, but via html tags not spaces
      expect(reqRow).toHaveTextContent("5 Courses to complete program")
    })

    test("Renders requirement count correctly if no electives", () => {
      const requirements = new RequirementTreeBuilder()
      const required = requirements.addOperator({ operator: "all_of" })
      required.addCourse()
      required.addCourse()
      required.addCourse()

      const program = factories.programs.program({
        requirements: {
          courses: {
            required:
              required.children?.map((n) => ({
                id: n.id,
                readable_id: `readale-${n.id}`,
              })) ?? [],
            electives: [],
          },
          programs: { required: [], electives: [] },
        },
        req_tree: requirements.serialize(),
      })

      renderWithProviders(<ProgramSummary program={program} />)

      const reqRow = screen.getByTestId(TestIds.RequirementsRow)

      expect(reqRow).toHaveTextContent("3 Courses to complete program")
    })
  })

  describe("Duration Row", () => {
    test.each([
      {
        length: "5 weeks",
        effort: "3-5 hours per week",
        expected: "5 weeks, 3-5 hours per week",
      },
      { length: "6 weeks", effort: null, expected: "6 weeks" },
      { length: "", expected: null },
    ])(
      "Renders expected duration in weeks and effort",
      ({ length, effort, expected }) => {
        const program = factories.programs.program({
          page: { length, effort },
        })

        renderWithProviders(<ProgramSummary program={program} />)

        if (!length) {
          expect(screen.queryByTestId(TestIds.DurationRow)).toBeNull()
        } else {
          const durationRow = screen.getByTestId(TestIds.DurationRow)
          expect(durationRow).toHaveTextContent(`Estimated: ${expected}`)
        }
      },
    )

    test("Does not crash and hides duration row when program page is null", () => {
      const program = factories.programs.program({ page: null })
      renderWithProviders(<ProgramSummary program={program} />)

      expect(screen.queryByTestId(TestIds.DurationRow)).toBeNull()
    })
  })

  describe("Pacing Row", () => {
    const courses = {
      selfPaced: makeCourse({
        courseruns: [makeRun({ is_self_paced: true })],
      }),
      instructorPaced: makeCourse({
        courseruns: [makeRun({ is_self_paced: false, is_archived: false })],
      }),
      archived: makeCourse({
        // counts as self-paced.
        courseruns: [makeRun({ is_self_paced: false, is_archived: true })],
      }),
      noRuns: makeCourse({
        courseruns: [],
      }),
    }

    test.each([
      { courses: [courses.selfPaced], expected: "Self-Paced" },
      { courses: [courses.archived], expected: "Self-Paced" },
      { courses: [courses.instructorPaced], expected: "Instructor-Paced" },
      {
        courses: [courses.selfPaced, courses.instructorPaced],
        expected: "Instructor-Paced",
      },
      {
        courses: [courses.noRuns, courses.instructorPaced],
        expected: "Instructor-Paced",
      },
      {
        courses: [courses.noRuns, courses.selfPaced],
        expected: "Self-Paced",
      },
    ])("Shows correct pacing information", ({ courses, expected }) => {
      const program = factories.programs.program()
      renderWithProviders(
        <ProgramSummary program={program} courses={courses} />,
      )
      const paceRow = screen.getByTestId(TestIds.PaceRow)
      expect(paceRow).toHaveTextContent(`Course Format: ${expected}`)
    })

    test.each([
      { courses: [courses.selfPaced], dialogName: /What are Self-Paced/ },
      {
        courses: [courses.instructorPaced],
        dialogName: /What are Instructor-Paced/,
      },
      {
        courses: [courses.selfPaced, courses.instructorPaced],
        dialogName: /What are Instructor-Paced/,
      },
      {
        courses: [courses.archived],
        dialogName: /What are Self-Paced/,
      },
    ])("Renders expected dialog", async ({ courses, dialogName }) => {
      const program = factories.programs.program()
      renderWithProviders(
        <ProgramSummary program={program} courses={courses} />,
      )
      const paceRow = screen.getByTestId(TestIds.PaceRow)
      const button = within(paceRow).getByRole("button", { name: dialogName })
      await user.click(button)
      const dialog = await screen.findByRole("dialog", {
        name: dialogName,
      })

      await user.click(within(dialog).getByRole("button", { name: "Close" }))

      expect(dialog).not.toBeVisible()
    })
  })

  describe("Price & Certificate Row", () => {
    test("Price row does not render when enrollment_modes is empty", () => {
      const program = factories.programs.program({ enrollment_modes: [] })
      renderWithProviders(<ProgramSummary program={program} />)

      expect(screen.queryByTestId(TestIds.PriceRow)).toBeNull()
    })

    test("Shows only 'Free to Learn' with no cert box when all enrollment modes are free", () => {
      const program = factories.programs.program({
        enrollment_modes: [freeMode()],
      })
      renderWithProviders(<ProgramSummary program={program} />)

      const priceRow = screen.getByTestId(TestIds.PriceRow)
      expect(priceRow).toHaveTextContent("Free to Learn")
      expect(priceRow).not.toHaveTextContent("Earn a certificate")
    })

    test("Shows paid price with no cert box when all enrollment modes are paid", () => {
      const product = factories.courses.product({ price: "1499.00" })
      const program = factories.programs.program({
        enrollment_modes: [paidMode()],
        products: [product],
      })
      renderWithProviders(<ProgramSummary program={program} />)

      const priceRow = screen.getByTestId(TestIds.PriceRow)
      expect(priceRow).toHaveTextContent(
        formatPrice(product.price, { avoidCents: true }),
      )
      expect(priceRow).toHaveTextContent("full program")
      expect(priceRow).not.toHaveTextContent("Free to Learn")
      expect(priceRow).not.toHaveTextContent("Earn a certificate")
      expect(priceRow).not.toHaveTextContent("Audit for free")
    })

    test("Shows paid price and 'Start for free' callout when enrollment modes include both free and paid", () => {
      const program = factories.programs.program({
        enrollment_modes: bothModes(),
      })
      invariant(program.products[0])
      renderWithProviders(<ProgramSummary program={program} />)

      const priceRow = screen.getByTestId(TestIds.PriceRow)
      expect(priceRow).toHaveTextContent("Audit for free")
      expect(priceRow).toHaveTextContent("or upgrade to")
      expect(priceRow).toHaveTextContent("certificate")
      expect(priceRow).toHaveTextContent(
        formatPrice(program.products[0].price, { avoidCents: true }),
      )
      expect(priceRow).not.toHaveTextContent("Free to Learn")
      expect(priceRow).not.toHaveTextContent("Earn a certificate")
    })

    test.each([
      { hasFinancialAid: true, expectLink: true },
      { hasFinancialAid: false, expectLink: false },
    ])(
      "Program financial aid link is displayed if and only if URL is non-empty (hasFinancialAid=$hasFinancialAid)",
      ({ hasFinancialAid, expectLink }) => {
        const financialAidUrl = hasFinancialAid
          ? `/financial-aid/${faker.string.alphanumeric(10)}`
          : ""
        const program = factories.programs.program({
          enrollment_modes: bothModes(),
          page: { financial_assistance_form_url: financialAidUrl },
        })

        if (hasFinancialAid) {
          const product = program.products[0]
          invariant(product)
          setMockResponse.get(
            urls.products.userFlexiblePriceDetail(product.id),
            makeFlexiblePrice({ id: product.id, price: product.price }),
          )
        }

        renderWithProviders(<ProgramSummary program={program} />, {
          user: { is_authenticated: true },
        })

        const priceRow = screen.getByTestId(TestIds.PriceRow)

        if (expectLink) {
          const link = within(priceRow).getByRole("link", {
            name: /financial assistance/i,
          })
          const expectedUrl = mitxonlineLegacyUrl(financialAidUrl)
          expect(link).toHaveAttribute("href", expectedUrl)
          expect(link).toHaveTextContent("Financial assistance available")
        } else {
          const link = within(priceRow).queryByRole("link", {
            name: /financial assistance/i,
          })
          expect(link).toBeNull()
        }
      },
    )

    test("Displays discounted price with strikethrough original when approved financial aid exists", async () => {
      const originalPrice = "200.00"
      const discountedAmount = "75.00"
      const product = makeProduct({ price: originalPrice })
      const financialAidUrl = `/financial-aid/${faker.string.alphanumeric(10)}`
      const program = factories.programs.program({
        enrollment_modes: bothModes(),
        products: [product],
        page: { financial_assistance_form_url: financialAidUrl },
      })
      const flexiblePrice = makeFlexiblePrice({
        id: product.id,
        price: originalPrice,
        product_flexible_price: {
          id: faker.number.int(),
          amount: discountedAmount,
          discount_type: "dollars-off" as const,
          discount_code: faker.string.alphanumeric(8),
          redemption_type: "one-time" as const,
          is_redeemed: false,
          automatic: true,
          max_redemptions: 1,
          payment_type: null,
          activation_date: faker.date.past().toISOString(),
          expiration_date: faker.date.future().toISOString(),
        },
      })

      setMockResponse.get(
        urls.products.userFlexiblePriceDetail(product.id),
        flexiblePrice,
      )

      renderWithProviders(<ProgramSummary program={program} />, {
        user: { is_authenticated: true },
      })

      const priceRow = screen.getByTestId(TestIds.PriceRow)

      // Wait for flexible price API response and label update
      // Discounted price: $200 - $75 = $125
      await within(priceRow).findByText("Financial assistance applied")
      expect(priceRow).toHaveTextContent("$125")
      expect(priceRow).toHaveTextContent("$200")
    })

    test("Shows 'Financial assistance available' when financial aid URL exists but no discount is applied", async () => {
      const product = makeProduct({ price: "300.00" })
      const financialAidUrl = `/financial-aid/${faker.string.alphanumeric(10)}`
      const program = factories.programs.program({
        enrollment_modes: bothModes(),
        products: [product],
        page: { financial_assistance_form_url: financialAidUrl },
      })

      setMockResponse.get(
        urls.products.userFlexiblePriceDetail(product.id),
        makeFlexiblePrice({
          id: product.id,
          price: product.price,
          product_flexible_price: null,
        }),
      )

      renderWithProviders(<ProgramSummary program={program} />, {
        user: { is_authenticated: true },
      })

      const priceRow = screen.getByTestId(TestIds.PriceRow)
      const link = await within(priceRow).findByRole("link", {
        name: /financial assistance/i,
      })
      expect(link).toHaveTextContent("Financial assistance available")
      expect(priceRow).toHaveTextContent(
        formatPrice(product.price, { avoidCents: true }),
      )
    })
  })
})
