import { act } from "@testing-library/react"
import {
  screen,
  waitFor,
  renderWithProviders,
  user,
  setupLocationMock,
} from "@/test-utils"
import { makeRequest, setMockResponse, urls as apiUrls, factories as apiFactories } from "api/test-utils"
import {
  urls as mitxUrls,
  factories as mitxFactories,
} from "api/mitxonline-test-utils"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import NiceModal from "@ebay/nice-modal-react"
import ProgramEnrollmentDialog from "./ProgramEnrollmentDialog"
import invariant from "tiny-invariant"
import { mitxonlineLegacyUrl } from "@/common/mitxonline"
import * as routes from "@/common/urls"
import { faker } from "@faker-js/faker/locale/en"

describe("ProgramEnrollmentDialog", () => {
  setupLocationMock()

  beforeEach(() => {
    setMockResponse.get(
      apiUrls.userMe.get(),
      apiFactories.user.user({ is_authenticated: false }),
    )
  })

  const makeProgram = mitxFactories.programs.program
  const makeProduct = mitxFactories.courses.product

  const bothEnrollmentModes = () => [
    mitxFactories.courses.enrollmentMode({ requires_payment: false }),
    mitxFactories.courses.enrollmentMode({ requires_payment: true }),
  ]

  const openDialog = async (
    program: V2ProgramDetail,
    { displayAsCourse }: { displayAsCourse?: boolean } = {},
  ) => {
    await act(async () => {
      NiceModal.show(ProgramEnrollmentDialog, { program, displayAsCourse })
    })
    return await screen.findByRole("dialog")
  }

  test("Dialog opens with program title", async () => {
    const program = makeProgram({
      enrollment_modes: bothEnrollmentModes(),
    })
    renderWithProviders(null)
    await openDialog(program)
    expect(screen.getByText(program.title)).toBeInTheDocument()
  })

  test("Shows certificate upsell with price when product is available", async () => {
    const product = makeProduct({ price: "500" })
    const program = makeProgram({
      products: [product],
      enrollment_modes: bothEnrollmentModes(),
    })
    renderWithProviders(null)
    await openDialog(program)
    expect(screen.getByText(/Get Certificate/)).toBeInTheDocument()
    expect(screen.getByText(/\$500/)).toBeInTheDocument()
    const addToCartButton = screen.getByRole("button", {
      name: /Add to Cart.*to get a Certificate/i,
    })
    expect(addToCartButton).toBeEnabled()
  })

  test("Add to Cart button is disabled when no product is available", async () => {
    const program = makeProgram({
      products: [],
      enrollment_modes: bothEnrollmentModes(),
    })
    renderWithProviders(null)
    await openDialog(program)
    const addToCartButton = screen.getByRole("button", {
      name: /Add to Cart.*to get a Certificate/i,
    })
    expect(addToCartButton).toBeDisabled()
  })

  test("Clicking 'Add to Cart' clears basket, adds program product, and redirects", async () => {
    const assign = jest.mocked(window.location.assign)
    const product = makeProduct({ price: "300" })
    invariant(product, "Program must have a product")
    const program = makeProgram({
      products: [product],
      enrollment_modes: bothEnrollmentModes(),
    })

    const clearUrl = mitxUrls.baskets.clear()
    setMockResponse.delete(clearUrl, undefined)
    const basketUrl = mitxUrls.baskets.createFromProduct(product.id)
    setMockResponse.post(basketUrl, { id: 1, items: [] })

    renderWithProviders(null)
    await openDialog(program)

    const addToCartButton = screen.getByRole("button", {
      name: /Add to Cart.*to get a Certificate/i,
    })
    await user.click(addToCartButton)

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: "delete", url: clearUrl }),
      )
    })
    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "post", url: basketUrl }),
    )
    const expectedCartUrl = mitxonlineLegacyUrl("/cart/")
    expect(assign).toHaveBeenCalledWith(expectedCartUrl)
  })

  test("Shows error alert when 'Add to Cart' basket operation fails", async () => {
    const product = makeProduct({ price: "300" })
    const program = makeProgram({
      products: [product],
      enrollment_modes: bothEnrollmentModes(),
    })

    setMockResponse.delete(mitxUrls.baskets.clear(), undefined, { code: 500 })

    renderWithProviders(null)
    await openDialog(program)

    const addToCartButton = screen.getByRole("button", {
      name: /Add to Cart.*to get a Certificate/i,
    })
    await user.click(addToCartButton)

    await screen.findByText(
      "There was a problem processing your enrollment. Please try again.",
    )
  })

  test("'Enroll for Free' button redirects to the dashboard success URL with title in params", async () => {
    const program = makeProgram({ enrollment_modes: bothEnrollmentModes() })
    const { location } = renderWithProviders(null)
    await openDialog(program)

    setMockResponse.post(
      mitxUrls.programEnrollments.enrollmentsListV3(),
      null,
      { code: 201 },
    )

    const enrollButton = screen.getByRole("button", {
      name: /Enroll for Free without a certificate/i,
    })
    expect(enrollButton).toBeEnabled()
    await user.click(enrollButton)

    await waitFor(() => {
      expect(location.current.pathname).toBe(routes.DASHBOARD_HOME)
    })
    expect(location.current.searchParams.get("enrollment_status")).toBe(
      "success",
    )
    expect(location.current.searchParams.get("enrollment_title")).toBe(
      program.title,
    )
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  test("Custom onProgramEnroll: calls callback instead of redirecting", async () => {
    const program = makeProgram({ enrollment_modes: bothEnrollmentModes() })
    const onProgramEnroll = jest.fn()
    const { location } = renderWithProviders(null)

    await act(async () => {
      NiceModal.show(ProgramEnrollmentDialog, { program, onProgramEnroll })
    })
    await screen.findByRole("dialog")
    const initialLocation = `${location.current.pathname}${location.current.search}`

    setMockResponse.post(
      mitxUrls.programEnrollments.enrollmentsListV3(),
      null,
      { code: 201 },
    )

    const enrollButton = screen.getByRole("button", {
      name: /Enroll for Free without a certificate/i,
    })
    await user.click(enrollButton)

    await waitFor(() => {
      expect(onProgramEnroll).toHaveBeenCalled()
    })
    expect(`${location.current.pathname}${location.current.search}`).toBe(
      initialLocation,
    )
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  test("Shows error message when enrollment fails", async () => {
    const program = makeProgram({ enrollment_modes: bothEnrollmentModes() })
    renderWithProviders(null)
    await openDialog(program)

    setMockResponse.post(
      mitxUrls.programEnrollments.enrollmentsListV3(),
      "Enrollment failed",
      { code: 500 },
    )

    const enrollButton = screen.getByRole("button", {
      name: /Enroll for Free without a certificate/i,
    })
    await user.click(enrollButton)

    await waitFor(() => {
      expect(
        screen.getByText(
          /There was a problem enrolling you in this program. Please try again later./i,
        ),
      ).toBeInTheDocument()
    })
  })

  test("Uses 'course' language when displayAsCourse is true", async () => {
    const program = makeProgram({
      enrollment_modes: bothEnrollmentModes(),
    })
    renderWithProviders(null)
    await openDialog(program, { displayAsCourse: true })
    expect(
      screen.getByText(/Would you like to get a certificate for this course\?/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Demonstrates knowledge and skills taught in this course/,
      ),
    ).toBeInTheDocument()
  })

  test("Uses 'program' language by default", async () => {
    const program = makeProgram({
      enrollment_modes: bothEnrollmentModes(),
    })
    renderWithProviders(null)
    await openDialog(program)
    expect(
      screen.getByText(
        /Would you like to get a certificate for this program\?/,
      ),
    ).toBeInTheDocument()
  })

  test("Displays discounted price with strikethrough and 'Financial assistance applied' when approved flexible pricing exists", async () => {
    const originalPrice = "500"
    const discountedAmount = "100.00"
    const product = makeProduct({ price: originalPrice })
    const financialAidUrl = `/financial-aid/${faker.string.alphanumeric(10)}`
    const program = makeProgram({
      products: [product],
      enrollment_modes: bothEnrollmentModes(),
      page: { financial_assistance_form_url: financialAidUrl },
    })

    setMockResponse.get(
      mitxUrls.products.userFlexiblePriceDetail(product.id),
      mitxFactories.products.flexiblePrice({
        id: product.id,
        price: originalPrice,
        product_flexible_price: {
          id: faker.number.int(),
          amount: discountedAmount,
          discount_type: "dollars-off" as const,
          discount_code: faker.string.alphanumeric(8),
          redemption_type: "one-time" as const,
          is_redeemed: false,
          automatic: true,
          max_redemptions: 1,
          payment_type: null,
          activation_date: faker.date.past().toISOString(),
          expiration_date: faker.date.future().toISOString(),
        },
      }),
    )

    renderWithProviders(null, { user: { is_authenticated: true } })
    await openDialog(program)

    // Discounted price: $500 - $100 = $400
    await screen.findByText("Financial assistance applied")
    expect(screen.getByText(/Get Certificate/)).toBeInTheDocument()
    expect(screen.getByText("$400")).toBeInTheDocument()
    expect(screen.getByText("$500")).toBeInTheDocument()
  })

  test("Shows 'Financial assistance available' when financial aid URL exists but no approved discount", async () => {
    const product = makeProduct({ price: "300" })
    const financialAidUrl = `/financial-aid/${faker.string.alphanumeric(10)}`
    const program = makeProgram({
      products: [product],
      enrollment_modes: bothEnrollmentModes(),
      page: { financial_assistance_form_url: financialAidUrl },
    })

    setMockResponse.get(
      mitxUrls.products.userFlexiblePriceDetail(product.id),
      mitxFactories.products.flexiblePrice({
        id: product.id,
        price: product.price,
        product_flexible_price: null,
      }),
    )

    renderWithProviders(null, { user: { is_authenticated: true } })
    await openDialog(program)

    const link = await screen.findByRole("link", {
      name: /financial assistance/i,
    })
    expect(link).toHaveTextContent("Financial assistance available")
    expect(link).toHaveAttribute("href", mitxonlineLegacyUrl(financialAidUrl))
    expect(screen.getByText(/\$300/)).toBeInTheDocument()
  })

  test("Hides certificate upsell for free-only programs", async () => {
    const program = makeProgram({
      enrollment_modes: [
        mitxFactories.courses.enrollmentMode({ requires_payment: false }),
      ],
    })
    renderWithProviders(null)
    await openDialog(program)

    expect(
      screen.queryByText(/Would you like to get a certificate/i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: /Add to Cart.*to get a Certificate/i,
      }),
    ).not.toBeInTheDocument()

    // Confirm button text has no "without a certificate" qualifier
    expect(
      screen.getByRole("button", { name: "Enroll for Free" }),
    ).toBeInTheDocument()
  })
})
