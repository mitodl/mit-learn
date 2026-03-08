import React from "react"
import { factories } from "api/mitxonline-test-utils"
import { renderWithProviders, screen, within, user } from "@/test-utils"
import ProgramInfoBox, { TestIds } from "./ProgramInfoBox"
import { formatPrice } from "@/common/mitxonline"
import invariant from "tiny-invariant"
import { faker } from "@faker-js/faker/locale/en"

const makeRun = factories.courses.courseRun
const makeCourse = factories.courses.course
const makeEnrollmentMode = factories.courses.enrollmentMode
const { RequirementTreeBuilder } = factories.requirements

// Enrollment mode helpers for common test setups
const freeMode = () => makeEnrollmentMode({ requires_payment: false })
const paidMode = () => makeEnrollmentMode({ requires_payment: true })
const bothModes = () => [freeMode(), paidMode()]

jest.mock("./ProgramEnrollmentButton", () => {
  const MockProgramEnrollmentButton = () => (
    <div data-testid="mock-program-enrollment-button" />
  )
  return {
    __esModule: true,
    default: MockProgramEnrollmentButton,
  }
})

describe("ProgramInfoBox", () => {
  test("renders program summary rows", async () => {
    const program = factories.programs.program({
      enrollment_modes: bothModes(),
    })
    renderWithProviders(<ProgramInfoBox program={program} />)

    screen.getByTestId(TestIds.PriceRow)
  })

  test("renders AskTIM button", () => {
    const program = factories.programs.program({
      enrollment_modes: bothModes(),
    })
    renderWithProviders(<ProgramInfoBox program={program} />)

    screen.getByTestId("ask-tim-button")
  })

  test("renders mocked enrollment button", () => {
    const program = factories.programs.program({
      enrollment_modes: bothModes(),
    })
    renderWithProviders(<ProgramInfoBox program={program} />)

    screen.getByTestId("mock-program-enrollment-button")
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

      renderWithProviders(<ProgramInfoBox program={program} />)

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

      renderWithProviders(<ProgramInfoBox program={program} />)

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

        renderWithProviders(<ProgramInfoBox program={program} />)

        if (!length) {
          expect(screen.queryByTestId(TestIds.DurationRow)).toBeNull()
        } else {
          const durationRow = screen.getByTestId(TestIds.DurationRow)
          expect(durationRow).toHaveTextContent(`Estimated: ${expected}`)
        }
      },
    )
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
        <ProgramInfoBox program={program} courses={courses} />,
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
        <ProgramInfoBox program={program} courses={courses} />,
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
      renderWithProviders(<ProgramInfoBox program={program} />)

      expect(screen.queryByTestId(TestIds.PriceRow)).toBeNull()
    })

    test("Shows only 'Free to Learn' with no cert box when all enrollment modes are free", () => {
      const program = factories.programs.program({
        enrollment_modes: [freeMode()],
      })
      renderWithProviders(<ProgramInfoBox program={program} />)

      const priceRow = screen.getByTestId(TestIds.PriceRow)
      expect(priceRow).toHaveTextContent("Free to Learn")
      expect(priceRow).not.toHaveTextContent("Earn a certificate")
    })

    test("Shows paid price with certificate type and no cert box when all enrollment modes are paid", () => {
      const product = factories.courses.product({ price: "1499.00" })
      const program = factories.programs.program({
        enrollment_modes: [paidMode()],
        products: [product],
      })
      renderWithProviders(<ProgramInfoBox program={program} />)

      const priceRow = screen.getByTestId(TestIds.PriceRow)
      expect(priceRow).toHaveTextContent(formatPrice(product.price))
      expect(priceRow).toHaveTextContent(program.certificate_type)
      expect(priceRow).not.toHaveTextContent("Free to Learn")
      expect(priceRow).not.toHaveTextContent("Earn a certificate")
    })

    test("Shows 'Free to Learn' and cert box when enrollment modes include both free and paid", () => {
      const program = factories.programs.program({
        enrollment_modes: bothModes(),
      })
      invariant(program.products[0])
      renderWithProviders(<ProgramInfoBox program={program} />)

      const priceRow = screen.getByTestId(TestIds.PriceRow)
      expect(priceRow).toHaveTextContent("Free to Learn")
      expect(priceRow).toHaveTextContent("Earn a certificate")
      expect(priceRow).toHaveTextContent(formatPrice(program.products[0].price))
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
        renderWithProviders(<ProgramInfoBox program={program} />)

        const priceRow = screen.getByTestId(TestIds.PriceRow)

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
})
