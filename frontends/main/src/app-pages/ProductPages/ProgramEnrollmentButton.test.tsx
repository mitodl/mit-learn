import React from "react"
import {
  renderWithProviders,
  setMockResponse,
  screen,
  setupLocationMock,
  user,
  waitFor,
} from "@/test-utils"
import { mockAxiosInstance, makeRequest, urls, factories } from "api/test-utils"
import ProgramEnrollmentButton from "./ProgramEnrollmentButton"
import {
  urls as mitxUrls,
  factories as mitxFactories,
} from "api/mitxonline-test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { programView } from "@/common/urls"
import { mitxonlineLegacyUrl } from "@/common/mitxonline"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest
  .mocked(useFeatureFlagEnabled)
  .mockImplementation(() => false)

const makeProgram = mitxFactories.programs.program
const makeProgramEnrollment = mitxFactories.enrollment.programEnrollmentV3
const makeEnrollmentMode = mitxFactories.courses.enrollmentMode
const makeProduct = mitxFactories.courses.product
const makeUser = factories.user.user

describe("ProgramEnrollmentButton", () => {
  const ENROLLED = "Enrolled"
  const ENROLL_FREE = "Enroll for Free"

  setupLocationMock()

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

    renderWithProviders(
      <ProgramEnrollmentButton program={program} variant="primary" />,
    )

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

    renderWithProviders(
      <ProgramEnrollmentButton program={program} variant="primary" />,
    )

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

    renderWithProviders(
      <ProgramEnrollmentButton program={program} variant="primary" />,
    )

    const enrolledLink = await screen.findByRole("link", { name: ENROLLED })
    expect(enrolledLink).toHaveAttribute("href", programView(program.id))
  })

  test("Free-only: clicking 'Enroll for Free' enrolls and redirects to the dashboard success URL with title in params", async () => {
    const program = makeProgram({
      enrollment_modes: [makeEnrollmentMode({ requires_payment: false })],
    })
    const { location } = renderWithProviders(
      <ProgramEnrollmentButton program={program} variant="primary" />,
    )

    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.post(
      mitxUrls.programEnrollments.enrollmentsListV3(),
      null,
      { code: 201 },
    )

    const enrollButton = await screen.findByRole("button", {
      name: ENROLL_FREE,
    })
    await user.click(enrollButton)

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        "post",
        mitxUrls.programEnrollments.enrollmentsListV3(),
        { program_id: program.id },
      )
    })
    await waitFor(() => {
      expect(location.current.pathname).toBe("/dashboard")
    })
    expect(location.current.searchParams.get("enrollment_success")).toBe("1")
    expect(location.current.searchParams.get("enrollment_title")).toBe(
      program.title,
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  test("Both: clicking 'Enroll for Free' opens enrollment dialog", async () => {
    const program = makeProgram({
      enrollment_modes: [
        makeEnrollmentMode({ requires_payment: false }),
        makeEnrollmentMode({ requires_payment: true }),
      ],
    })

    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))

    renderWithProviders(
      <ProgramEnrollmentButton program={program} variant="primary" />,
    )

    const enrollButton = await screen.findByRole("button", {
      name: ENROLL_FREE,
    })
    await user.click(enrollButton)

    await screen.findByRole("dialog", { name: program.title })
  })

  test("Paid-only: clicking 'Enroll Now' clears basket, adds product, and redirects", async () => {
    const assign = jest.mocked(window.location.assign)
    const product = makeProduct({ price: "500" })
    const program = makeProgram({
      enrollment_modes: [makeEnrollmentMode({ requires_payment: true })],
      products: [product],
    })

    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    const clearUrl = mitxUrls.baskets.clear()
    setMockResponse.delete(clearUrl, undefined)
    const basketUrl = mitxUrls.baskets.createFromProduct(product.id)
    setMockResponse.post(basketUrl, { id: 1, items: [] })

    renderWithProviders(
      <ProgramEnrollmentButton program={program} variant="primary" />,
    )

    const enrollButton = await screen.findByRole("button", {
      name: /Enroll Now/,
    })
    await user.click(enrollButton)

    await waitFor(() => {
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: "DELETE", url: clearUrl }),
      )
    })
    expect(mockAxiosInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "POST", url: basketUrl }),
    )
    expect(assign).toHaveBeenCalledWith(mitxonlineLegacyUrl("/cart/"))
  })

  test("Shows loading spinner while basket operations are in progress (paid)", async () => {
    const product = makeProduct({ price: "500" })
    const program = makeProgram({
      enrollment_modes: [makeEnrollmentMode({ requires_payment: true })],
      products: [product],
    })

    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    const { promise } = Promise.withResolvers()
    setMockResponse.delete(mitxUrls.baskets.clear(), promise)

    renderWithProviders(
      <ProgramEnrollmentButton program={program} variant="primary" />,
    )

    const button = await screen.findByRole("button", { name: /Enroll Now/ })
    await user.click(button)

    await screen.findByRole("progressbar", { name: "Loading" })
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent("Enroll Now—$500")
  })

  test("Shows error alert when basket operation fails (paid)", async () => {
    const product = makeProduct({ price: "500" })
    const program = makeProgram({
      enrollment_modes: [makeEnrollmentMode({ requires_payment: true })],
      products: [product],
    })

    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.delete(mitxUrls.baskets.clear(), undefined, { code: 500 })

    renderWithProviders(
      <ProgramEnrollmentButton program={program} variant="primary" />,
    )

    const button = await screen.findByRole("button", { name: /Enroll Now/ })
    await user.click(button)

    await screen.findByText(
      "There was a problem processing your enrollment. Please try again.",
    )
  })

  test("Shows error alert when free enrollment API fails", async () => {
    const program = makeProgram({
      enrollment_modes: [makeEnrollmentMode({ requires_payment: false })],
    })

    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.post(
      mitxUrls.programEnrollments.enrollmentsListV3(),
      undefined,
      { code: 500 },
    )

    renderWithProviders(
      <ProgramEnrollmentButton program={program} variant="primary" />,
    )

    const button = await screen.findByRole("button", { name: ENROLL_FREE })
    await user.click(button)

    await screen.findByText(
      "There was a problem processing your enrollment. Please try again.",
    )
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

    renderWithProviders(
      <ProgramEnrollmentButton program={program} variant="primary" />,
    )

    const button = await screen.findByRole("button", {
      name: "Enroll Now—$1,500",
    })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  test("Shows disabled button when there are no enrollment modes", async () => {
    const program = makeProgram({
      enrollment_modes: [],
    })

    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))

    renderWithProviders(
      <ProgramEnrollmentButton program={program} variant="primary" />,
    )

    const button = await screen.findByRole("button", { name: ENROLL_FREE })
    expect(button).toBeDisabled()
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

    renderWithProviders(
      <ProgramEnrollmentButton program={program} variant="primary" />,
    )

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

    renderWithProviders(
      <ProgramEnrollmentButton program={program} variant="primary" />,
    )

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

    renderWithProviders(
      <ProgramEnrollmentButton program={program} variant="primary" />,
    )

    const enrollButton = await screen.findByRole("button", {
      name: ENROLL_FREE,
    })

    await user.click(enrollButton)

    screen.getByTestId("signup-popover")
  })
})
