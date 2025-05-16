import React from "react"
import { renderWithProviders, screen, within } from "@/test-utils"
import OrganizationContent from "./OrganizationContent"
import { setMockResponse } from "api/test-utils"
import { urls, factories } from "api/mitxonline-test-utils"
import { mockOrgData } from "api/mitxonline-hooks/enrollment"
import { useFeatureFlagEnabled } from "posthog-js/react"
import {
  mitxonlineCourses,
  mitxonlineProgram,
  sortDashboardCourses,
} from "./CoursewareDisplay/transform"
import { setupProgramsAndCourses } from "./CoursewareDisplay/test-utils"

const makeCourseEnrollment = factories.enrollment.courseEnrollment
const makeGrade = factories.enrollment.grade

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest
  .mocked(useFeatureFlagEnabled)
  .mockImplementation(() => false)

describe("OrganizationContent", () => {
  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
  })

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
    const cardsA = within(programs[0]).getAllByTestId("enrollment-card-desktop")
    coursesA.forEach((course, i) => {
      expect(cardsA[i]).toHaveTextContent(course.title)
    })
    await within(programs[1]).findByRole("heading", { name: programB.title })
    const cardsB = within(programs[1]).getAllByTestId("enrollment-card-desktop")
    coursesB.forEach((course, i) => {
      expect(cardsB[i]).toHaveTextContent(course.title)
    })
  })

  test("Shows correct enrollment status", async () => {
    const { orgId, programA, coursesA } = setupProgramsAndCourses()
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
    const cards = await within(programElA).findAllByTestId(
      "enrollment-card-desktop",
    )
    expect(cards.length).toBeGreaterThan(0)
    const sortedCourses = sortDashboardCourses(
      mitxonlineProgram(programA),
      mitxonlineCourses({ courses: coursesA, enrollments: enrollments }),
    )
    cards.forEach((card, i) => {
      const course = sortedCourses[i]
      expect(card).toHaveTextContent(course.title)
      const indicator = within(card).getByTestId("enrollment-status")

      if (i === 0) {
        expect(indicator).toHaveTextContent("Enrolled")
      } else if (i === 1) {
        expect(indicator).toHaveTextContent("Completed")
      } else {
        expect(indicator).toHaveTextContent("Not Enrolled")
      }
    })
  })
})
