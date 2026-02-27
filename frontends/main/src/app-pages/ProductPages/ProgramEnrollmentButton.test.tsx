import React from "react"
import {
  renderWithProviders,
  setMockResponse,
  screen,
  user,
} from "@/test-utils"
import ProgramEnrollmentButton from "./ProgramEnrollmentButton"
import { urls, factories } from "api/test-utils"
import {
  urls as mitxUrls,
  factories as mitxFactories,
} from "api/mitxonline-test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { programView } from "@/common/urls"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest
  .mocked(useFeatureFlagEnabled)
  .mockImplementation(() => false)

const makeProgram = mitxFactories.programs.program
const makeProgramEnrollment = mitxFactories.enrollment.programEnrollmentV3
const makeEnrollmentMode = mitxFactories.courses.enrollmentMode
const makeProduct = mitxFactories.courses.product
const makeUser = factories.user.user

describe.each(new Array(100).fill(null))("ProgramEnrollmentButton", () => {
  const ENROLLED = "Enrolled"
  const ENROLL_FREE = "Enroll for Free"

  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(false)
  })

  test("Shows loading state while enrollments and user loading", async () => {
    const program = makeProgram({
      enrollment_modes: [makeEnrollmentMode({ requires_payment: false })],
    })
    const enrollmentResponse = Promise.withResolvers()
    const userResponse = Promise.withResolvers()

    setMockResponse.get(
      mitxUrls.programEnrollments.enrollmentsListV3(),
      enrollmentResponse.promise,
    )
    setMockResponse.get(urls.userMe.get(), userResponse.promise)

    renderWithProviders(<ProgramEnrollmentButton program={program} />)

    await Promise.resolve() // tick forward
    screen.getByRole("progressbar", { name: "Loading" })
    expect(screen.queryByText(ENROLL_FREE)).toBeNull()
    // resolve
    enrollmentResponse.resolve([])
    await enrollmentResponse.promise
    screen.getByRole("progressbar", { name: "Loading" })
    expect(screen.queryByText(ENROLL_FREE)).toBeNull()

    userResponse.resolve(makeUser({ is_authenticated: false }))
    await screen.findByRole("button", { name: ENROLL_FREE })
    expect(screen.queryByRole("progressbar", { name: "Loading" })).toBeNull()
  })

  test("Shows 'Enrolled' button without link when feature flag is off", async () => {
    const program = makeProgram({
      enrollment_modes: [makeEnrollmentMode({ requires_payment: false })],
    })
    const enrollments = [
      makeProgramEnrollment(),
      makeProgramEnrollment({ program: { id: program.id } }),
      makeProgramEnrollment(),
    ]
    const user = makeUser({ is_authenticated: true })

    setMockResponse.get(
      mitxUrls.programEnrollments.enrollmentsListV3(),
      enrollments,
    )
    setMockResponse.get(urls.userMe.get(), user)

    renderWithProviders(<ProgramEnrollmentButton program={program} />)

    const enrolledButton = await screen.findByText(ENROLLED)
    // When feature flag is off, button should not have href
    expect(enrolledButton.closest("a")).toHaveAttribute("href", "")
  })

  test("Shows 'Enrolled' button with dashboard link when feature flag is on", async () => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)

    const program = makeProgram({
      enrollment_modes: [makeEnrollmentMode({ requires_payment: false })],
    })
    const enrollments = [
      makeProgramEnrollment(),
      makeProgramEnrollment({ program: { id: program.id } }),
      makeProgramEnrollment(),
    ]
    const user = makeUser({ is_authenticated: true })

    setMockResponse.get(
      mitxUrls.programEnrollments.enrollmentsListV3(),
      enrollments,
    )
    setMockResponse.get(urls.userMe.get(), user)

    renderWithProviders(<ProgramEnrollmentButton program={program} />)

    const enrolledLink = await screen.findByRole("link", { name: ENROLLED })
    expect(enrolledLink).toHaveAttribute("href", programView(program.id))
  })

  test("Shows 'Enroll for Free' + enrollment dialog for unenrolled users", async () => {
    const program = makeProgram({
      enrollment_modes: [makeEnrollmentMode({ requires_payment: false })],
    })
    const enrollments = [
      makeProgramEnrollment(),
      makeProgramEnrollment(),
      makeProgramEnrollment(),
    ]

    setMockResponse.get(
      mitxUrls.programEnrollments.enrollmentsListV3(),
      enrollments,
    )
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(
      expect.stringContaining(mitxUrls.courses.coursesList()),
      { count: 0, results: [] },
    ) // for the dialog

    renderWithProviders(<ProgramEnrollmentButton program={program} />)

    const enrollButton = await screen.findByRole("button", {
      name: ENROLL_FREE,
    })
    await user.click(enrollButton)

    await screen.findByRole("dialog", { name: program.title })
  })

  test("Shows 'Enroll Now - $X' for paid-only enrollment", async () => {
    const program = makeProgram({
      enrollment_modes: [makeEnrollmentMode({ requires_payment: true })],
      products: [makeProduct({ price: "1500" })],
    })

    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])
    setMockResponse.get(
      urls.userMe.get(),
      makeUser({ is_authenticated: false }),
    )

    renderWithProviders(<ProgramEnrollmentButton program={program} />)

    const button = await screen.findByRole("button", {
      name: "Enroll Now—$1500",
    })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  test("Shows disabled button for paid-only enrollment with no price", async () => {
    const program = makeProgram({
      enrollment_modes: [makeEnrollmentMode({ requires_payment: true })],
      products: [],
    })

    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])
    setMockResponse.get(
      urls.userMe.get(),
      makeUser({ is_authenticated: false }),
    )

    renderWithProviders(<ProgramEnrollmentButton program={program} />)

    const button = await screen.findByRole("button", { name: "Enroll Now" })
    expect(button).toBeDisabled()
  })

  test("Shows 'Enroll for Free' for both free and paid enrollment modes", async () => {
    const program = makeProgram({
      enrollment_modes: [
        makeEnrollmentMode({ requires_payment: false }),
        makeEnrollmentMode({ requires_payment: true }),
      ],
    })

    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])
    setMockResponse.get(
      urls.userMe.get(),
      makeUser({ is_authenticated: false }),
    )

    renderWithProviders(<ProgramEnrollmentButton program={program} />)

    const button = await screen.findByRole("button", { name: ENROLL_FREE })
    expect(button).toBeInTheDocument()
  })

  test("Shows signup popover for anonymous users", async () => {
    const program = makeProgram({
      enrollment_modes: [makeEnrollmentMode({ requires_payment: false })],
    })

    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [], {
      code: 403,
    })
    setMockResponse.get(
      urls.userMe.get(),
      makeUser({ is_authenticated: false }),
    )

    renderWithProviders(<ProgramEnrollmentButton program={program} />)

    const enrollButton = await screen.findByRole("button", {
      name: ENROLL_FREE,
    })

    await user.click(enrollButton)

    screen.getByTestId("signup-popover")
  })
})
