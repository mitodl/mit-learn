import React from "react"
import { factories } from "api/mitxonline-test-utils"
import { factories as learnFactories } from "api/test-utils"
import { renderWithProviders, screen, within, user } from "@/test-utils"
import { CourseSummary, ProgramSummary, TestIds } from "./ProductSummary"
import { formatDate } from "ol-utilities"
import invariant from "tiny-invariant"
import { faker } from "@faker-js/faker/locale/en"

const shuffle = faker.helpers.shuffle
const makeRun = factories.courses.courseRun
const makeCourse = factories.courses.course
const makeProduct = factories.courses.product
const makeResource = learnFactories.learningResources.program
const { RequirementTreeBuilder } = factories.requirements

describe("CourseSummary", () => {
  test("renders course summary", async () => {
    const course = makeCourse()
    renderWithProviders(<CourseSummary course={course} />)

    const summary = screen.getByRole("region", { name: "Course summary" })
    within(summary).getByRole("heading", { name: "Course summary" })
  })

  test.each([
    { overrides: { next_run_id: null }, expectAlert: true },
    { overrides: {}, expectAlert: false },
  ])(
    "If no run is found, renders an alert (alert=$expectAlert)",
    ({ overrides, expectAlert }) => {
      const course = makeCourse(overrides)
      renderWithProviders(<CourseSummary course={course} />)
      const summary = screen.getByRole("region", { name: "Course summary" })
      const alertMessage = within(summary).queryByText(
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
      const course = makeCourse({
        next_run_id: run.id,
        courseruns: shuffle([run, makeRun()]),
      })
      renderWithProviders(<CourseSummary course={course} />)
      const summary = screen.getByRole("region", { name: "Course summary" })
      const alert = within(summary).queryByRole("alert")

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

  test("Renders enrollButton prop when provided", () => {
    const run = makeRun()
    const course = makeCourse({
      next_run_id: run.id,
      courseruns: shuffle([run, makeRun()]),
    })
    const enrollButton = <button>Test Enroll Button</button>
    renderWithProviders(
      <CourseSummary course={course} enrollButton={enrollButton} />,
    )
    const summary = screen.getByRole("region", { name: "Course summary" })
    const button = within(summary).getByRole("button", {
      name: "Test Enroll Button",
    })
    expect(button).toBeInTheDocument()
  })
})

describe("Course Dates Row", () => {
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
      const formatRow = within(summary).getByTestId(TestIds.PaceRow)
      expect(formatRow).toHaveTextContent("Course Format: Self-Paced")

      const button = within(formatRow).getByRole("button", {
        name: "What's this?",
      })
      await user.click(button)
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
    const formatRow = within(summary).getByTestId(TestIds.PaceRow)
    expect(formatRow).toHaveTextContent("Course Format: Instructor-Paced")

    const button = within(formatRow).getByRole("button", {
      name: "What's this?",
    })

    await user.click(button)
    const dialog = await screen.findByRole("dialog", {
      name: "What are Instructor-Paced courses?",
    })

    await user.click(within(dialog).getByRole("button", { name: "Close" }))

    expect(dialog).not.toBeVisible()
  })
})

describe("Course Duration Row", () => {
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

describe("Course Price Row", () => {
  test.each([
    {
      label: "has no products",
      runOverrides: { is_archived: false, products: [] },
    },
    {
      label: "is archived",
      runOverrides: { is_archived: true, products: [makeProduct()] },
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
    const run = makeRun({
      is_archived: false,
      products: [makeProduct()],
      is_enrollable: true,
      is_upgradable: true,
    })
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

describe("ProgramSummary", () => {
  test("renders program summary", async () => {
    const program = factories.programs.program()
    renderWithProviders(
      <ProgramSummary program={program} programResource={null} />,
    )

    const summary = screen.getByRole("region", { name: "Program summary" })
    within(summary).getByRole("heading", { name: "Program summary" })
  })
})

describe("Program RequirementsRow", () => {
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

    renderWithProviders(
      <ProgramSummary program={program} programResource={null} />,
    )

    const summary = screen.getByRole("region", { name: "Program summary" })
    const reqRow = within(summary).getByTestId(TestIds.RequirementsRow)

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

    renderWithProviders(
      <ProgramSummary program={program} programResource={null} />,
    )

    const summary = screen.getByRole("region", { name: "Program summary" })
    const reqRow = within(summary).getByTestId(TestIds.RequirementsRow)

    expect(reqRow).toHaveTextContent("3 Courses to complete program")
  })
})

describe("Program Duration Row", () => {
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

      renderWithProviders(
        <ProgramSummary program={program} programResource={null} />,
      )
      const summary = screen.getByRole("region", { name: "Program summary" })

      if (!length) {
        expect(within(summary).queryByTestId(TestIds.DurationRow)).toBeNull()
      } else {
        const durationRow = within(summary).getByTestId(TestIds.DurationRow)
        expect(durationRow).toHaveTextContent(`Estimated: ${expected}`)
      }
    },
  )
})

describe("Program Pacing Row", () => {
  const SELF_PACED = { code: "self_paced", name: "Self-Paced" } as const
  const INSTRUCTOR_PACED = {
    code: "instructor_paced",
    name: "Instructor-Paced",
  } as const
  test.each([
    { pace: [SELF_PACED], expected: "Self-Paced" },
    { pace: [INSTRUCTOR_PACED], expected: "Instructor-Paced" },
    { pace: [SELF_PACED, INSTRUCTOR_PACED], expected: "Instructor-Paced" },
  ])("Shows correct pacing information", ({ pace, expected }) => {
    const program = factories.programs.program()
    const resource = makeResource({ pace })
    renderWithProviders(
      <ProgramSummary program={program} programResource={resource} />,
    )
    const summary = screen.getByRole("region", { name: "Program summary" })
    const paceRow = within(summary).getByTestId(TestIds.PaceRow)
    expect(paceRow).toHaveTextContent(`Program Format: ${expected}`)
  })

  test.each([
    { pace: [SELF_PACED], dialogName: /What are Self-Paced/ },
    {
      pace: [INSTRUCTOR_PACED],
      dialogName: /What are Instructor-Paced/,
    },
    {
      pace: [SELF_PACED, INSTRUCTOR_PACED],
      dialogName: /What are Instructor-Paced/,
    },
  ])("Renders expected dialog", async ({ pace, dialogName }) => {
    const program = factories.programs.program()
    const resource = makeResource({ pace })
    renderWithProviders(
      <ProgramSummary program={program} programResource={resource} />,
    )
    const summary = screen.getByRole("region", { name: "Program summary" })
    const paceRow = within(summary).getByTestId(TestIds.PaceRow)
    const button = within(paceRow).getByRole("button", { name: "What's this?" })
    await user.click(button)
    const dialog = await screen.findByRole("dialog", {
      name: dialogName,
    })

    await user.click(within(dialog).getByRole("button", { name: "Close" }))

    expect(dialog).not.toBeVisible()
  })
})

describe("Price & Certificate Row", () => {
  test("Shows 'Free to Learn'", () => {
    const program = factories.programs.program()
    renderWithProviders(
      <ProgramSummary program={program} programResource={null} />,
    )

    const summary = screen.getByRole("region", { name: "Program summary" })
    const priceRow = within(summary).getByTestId(TestIds.PriceRow)

    expect(priceRow).toHaveTextContent("Free to Learn")
  })
})

describe("Program Certificate Track Row", () => {
  test("Renders certificate information", () => {
    const program = factories.programs.program()
    renderWithProviders(
      <ProgramSummary program={program} programResource={null} />,
    )

    const summary = screen.getByRole("region", { name: "Program summary" })
    const certRow = within(summary).getByTestId(TestIds.CertificateTrackRow)

    expect(certRow).toHaveTextContent("Certificate Track")
    expect(certRow).toHaveTextContent(
      `${program.min_price}\u2013$${program.max_price}`,
    )
  })
})
