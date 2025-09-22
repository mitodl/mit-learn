import React from "react"
import { factories } from "api/mitxonline-test-utils"

import { renderWithProviders, screen, within, user } from "@/test-utils"
import { CourseSummary, TestIds } from "./CourseSummary"
import { formatDate } from "ol-utilities"
import invariant from "tiny-invariant"
import { faker } from "@faker-js/faker/locale/en"

const shuffle = faker.helpers.shuffle
const makeRun = factories.courses.courseRun
const makeCourse = factories.courses.course
const product = factories.courses.product

describe("CourseSummary", () => {
  test("renders course summary", async () => {
    const course = makeCourse()
    renderWithProviders(<CourseSummary course={course} />)

    const summary = screen.getByRole("region", { name: "Course summary" })
    within(summary).getByRole("heading", { name: "Course summary" })
  })
})

describe("Dates Row", () => {
  test("Renders expected start/end dates", async () => {
    const run = makeRun()
    const course = makeCourse({
      availability: "dated",
      next_run_id: run.id,
      courseruns: shuffle([run, makeRun()]),
    })
    renderWithProviders(<CourseSummary course={course} />)

    const summary = screen.getByRole("region", { name: "Course summary" })
    const datesRow = within(summary).getByTestId(TestIds.DatesRow)

    invariant(run.start_date)
    expect(datesRow).toHaveTextContent(`Start: ${formatDate(run.start_date)}`)

    invariant(run.end_date)
    expect(datesRow).toHaveTextContent(`End: ${formatDate(run.end_date)}`)
  })

  test("Renders 'Start: Anytime' plus and end date for start anytime courses", () => {
    const run = makeRun({ start_date: null })
    const course = makeCourse({
      availability: "anytime",
      courseruns: [run],
      next_run_id: run.id,
    })
    renderWithProviders(<CourseSummary course={course} />)

    const summary = screen.getByRole("region", { name: "Course summary" })
    const datesRow = within(summary).getByTestId(TestIds.DatesRow)

    expect(datesRow).toHaveTextContent("Start: Anytime")

    invariant(run.end_date)
    expect(datesRow).toHaveTextContent(`End: ${formatDate(run.end_date)}`)
  })

  test.each(["", null, undefined])(
    "Renders nothing if start date missing",
    () => {
      const run = makeRun({ start_date: null })
      const course = makeCourse({
        availability: "dated",
        courseruns: shuffle([run, makeRun()]),
        next_run_id: run.id,
      })
      renderWithProviders(<CourseSummary course={course} />)

      const summary = screen.getByRole("region", { name: "Course summary" })
      const datesRow = within(summary).queryByTestId(TestIds.DatesRow)
      expect(datesRow).toBeNull()
    },
  )

  test("Renders no end date if end date missing", () => {
    const run = makeRun({ end_date: null })
    const course = makeCourse({
      availability: "dated",
      courseruns: shuffle([run, makeRun()]),
      next_run_id: run.id,
    })
    renderWithProviders(<CourseSummary course={course} />)

    const summary = screen.getByRole("region", { name: "Course summary" })
    const datesRow = within(summary).getByTestId(TestIds.DatesRow)

    expect(datesRow).not.toHaveTextContent("End")
  })
})

describe("Course Format Row", () => {
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
      renderWithProviders(<CourseSummary course={course} />)

      const summary = screen.getByRole("region", { name: "Course summary" })
      const formatRow = within(summary).getByTestId(TestIds.FormatRow)
      expect(formatRow).toHaveTextContent("Course Format: Self-Paced")

      const link = within(formatRow).getByRole("link", { name: "What's this?" })
      await user.click(link)
      const dialog = await screen.findByRole("dialog", {
        name: "What are Self-Paced courses?",
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
    renderWithProviders(<CourseSummary course={course} />)

    const summary = screen.getByRole("region", { name: "Course summary" })
    const formatRow = within(summary).getByTestId(TestIds.FormatRow)
    expect(formatRow).toHaveTextContent("Course Format: Instructor-Paced")

    const link = within(formatRow).getByRole("link", {
      name: "What's this?",
    })

    await user.click(link)
    const dialog = await screen.findByRole("dialog", {
      name: "What are Instructor-Paced courses?",
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

      renderWithProviders(<CourseSummary course={course} />)

      const summary = screen.getByRole("region", { name: "Course summary" })

      if (!length) {
        expect(within(summary).queryByTestId(TestIds.DurationRow)).toBeNull()
      } else {
        const durationRow = within(summary).getByTestId(TestIds.DurationRow)
        expect(durationRow).toHaveTextContent(`Estimated: ${expected}`)
      }
    },
  )
})

describe("Price Row", () => {
  test.each([
    {
      label: "has no products",
      runOverrides: { is_archived: false, products: [] },
    },
    {
      label: "is archived",
      runOverrides: { is_archived: true, products: [product()] },
    },
  ])("Does not offer certificate if $label", ({ runOverrides }) => {
    const run = makeRun(runOverrides)
    const course = makeCourse({
      next_run_id: run.id,
      courseruns: shuffle([run, makeRun()]),
    })
    renderWithProviders(<CourseSummary course={course} />)
    const summary = screen.getByRole("region", { name: "Course summary" })
    const priceRow = within(summary).getByTestId(TestIds.PriceRow)

    expect(priceRow).not.toHaveTextContent("Payment deadline")
    expect(priceRow).toHaveTextContent("Certificate deadline passed")

    expect(priceRow).toHaveTextContent("Free to Learn")
  })

  test("Offers certificate upgrade if not archived and has product", () => {
    const run = makeRun({ is_archived: false, products: [product()] })
    const course = makeCourse({
      next_run_id: run.id,
      courseruns: shuffle([run, makeRun()]),
    })
    renderWithProviders(<CourseSummary course={course} />)
    const summary = screen.getByRole("region", { name: "Course summary" })
    const priceRow = within(summary).getByTestId(TestIds.PriceRow)

    expect(priceRow).toHaveTextContent(
      `Certificate Track: $${run.products[0].price}`,
    )
    invariant(run.upgrade_deadline)
    expect(priceRow).toHaveTextContent(
      `Payment deadline: ${formatDate(run.upgrade_deadline)}`,
    )
    expect(priceRow).not.toHaveTextContent("Certificate deadline passed")
  })
})
