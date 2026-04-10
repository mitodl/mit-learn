import { act } from "@testing-library/react"
import {
  screen,
  waitFor,
  renderWithProviders,
  user,
  setupLocationMock,
} from "@/test-utils"
import { mockAxiosInstance, setMockResponse } from "api/test-utils"
import {
  urls as mitxUrls,
  factories as mitxFactories,
} from "api/mitxonline-test-utils"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import NiceModal from "@ebay/nice-modal-react"
import ProgramEnrollmentDialog from "./ProgramEnrollmentDialog"
import invariant from "tiny-invariant"
import { mitxonlineLegacyUrl } from "@/common/mitxonline"

describe("ProgramEnrollmentDialog", () => {
  setupLocationMock()

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
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: "DELETE", url: clearUrl }),
      )
    })
    expect(mockAxiosInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "POST", url: basketUrl }),
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
      expect(location.current.pathname).toBe("/dashboard")
    })
    expect(location.current.searchParams.get("enrollment_status")).toBe(
      "success",
    )
    expect(location.current.searchParams.get("enrollment_title")).toBe(
      program.title,
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
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
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
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
