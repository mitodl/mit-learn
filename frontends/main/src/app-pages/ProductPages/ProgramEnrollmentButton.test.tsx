import React from "react"
import {
  renderWithProviders,
  setMockResponse,
  screen,
  user,
} from "@/test-utils"
import ProgramEnrollmentButton from "./ProgramEnrollmentButton"
import {
  urls as mitxUrls,
  factories as mitxFactories,
} from "api/mitxonline-test-utils"
import { V2UserProgramEnrollmentDetail } from "@mitodl/mitxonline-api-axios/v2"

const makeProgram = mitxFactories.programs.program
const programEnrollment = mitxFactories.enrollment.programEnrollmentV2

describe("ProgramEnrollmentButton", () => {
  const ENROLLED = "Enrolled"
  const ENROLL = "Enroll for Free"

  test("Renders loading state then 'Enrolled' for enrolled users", async () => {
    const program = makeProgram()
    const enrollments = [
      programEnrollment(),
      programEnrollment({ program: { id: program.id } }),
      programEnrollment(),
    ]
    const response = Promise.withResolvers()

    setMockResponse.get(
      mitxUrls.programEnrollments.enrollmentsListV2(),
      response.promise,
    )

    renderWithProviders(<ProgramEnrollmentButton program={program} />)

    await Promise.resolve() // tick forward
    screen.getByRole("progressbar", { name: "Loading" })
    expect(screen.queryByText(ENROLLED)).toBeNull()

    // resolve
    response.resolve(enrollments)
    await screen.findByText(ENROLLED)
    expect(screen.queryByRole("progressbar", { name: "Loading" })).toBeNull()
  })

  test("Renders loading state then 'Enroll' for unenrolled users", async () => {
    const program = makeProgram()
    const enrollments = [
      programEnrollment(),
      programEnrollment(),
      programEnrollment(),
    ]
    const response = Promise.withResolvers()

    setMockResponse.get(
      mitxUrls.programEnrollments.enrollmentsListV2(),
      response.promise,
    )

    renderWithProviders(<ProgramEnrollmentButton program={program} />)

    await Promise.resolve() // tick forward
    screen.getByRole("progressbar", { name: "Loading" })
    expect(screen.queryByRole("button", { name: ENROLL })).toBeNull()

    // resolve
    response.resolve(enrollments)
    await screen.findByRole("button", { name: ENROLL })
    expect(screen.queryByRole("progressbar", { name: "Loading" })).toBeNull()
  })

  test("Opens enrollment dialog when clicking 'Enroll' button", async () => {
    const program = makeProgram()
    const enrollments: V2UserProgramEnrollmentDetail[] = []

    setMockResponse.get(
      mitxUrls.programEnrollments.enrollmentsListV2(),
      enrollments,
    )
    setMockResponse.get(
      expect.stringContaining(mitxUrls.courses.coursesList()),
      { count: 0, results: [] },
    )

    renderWithProviders(<ProgramEnrollmentButton program={program} />)

    const enrollButton = await screen.findByRole("button", {
      name: ENROLL,
    })

    await user.click(enrollButton)

    await screen.findByRole("dialog", { name: program.title })
  })
})
