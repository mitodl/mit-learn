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
import { DASHBOARD_HOME } from "@/common/urls"

describe("ProgramEnrollmentDialog", () => {
  setupLocationMock()

  const makeProgram = mitxFactories.programs.program
  const makeProduct = mitxFactories.courses.product

  const openDialog = async (program: V2ProgramDetail) => {
    await act(async () => {
      NiceModal.show(ProgramEnrollmentDialog, { program })
    })
    return await screen.findByRole("dialog")
  }

  test("Dialog opens with program title", async () => {
    const program = makeProgram({ title: "Test Program Title" })
    renderWithProviders(null)
    await openDialog(program)
    expect(screen.getByText("Test Program Title")).toBeInTheDocument()
  })

  test("Shows certificate upsell with price when product is available", async () => {
    const product = makeProduct({ price: "500" })
    const program = makeProgram({ products: [product] })
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
    const program = makeProgram({ products: [] })
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
    const program = makeProgram({ products: [product] })

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
    const expectedCartUrl = new URL(
      "/cart/",
      process.env.NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL,
    ).toString()
    expect(assign).toHaveBeenCalledWith(expectedCartUrl)
  })

  test("'Enroll for Free' button enrolls in program and redirects to dashboard", async () => {
    const program = makeProgram()
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
      expect(location.current.pathname).toBe(DASHBOARD_HOME)
    })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  test("Custom onProgramEnroll: calls callback instead of redirecting", async () => {
    const program = makeProgram()
    const onProgramEnroll = jest.fn()
    const { location } = renderWithProviders(null)

    await act(async () => {
      NiceModal.show(ProgramEnrollmentDialog, { program, onProgramEnroll })
    })
    await screen.findByRole("dialog")

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
    expect(location.current.pathname).not.toBe(DASHBOARD_HOME)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  test("Shows error message when enrollment fails", async () => {
    const program = makeProgram()
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
})
