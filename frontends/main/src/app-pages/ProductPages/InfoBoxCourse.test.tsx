import React from "react"
import { factories } from "api/mitxonline-test-utils"
import { renderWithProviders, screen } from "@/test-utils"
import CourseInfoBox from "./InfoBoxCourse"

const makeCourse = factories.courses.course

jest.mock("./CourseEnrollmentButton", () => {
  const MockCourseEnrollmentButton = () => (
    <button data-testid="mock-enroll-button">Enroll</button>
  )
  return { __esModule: true, default: MockCourseEnrollmentButton }
})

jest.mock("./ProductSummary", () => {
  const actual = jest.requireActual("./ProductSummary")
  return {
    ...actual,
    CourseSummary: () => <div data-testid="mock-course-summary" />,
  }
})

jest.mock("./ProgramBundleUpsell", () => {
  const MockProgramBundleUpsell = ({ programs }: { programs: unknown[] }) => (
    <div data-testid="program-bundle-upsell">{programs.length} program(s)</div>
  )
  return { __esModule: true, default: MockProgramBundleUpsell }
})

describe("CourseInfoBox", () => {
  test("renders summary card section with accessible 'Course summary' heading", () => {
    const course = makeCourse()
    renderWithProviders(<CourseInfoBox course={course} />)
    const heading = screen.getByRole("heading", { name: "Course summary" })
    expect(heading).toBeInTheDocument()
    const section = screen.getByRole("region", { name: "Course summary" })
    expect(section).toBeInTheDocument()
  })

  test("renders course summary", () => {
    const course = makeCourse()
    renderWithProviders(<CourseInfoBox course={course} />)
    expect(screen.getByTestId("mock-course-summary")).toBeInTheDocument()
  })

  test("renders enrollment button", () => {
    const course = makeCourse()
    renderWithProviders(<CourseInfoBox course={course} />)
    expect(screen.getByTestId("mock-enroll-button")).toBeInTheDocument()
  })

  test("renders AskTIM button with text 'AskTIM about this course'", () => {
    const course = makeCourse()
    renderWithProviders(<CourseInfoBox course={course} />)
    expect(
      screen.getByRole("button", { name: /AskTIM about this course/ }),
    ).toBeInTheDocument()
  })

  test("renders ProgramBundleUpsell when course has programs", () => {
    const course = makeCourse({
      programs: [
        {
          id: 1,
          title: "Test Program",
          readable_id: "test-prog",
          type: "program",
        },
      ],
    })
    renderWithProviders(<CourseInfoBox course={course} />)
    expect(screen.getByTestId("program-bundle-upsell")).toBeInTheDocument()
  })

  test("does not render ProgramBundleUpsell when course has no programs", () => {
    const course = makeCourse({ programs: [] })
    renderWithProviders(<CourseInfoBox course={course} />)
    expect(
      screen.queryByTestId("program-bundle-upsell"),
    ).not.toBeInTheDocument()
  })
})
