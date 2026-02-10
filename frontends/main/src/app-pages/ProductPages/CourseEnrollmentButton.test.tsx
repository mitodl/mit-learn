import React from "react"
import {
  renderWithProviders,
  setMockResponse,
  screen,
  user,
} from "@/test-utils"
import CourseEnrollmentButton from "./CourseEnrollmentButton"
import { urls, factories } from "api/test-utils"
import { factories as mitxFactories } from "api/mitxonline-test-utils"

const makeCourse = mitxFactories.courses.course
const makeRun = mitxFactories.courses.courseRun
const makeUser = factories.user.user

describe("CourseEnrollmentButton", () => {
  const ENROLL = "Enroll for Free"
  const ACCESS_MATERIALS = "Access Course Materials"

  test.each([
    { isArchived: true, expectedText: ACCESS_MATERIALS },
    { isArchived: false, expectedText: ENROLL },
  ])(
    "Shows correct button text for isArchived=$isArchived",
    async ({ isArchived, expectedText }) => {
      const run = makeRun({ is_archived: isArchived, is_enrollable: true })
      const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

      setMockResponse.get(
        urls.userMe.get(),
        makeUser({ is_authenticated: true }),
      )

      renderWithProviders(<CourseEnrollmentButton course={course} />)

      const button = await screen.findByRole("button", { name: expectedText })
      expect(button).toBeInTheDocument()
    },
  )

  test("Shows signup popover for anonymous users", async () => {
    const run = makeRun({ is_archived: false })
    const course = makeCourse({
      next_run_id: run.id,
      courseruns: [run],
    })

    setMockResponse.get(
      urls.userMe.get(),
      makeUser({ is_authenticated: false }),
    )

    renderWithProviders(<CourseEnrollmentButton course={course} />)

    const enrollButton = await screen.findByRole("button", {
      name: ENROLL,
    })

    await user.click(enrollButton)

    screen.getByTestId("signup-popover")
  })

  test("Displays disabled button with 'Access Course Materials' text if no next run available", async () => {
    const course = makeCourse({
      next_run_id: null,
      courseruns: [],
    })

    setMockResponse.get(
      urls.userMe.get(),
      makeUser({ is_authenticated: false }),
    )

    renderWithProviders(<CourseEnrollmentButton course={course} />)

    const button = await screen.findByRole("button", {
      name: ACCESS_MATERIALS,
    })
    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
  })
})
