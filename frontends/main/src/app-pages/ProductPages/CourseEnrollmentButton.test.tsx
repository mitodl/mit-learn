import React from "react"
import {
  renderWithProviders,
  setMockResponse,
  screen,
  setupLocationMock,
  user,
  waitFor,
} from "@/test-utils"
import CourseEnrollmentButton from "./CourseEnrollmentButton"
import { mockAxiosInstance, urls, factories } from "api/test-utils"
import {
  factories as mitxFactories,
  urls as mitxUrls,
} from "api/mitxonline-test-utils"
import { DASHBOARD_HOME } from "@/common/urls"
import { mitxonlineLegacyUrl } from "@/common/mitxonline"

const makeCourse = mitxFactories.courses.course
const makeRun = mitxFactories.courses.courseRun
const makeEnrollmentMode = mitxFactories.courses.enrollmentMode
const makeProduct = mitxFactories.courses.product
const makeFlexiblePrice = mitxFactories.products.flexiblePrice
const makeUser = factories.user.user

describe("CourseEnrollmentButton", () => {
  const ENROLL_FREE = "Enroll for Free"
  const ACCESS_MATERIALS = "Access Course Materials"

  setupLocationMock()

  test.each([
    { isArchived: true, expectedText: ACCESS_MATERIALS },
    { isArchived: false, expectedText: ENROLL_FREE },
  ])(
    "Shows correct button text for isArchived=$isArchived",
    async ({ isArchived, expectedText }) => {
      const run = makeRun({
        is_archived: isArchived,
        is_enrollable: true,
        enrollment_modes: [makeEnrollmentMode({ requires_payment: false })],
      })
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

  test("Shows 'Enroll Now—$X' for paid-only enrollment", async () => {
    const run = makeRun({
      is_archived: false,
      is_enrollable: true,
      enrollment_modes: [makeEnrollmentMode({ requires_payment: true })],
      products: [makeProduct({ price: "900" })],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))

    renderWithProviders(<CourseEnrollmentButton course={course} />)

    const button = await screen.findByRole("button", {
      name: "Enroll Now—$900",
    })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  test("Shows discounted price when financial aid is applied", async () => {
    const product = makeProduct({ price: "100.00" })
    const flexiblePrice = makeFlexiblePrice({
      id: product.id,
      price: product.price,
      product_flexible_price: {
        id: 1,
        amount: "50.00",
        discount_type: "dollars-off" as const,
        discount_code: "AID",
        redemption_type: "one-time" as const,
        is_redeemed: false,
        automatic: true,
        max_redemptions: 1,
        payment_type: null,
        activation_date: null,
        expiration_date: null,
      },
    })
    const run = makeRun({
      is_archived: false,
      is_enrollable: true,
      is_upgradable: true,
      enrollment_modes: [makeEnrollmentMode({ requires_payment: true })],
      products: [product],
    })
    const course = makeCourse({
      next_run_id: run.id,
      courseruns: [run],
      page: { financial_assistance_form_url: "/financial-aid/" },
    })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(
      mitxUrls.products.userFlexiblePriceDetail(product.id),
      flexiblePrice,
    )

    renderWithProviders(<CourseEnrollmentButton course={course} />)

    // $100 - $50 = $50; accessible name includes both prices
    const button = await screen.findByRole("button", {
      name: "Enroll Now—$50 $100",
    })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  test("Does not crash when course page is null", async () => {
    const run = makeRun({
      is_archived: false,
      is_enrollable: true,
      enrollment_modes: [makeEnrollmentMode({ requires_payment: false })],
    })
    const course = makeCourse({
      next_run_id: run.id,
      courseruns: [run],
      page: null as never,
    })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))

    renderWithProviders(<CourseEnrollmentButton course={course} />)

    const button = await screen.findByRole("button", { name: ENROLL_FREE })
    expect(button).toBeInTheDocument()
  })

  test("Shows loading spinner while basket operations are in progress (paid)", async () => {
    const product = makeProduct({ price: "500" })
    const run = makeRun({
      is_archived: false,
      is_enrollable: true,
      enrollment_modes: [makeEnrollmentMode({ requires_payment: true })],
      products: [product],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    const promise = new Promise<void>(() => {})
    setMockResponse.delete(mitxUrls.baskets.clear(), promise)

    renderWithProviders(<CourseEnrollmentButton course={course} />)

    const button = await screen.findByRole("button", {
      name: "Enroll Now—$500",
    })
    await user.click(button)

    await screen.findByRole("progressbar", { name: "Loading" })
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent("Enroll Now—$500")
  })

  test("Paid-only: clicking 'Enroll Now' clears basket, adds product, and redirects to cart", async () => {
    const assign = jest.mocked(window.location.assign)
    const product = makeProduct({ price: "500" })
    const run = makeRun({
      is_archived: false,
      is_enrollable: true,
      enrollment_modes: [makeEnrollmentMode({ requires_payment: true })],
      products: [product],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    const clearUrl = mitxUrls.baskets.clear()
    setMockResponse.delete(clearUrl, undefined)
    const basketUrl = mitxUrls.baskets.createFromProduct(product.id)
    setMockResponse.post(basketUrl, { id: 1, items: [] })

    renderWithProviders(<CourseEnrollmentButton course={course} />)

    const button = await screen.findByRole("button", {
      name: "Enroll Now—$500",
    })
    await user.click(button)

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

  test("Shows error alert when basket operation fails (paid)", async () => {
    const product = makeProduct({ price: "500" })
    const run = makeRun({
      is_archived: false,
      is_enrollable: true,
      enrollment_modes: [makeEnrollmentMode({ requires_payment: true })],
      products: [product],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.delete(mitxUrls.baskets.clear(), undefined, { code: 500 })

    renderWithProviders(<CourseEnrollmentButton course={course} />)

    const button = await screen.findByRole("button", {
      name: "Enroll Now—$500",
    })
    await user.click(button)

    await screen.findByText(
      "There was a problem processing your enrollment. Please try again.",
    )
  })

  test("Shows disabled button when there are no enrollment modes", async () => {
    const run = makeRun({
      is_archived: false,
      is_enrollable: true,
      enrollment_modes: [],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))

    renderWithProviders(<CourseEnrollmentButton course={course} />)

    const button = await screen.findByRole("button", { name: ENROLL_FREE })
    expect(button).toBeDisabled()
  })

  test("Shows disabled button for paid-only enrollment with no price", async () => {
    const run = makeRun({
      is_archived: false,
      is_enrollable: true,
      enrollment_modes: [makeEnrollmentMode({ requires_payment: true })],
      products: [],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))

    renderWithProviders(<CourseEnrollmentButton course={course} />)

    const button = await screen.findByRole("button", { name: "Enroll Now" })
    expect(button).toBeDisabled()
  })

  test("Shows 'Enroll for Free' for both free and paid enrollment modes", async () => {
    const run = makeRun({
      is_archived: false,
      is_enrollable: true,
      enrollment_modes: [
        makeEnrollmentMode({ requires_payment: false }),
        makeEnrollmentMode({ requires_payment: true }),
      ],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))

    renderWithProviders(<CourseEnrollmentButton course={course} />)

    const button = await screen.findByRole("button", { name: ENROLL_FREE })
    expect(button).toBeInTheDocument()
  })

  test("Clicking 'Enroll for Free' opens enrollment dialog (both, 1 run)", async () => {
    const run = makeRun({
      is_archived: false,
      is_enrollable: true,
      enrollment_modes: [
        makeEnrollmentMode({ requires_payment: false }),
        makeEnrollmentMode({ requires_payment: true }),
      ],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))

    renderWithProviders(<CourseEnrollmentButton course={course} />)

    const button = await screen.findByRole("button", { name: ENROLL_FREE })
    await user.click(button)

    await screen.findByRole("dialog", { name: course.title })
  })

  test("Opens enrollment dialog when multiple runs are available (free-only, 2 runs)", async () => {
    const run1 = makeRun({
      is_archived: false,
      is_enrollable: true,
      enrollment_modes: [makeEnrollmentMode({ requires_payment: false })],
    })
    const run2 = makeRun({
      is_archived: false,
      is_enrollable: true,
      enrollment_modes: [makeEnrollmentMode({ requires_payment: false })],
    })
    const course = makeCourse({
      next_run_id: run1.id,
      courseruns: [run1, run2],
    })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))

    renderWithProviders(<CourseEnrollmentButton course={course} />)

    const button = await screen.findByRole("button", { name: ENROLL_FREE })
    await user.click(button)

    await screen.findByRole("dialog", { name: course.title })
  })

  test("Opens enrollment dialog when multiple runs are available (paid-only, 2 runs)", async () => {
    const product = makeProduct({ price: "500" })
    const run1 = makeRun({
      is_archived: false,
      is_enrollable: true,
      enrollment_modes: [makeEnrollmentMode({ requires_payment: true })],
      products: [product],
    })
    const run2 = makeRun({
      is_archived: false,
      is_enrollable: true,
      enrollment_modes: [makeEnrollmentMode({ requires_payment: true })],
      products: [makeProduct({ price: "500" })],
    })
    const course = makeCourse({
      next_run_id: run1.id,
      courseruns: [run1, run2],
    })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))

    renderWithProviders(<CourseEnrollmentButton course={course} />)

    const button = await screen.findByRole("button", {
      name: "Enroll Now—$500",
    })
    await user.click(button)

    await screen.findByRole("dialog", { name: course.title })
  })

  test("Non-enrollable runs are ignored: 2 runs but only 1 enrollable takes direct action", async () => {
    const enrollableRun = makeRun({
      is_archived: false,
      is_enrollable: true,
      enrollment_modes: [makeEnrollmentMode({ requires_payment: false })],
    })
    const nonEnrollableRun = makeRun({
      is_archived: false,
      is_enrollable: false,
      enrollment_modes: [makeEnrollmentMode({ requires_payment: true })],
      products: [makeProduct({ price: "500" })],
    })
    const course = makeCourse({
      next_run_id: enrollableRun.id,
      courseruns: [enrollableRun, nonEnrollableRun],
    })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    const enrollUrl = mitxUrls.enrollment.enrollmentsListV1()
    setMockResponse.post(enrollUrl, {})

    const { location } = renderWithProviders(
      <CourseEnrollmentButton course={course} />,
    )

    const button = await screen.findByRole("button", { name: ENROLL_FREE })
    await user.click(button)

    await waitFor(() => {
      expect(location.current.pathname).toBe(DASHBOARD_HOME)
    })

    // No dialog should have opened despite 2 total runs
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  test("Free-only, 1 run: clicking enrolls directly and redirects to dashboard home", async () => {
    const run = makeRun({
      is_archived: false,
      is_enrollable: true,
      enrollment_modes: [makeEnrollmentMode({ requires_payment: false })],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    const enrollUrl = mitxUrls.enrollment.enrollmentsListV1()
    setMockResponse.post(enrollUrl, {})

    const { location } = renderWithProviders(
      <CourseEnrollmentButton course={course} />,
    )

    const button = await screen.findByRole("button", { name: ENROLL_FREE })
    await user.click(button)

    await waitFor(() => {
      expect(location.current.pathname).toBe(DASHBOARD_HOME)
    })

    // No dialog should have opened
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  test("Shows signup popover for anonymous users", async () => {
    const run = makeRun({
      is_archived: false,
      enrollment_modes: [makeEnrollmentMode({ requires_payment: false })],
    })
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
      name: ENROLL_FREE,
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
