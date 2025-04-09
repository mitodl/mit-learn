import React from "react"
import { renderWithProviders, screen, within } from "@/test-utils"
import OrganizationContent from "./OrganizationContent"
import * as u from "api/test-utils"
import { setMockResponse } from "api/test-utils"
import { urls, factories } from "api/mitxonline-test-utils"
import { mockOrgData } from "api/mitxonline-hooks/enrollment"
import { useFeatureFlagEnabled } from "posthog-js/react"

const makeCourseEnrollment = factories.enrollment.courseEnrollment
const makeGrade = factories.enrollment.grade
const makeProgram = factories.programs.program
const makeCourses = factories.courses.courses

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest
  .mocked(useFeatureFlagEnabled)
  .mockImplementation(() => false)

describe("OrganizationContent", () => {
  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
  })

  const setupProgramsAndCourses = () => {
    const user = u.factories.user.user()
    setMockResponse.get(u.urls.userMe.get(), user)

    const orgId = mockOrgData.orgX.id
    const coursesA = makeCourses({ count: 4 })
    const coursesB = makeCourses({ count: 3 })
    const programA = makeProgram({
      courses: coursesA.results.map((c) => c.id),
    })
    const programB = makeProgram({
      courses: coursesB.results.map((c) => c.id),
    })

    setMockResponse.get(
      urls.programs.programsList({ orgId: mockOrgData.orgX.id }),
      { results: [programA, programB] },
    )
    setMockResponse.get(urls.courses.coursesList({ id: programA.courses }), {
      results: coursesA.results,
    })
    setMockResponse.get(urls.courses.coursesList({ id: programB.courses }), {
      results: coursesB.results,
    })

    return {
      orgId,
      user,
      programA,
      programB,
      coursesA: coursesA.results,
      coursesB: coursesB.results,
    }
  }

  it("displays a header for each program returned and cards for courses in program", async () => {
    const { orgId, programA, programB, coursesA, coursesB } =
      setupProgramsAndCourses()
    setMockResponse.get(urls.enrollment.courseEnrollment({ orgId }), [])
    renderWithProviders(<OrganizationContent orgId={orgId} />)

    await screen.findByRole("heading", {
      name: `Your ${mockOrgData.orgX.name} Home`,
    })
    const programs = await screen.findAllByTestId("org-program-root")
    expect(programs.length).toBe(2)

    await within(programs[0]).findByRole("heading", { name: programA.title })
    const cardsA = within(programs[0]).getAllByTestId("enrollment-card")
    coursesA.forEach((course, i) => {
      expect(cardsA[i]).toHaveTextContent(course.title)
    })
    await within(programs[1]).findByRole("heading", { name: programB.title })
    const cardsB = within(programs[1]).getAllByTestId("enrollment-card")
    coursesB.forEach((course, i) => {
      expect(cardsB[i]).toHaveTextContent(course.title)
    })
  })

  test("Shows correct enrollment status", async () => {
    const { orgId, coursesA } = setupProgramsAndCourses()
    const enrollments = [
      makeCourseEnrollment({
        run: { course: { id: coursesA[0].id, title: coursesA[0].title } },
        grades: [makeGrade({ passed: true })],
      }),
      makeCourseEnrollment({
        run: { course: { id: coursesA[1].id, title: coursesA[1].title } },
        grades: [],
      }),
    ]
    setMockResponse.get(
      urls.enrollment.courseEnrollment({ orgId }),
      enrollments,
    )
    renderWithProviders(<OrganizationContent orgId={orgId} />)

    const [programElA] = await screen.findAllByTestId("org-program-root")
    const cards = await within(programElA).findAllByTestId("enrollment-card")
    expect(cards.length).toBeGreaterThan(0)
    cards.forEach((card, i) => {
      const course = coursesA[i]
      expect(card).toHaveTextContent(course.title)
      const indicator = within(card).getByTestId("enrollment-status")

      if (i === 0) {
        expect(indicator).toHaveTextContent("Completed")
      } else if (i === 1) {
        expect(indicator).toHaveTextContent("Enrolled")
      } else {
        expect(indicator).toHaveTextContent("Not Enrolled")
      }
    })
  })
})
