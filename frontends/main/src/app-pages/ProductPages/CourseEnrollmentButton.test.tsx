import React from "react"
import {
  renderWithProviders,
  setMockResponse,
  screen,
  user,
} from "@/test-utils"
import CourseEnrollmentButton from "./CourseEnrollmentButton"
import { urls, factories } from "api/test-utils"
import {
  urls as mitxUrls,
  factories as mitxFactories,
} from "api/mitxonline-test-utils"

const makeCourse = mitxFactories.courses.course
const makeRun = mitxFactories.courses.courseRun
const makeUser = factories.user.user

describe("CourseEnrollmentButton", () => {
  const ENROLL = "Enroll for Free"
  const ACCESS_MATERIALS = "Access Course Materials"

  test("Shows 'Enroll for Free' for active course", async () => {
    const run = makeRun({ is_archived: false })
    const course = makeCourse({
      next_run_id: run.id,
      courseruns: [run],
    })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(
      expect.stringContaining(mitxUrls.courses.coursesList()),
      { count: 0, results: [] },
    ) // for the dialog

    renderWithProviders(<CourseEnrollmentButton course={course} />)

    const enrollButton = await screen.findByRole("button", { name: ENROLL })
    expect(enrollButton).toBeInTheDocument()
  })

  test("Shows 'Access Course Materials' for archived courses", async () => {
    const run = makeRun({ is_archived: true })
    const course = makeCourse({
      next_run_id: run.id,
      courseruns: [run],
    })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(
      expect.stringContaining(mitxUrls.courses.coursesList()),
      { count: 0, results: [] },
    ) // for the dialog

    renderWithProviders(<CourseEnrollmentButton course={course} />)

    const accessButton = await screen.findByRole("button", {
      name: ACCESS_MATERIALS,
    })
    expect(accessButton).toBeInTheDocument()
  })

  test("Shows enrollment dialog for authenticated users clicking 'Enroll for Free'", async () => {
    const run = makeRun({ is_archived: false })
    const course = makeCourse({
      next_run_id: run.id,
      courseruns: [run],
    })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(
      expect.stringContaining(mitxUrls.courses.coursesList()),
      { count: 0, results: [] },
    ) // for the dialog

    renderWithProviders(<CourseEnrollmentButton course={course} />)

    const enrollButton = await screen.findByRole("button", { name: ENROLL })
    await user.click(enrollButton)

    await screen.findByRole("dialog", { name: course.title })
  })

  test("Shows enrollment dialog for authenticated users clicking 'Access Course Materials'", async () => {
    const run = makeRun({ is_archived: true })
    const course = makeCourse({
      next_run_id: run.id,
      courseruns: [run],
    })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(
      expect.stringContaining(mitxUrls.courses.coursesList()),
      { count: 0, results: [] },
    ) // for the dialog

    renderWithProviders(<CourseEnrollmentButton course={course} />)

    const accessButton = await screen.findByRole("button", {
      name: ACCESS_MATERIALS,
    })
    await user.click(accessButton)

    await screen.findByRole("dialog", { name: course.title })
  })

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

  test("Returns null if no next run available", async () => {
    const course = makeCourse({
      next_run_id: null,
      courseruns: [],
    })

    setMockResponse.get(
      urls.userMe.get(),
      makeUser({ is_authenticated: false }),
    )

    const { view } = renderWithProviders(
      <CourseEnrollmentButton course={course} />,
    )

    expect(view.container).toBeEmptyDOMElement()
  })
})
