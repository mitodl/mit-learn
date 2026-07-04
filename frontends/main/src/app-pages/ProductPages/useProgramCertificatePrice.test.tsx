import React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import {
  renderHook,
  renderWithProviders,
  screen,
  waitFor,
  setMockResponse,
} from "@/test-utils"
import { makeBrowserQueryClient } from "@/app/getQueryClient"
import {
  makeRequest,
  urls as apiUrls,
  factories as apiFactories,
} from "api/test-utils"
import { urls, factories } from "api/mitxonline-test-utils"
import { formatPrice } from "@/common/mitxonline"
import { useProgramCertificatePrice } from "./useProgramCertificatePrice"

const programs = factories.programs
const courses = factories.courses
const makeFlexiblePrice = factories.products.flexiblePrice
const makeDiscount = factories.products.discount
const makeUser = apiFactories.user.user

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = makeBrowserQueryClient({ maxRetries: 0 })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useProgramCertificatePrice", () => {
  beforeEach(() => {
    // Most cases don't exercise financial aid; default to an anonymous user
    // so the (auth-gated) flexible-price query is simply skipped.
    setMockResponse.get(
      apiUrls.userMe.get(),
      makeUser({ is_authenticated: false }),
    )
  })

  test("no product -> all nulls", () => {
    const program = programs.program({ products: [] })

    const { result } = renderHook(() => useProgramCertificatePrice(program), {
      wrapper,
    })

    expect(result.current).toEqual({
      price: null,
      priceBlock: null,
      financialAid: null,
    })
  })

  test("plain price (no savings): price is set, priceBlock and financialAid are null", () => {
    const program = programs.program({
      products: [courses.product({ price: "800" })],
      page: { list_price: "800" },
    })

    const { result } = renderHook(() => useProgramCertificatePrice(program), {
      wrapper,
    })

    expect(result.current.price).toBe(formatPrice(800, { avoidCents: true }))
    expect(result.current.priceBlock).toBeNull()
    expect(result.current.financialAid).toBeNull()
  })

  test("savings: full price shown, list price struck, savings line present, price is null", () => {
    const program = programs.program({
      products: [courses.product({ price: "800" })],
      page: { list_price: "1000" },
    })

    const { result } = renderHook(() => useProgramCertificatePrice(program), {
      wrapper,
    })
    renderWithProviders(<>{result.current.priceBlock}</>)

    expect(screen.getByText("$800")).toBeInTheDocument()
    expect(
      screen.getByText("purchased separately", { exact: false }),
    ).toBeInTheDocument()
    expect(screen.getByText("Save $200")).toBeInTheDocument()
    expect(result.current.price).toBeNull()
  })

  test("showSavings: false suppresses the savings block even when savings data is present", () => {
    const program = programs.program({
      products: [courses.product({ price: "800" })],
      page: { list_price: "1000" },
    })

    const { result } = renderHook(
      () => useProgramCertificatePrice(program, { showSavings: false }),
      { wrapper },
    )

    expect(result.current.price).toBe(formatPrice(800, { avoidCents: true }))
    expect(result.current.priceBlock).toBeNull()
  })

  describe("financial aid", () => {
    test("finaid available, not approved -> applied: false, displayed price unaffected", async () => {
      const product = courses.product({ price: "800" })
      const program = programs.program({
        enrollment_modes: [courses.enrollmentMode({ requires_payment: true })],
        products: [product],
        page: {
          list_price: "800",
          financial_assistance_form_url: "/financial-aid/foo",
        },
      })
      setMockResponse.get(
        apiUrls.userMe.get(),
        makeUser({ is_authenticated: true }),
      )
      setMockResponse.get(
        urls.products.userFlexiblePriceDetail(product.id),
        makeFlexiblePrice({ product_flexible_price: null }),
      )

      const { result } = renderHook(() => useProgramCertificatePrice(program), {
        wrapper,
      })

      await waitFor(() =>
        expect(makeRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            url: urls.products.userFlexiblePriceDetail(product.id),
          }),
        ),
      )
      await waitFor(() =>
        expect(result.current.financialAid?.applied).toBe(false),
      )
      expect(result.current.price).toBe(formatPrice(800, { avoidCents: true }))
    })

    test("approved flexible price -> applied: true, displayed price still the full price", async () => {
      const product = courses.product({ price: "800" })
      const program = programs.program({
        enrollment_modes: [courses.enrollmentMode({ requires_payment: true })],
        products: [product],
        page: {
          list_price: "800",
          financial_assistance_form_url: "/financial-aid/foo",
        },
      })
      setMockResponse.get(
        apiUrls.userMe.get(),
        makeUser({ is_authenticated: true }),
      )
      setMockResponse.get(
        urls.products.userFlexiblePriceDetail(product.id),
        makeFlexiblePrice({
          product_flexible_price: makeDiscount({
            amount: "700",
            discount_type: "dollars-off",
          }),
        }),
      )

      const { result } = renderHook(() => useProgramCertificatePrice(program), {
        wrapper,
      })

      await waitFor(() =>
        expect(result.current.financialAid?.applied).toBe(true),
      )
      expect(result.current.price).toBe(formatPrice(800, { avoidCents: true }))
    })

    test("free-only program with finaid url -> flexible-price endpoint is never requested", async () => {
      const product = courses.product({ price: "800" })
      const program = programs.program({
        enrollment_modes: [courses.enrollmentMode({ requires_payment: false })],
        products: [product],
        page: {
          financial_assistance_form_url: "/financial-aid/foo",
        },
      })
      setMockResponse.get(
        apiUrls.userMe.get(),
        makeUser({ is_authenticated: true }),
      )
      // No mock for userFlexiblePriceDetail — it must NOT be requested

      const { result } = renderHook(() => useProgramCertificatePrice(program), {
        wrapper,
      })

      await waitFor(() =>
        expect(result.current.price).toBe(
          formatPrice(800, { avoidCents: true }),
        ),
      )
      expect(makeRequest).not.toHaveBeenCalledWith(
        expect.objectContaining({
          url: urls.products.userFlexiblePriceDetail(product.id),
        }),
      )
    })
  })
})
