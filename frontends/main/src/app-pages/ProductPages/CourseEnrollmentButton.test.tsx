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
  factories as mitxFactories,
  urls as mitxUrls,
} from "api/mitxonline-test-utils"

const makeCourse = mitxFactories.courses.course
const makeRun = mitxFactories.courses.courseRun
const makeEnrollmentMode = mitxFactories.courses.enrollmentMode
const makeProduct = mitxFactories.courses.product
const makeFlexiblePrice = mitxFactories.products.flexiblePrice
const makeUser = factories.user.user

describe("CourseEnrollmentButton", () => {
  const ENROLL_FREE = "Enroll for Free"
  const ACCESS_MATERIALS = "Access Course Materials"

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
      name: "Enroll Now—$900.00",
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

    // $100 - $50 = $50.00; accessible name includes both prices
    const button = await screen.findByRole("button", {
      name: "Enroll Now—$50.00 $100.00",
    })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
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
