import React from "react"
import { factories, urls } from "api/mitxonline-test-utils"
import { setMockResponse } from "api/test-utils"
import { renderWithProviders, screen, within, user } from "@/test-utils"
import { CourseSummary, ProgramSummary, TestIds } from "./ProductSummary"
import { formatDate } from "ol-utilities"
import invariant from "tiny-invariant"
import { faker } from "@faker-js/faker/locale/en"

const shuffle = faker.helpers.shuffle
const makeRun = factories.courses.courseRun
const makeCourse = factories.courses.course
const makeProduct = factories.courses.product
const makeFlexiblePrice = factories.products.flexiblePrice
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

describe("Course Financial Assistance", () => {
  test.each([
    { hasFinancialAid: true, expectLink: true },
    { hasFinancialAid: false, expectLink: false },
  ])(
    "Financial aid link is displayed if and only if URL is non-empty (hasFinancialAid=$hasFinancialAid)",
    async ({ hasFinancialAid, expectLink }) => {
      const financialAidUrl = hasFinancialAid
        ? `/financial-aid/${faker.string.alphanumeric(10)}`
        : ""
      const product = makeProduct()
      const run = makeRun({
        is_archived: false,
        products: [product],
        is_enrollable: true,
        is_upgradable: true,
      })
      const course = makeCourse({
        next_run_id: run.id,
        courseruns: [run],
        page: { financial_assistance_form_url: financialAidUrl },
      })

      // Mock the flexible price API response when financial aid is available
      if (hasFinancialAid) {
        const mockFlexiblePrice = makeFlexiblePrice({
          id: product.id,
          price: product.price,
          product_flexible_price: null,
        })
        setMockResponse.get(
          urls.products.userFlexiblePriceDetail(product.id),
          mockFlexiblePrice,
        )
      }

      renderWithProviders(<CourseSummary course={course} />)

      const summary = await screen.findByRole("region", {
        name: "Course summary",
      })
      const priceRow = within(summary).getByTestId(TestIds.PriceRow)

      if (expectLink) {
        const link = await within(priceRow).findByRole("link", {
          name: /financial assistance/i,
        })
        const expectedUrl = new URL(
          financialAidUrl,
          process.env.NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL,
        ).toString()
        expect(link).toHaveAttribute("href", expectedUrl)
        expect(link).toHaveTextContent("Financial assistance available")
      } else {
        const link = within(priceRow).queryByRole("link", {
          name: /financial assistance/i,
        })
        expect(link).toBeNull()
        expect(link).toBeNull()
      }
    },
  )

  test("Displays user-specific discounted price when financial aid is available", async () => {
    const originalPrice = "100.00"
    const discountedAmount = "50.00"
    const product = makeProduct({ price: originalPrice })
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
    const financialAidUrl = `/financial-aid/${faker.string.alphanumeric(10)}`
    const run = makeRun({
      is_archived: false,
      products: [product],
      is_enrollable: true,
      is_upgradable: true,
    })
    const course = makeCourse({
      next_run_id: run.id,
      courseruns: [run],
      page: { financial_assistance_form_url: financialAidUrl },
    })

    setMockResponse.get(
      urls.products.userFlexiblePriceDetail(product.id),
      flexiblePrice,
    )

    renderWithProviders(<CourseSummary course={course} />)

    const summary = await screen.findByRole("region", {
      name: "Course summary",
    })
    const priceRow = within(summary).getByTestId(TestIds.PriceRow)

    // Wait for the flexible price API to be called and prices to be displayed
    // The discounted price is calculated as: $100 - $50 = $50
    await within(priceRow).findByText("Financial assistance applied")
    expect(priceRow).toHaveTextContent("$50.00")
    expect(priceRow).toHaveTextContent("$100.00")
  })

  test("Does NOT call flexible price API when financial aid URL is empty", () => {
    const product = makeProduct({ price: "100.00" })
    const run = makeRun({
      is_archived: false,
      products: [product],
      is_enrollable: true,
      is_upgradable: true,
    })
    const course = makeCourse({
      next_run_id: run.id,
      courseruns: [run],
      page: { financial_assistance_form_url: "" },
    })

    // We're NOT setting up a mock response for the flexible price API
    // If it's called, the test will fail

    renderWithProviders(<CourseSummary course={course} />)

    const summary = screen.getByRole("region", { name: "Course summary" })
    const priceRow = within(summary).getByTestId(TestIds.PriceRow)

    // Should show the regular price
    expect(priceRow).toHaveTextContent(`$${product.price}`)
    // Should NOT show financial assistance link
    expect(
      within(priceRow).queryByRole("link", { name: /financial assistance/i }),
    ).toBeNull()
  })

  test("Does NOT show financial assistance when certificate link is present but products array is empty", () => {
    const financialAidUrl = `/financial-aid/${faker.string.alphanumeric(10)}`
    const run = makeRun({
      is_archived: false,
      products: [],
      is_enrollable: true,
      is_upgradable: false,
    })
    const course = makeCourse({
      next_run_id: run.id,
      courseruns: [run],
      page: { financial_assistance_form_url: financialAidUrl },
    })

    renderWithProviders(<CourseSummary course={course} />)

    const summary = screen.getByRole("region", { name: "Course summary" })
    const priceRow = within(summary).getByTestId(TestIds.PriceRow)

    // Should show "Certificate deadline passed" since no products
    expect(priceRow).toHaveTextContent("Certificate deadline passed")

    // Certificate link should be present
    const certLink = within(priceRow).getByRole("link", {
      name: /Learn More/i,
    })
    expect(certLink).toBeInTheDocument()

    // Financial assistance link should NOT be present
    expect(
      within(priceRow).queryByRole("link", { name: /financial assistance/i }),
    ).toBeNull()
  })
})

describe("ProgramSummary", () => {
  test("renders program summary", async () => {
    const program = factories.programs.program()
    renderWithProviders(<ProgramSummary program={program} />)

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

    renderWithProviders(<ProgramSummary program={program} />)

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

    renderWithProviders(<ProgramSummary program={program} />)

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

      renderWithProviders(<ProgramSummary program={program} />)
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
    renderWithProviders(<ProgramSummary program={program} courses={courses} />)
    const summary = screen.getByRole("region", { name: "Program summary" })
    const paceRow = within(summary).getByTestId(TestIds.PaceRow)
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
    renderWithProviders(<ProgramSummary program={program} courses={courses} />)
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
    renderWithProviders(<ProgramSummary program={program} />)

    const summary = screen.getByRole("region", { name: "Program summary" })
    const priceRow = within(summary).getByTestId(TestIds.PriceRow)

    expect(priceRow).toHaveTextContent("Free to Learn")
  })

  test("Renders certificate information", () => {
    const program = factories.programs.program()
    invariant(program.page.price)
    renderWithProviders(<ProgramSummary program={program} />)

    const summary = screen.getByRole("region", { name: "Program summary" })
    const certRow = within(summary).getByTestId(TestIds.PriceRow)

    expect(certRow).toHaveTextContent("Certificate Track")
    expect(certRow).toHaveTextContent(program.page.price)
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
        page: { financial_assistance_form_url: financialAidUrl },
      })
      renderWithProviders(<ProgramSummary program={program} />)

      const summary = screen.getByRole("region", { name: "Program summary" })
      const priceRow = within(summary).getByTestId(TestIds.PriceRow)

      if (expectLink) {
        const link = within(priceRow).getByRole("link", {
          name: /financial assistance/i,
        })
        const expectedUrl = new URL(
          financialAidUrl,
          process.env.NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL,
        ).toString()
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
})
