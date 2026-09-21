import React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import invariant from "tiny-invariant"
import { renderHook, waitFor, setMockResponse } from "@/test-utils"
import { makeBrowserQueryClient } from "@/app/getQueryClient"
import {
  makeRequest,
  urls as apiUrls,
  factories as apiFactories,
} from "api/test-utils"
import { urls, factories } from "api/mitxonline-test-utils"
import { formatPrice } from "@/common/mitxonline"
import { getTotalRequiredCourses } from "./util"
import { useProgramCertificatePrice } from "./useProgramCertificatePrice"

const programs = factories.programs
const courses = factories.courses
const makeUserPricing = factories.products.userPricing
const makeUserPricingDiscount = factories.products.userPricingDiscount
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
    // so the (auth-gated) pricing query is simply skipped.
    setMockResponse.get(
      apiUrls.userMe.get(),
      makeUser({ is_authenticated: false }),
    )
  })

  test("no product: the advertised price still shows, nothing else does", () => {
    const program = programs.program({ products: [] })
    invariant(program.min_price, "the factory advertises a price")

    const { result } = renderHook(() => useProgramCertificatePrice(program), {
      wrapper,
    })

    expect(result.current).toEqual({
      price: formatPrice(program.min_price, { avoidCents: true }),
      showsRange: false,
      savings: null,
      financialAid: null,
      breakdown: null,
    })
  })

  test("no product and no advertised price -> all nulls", () => {
    const program = programs.program({
      products: [],
      min_price: null,
      max_price: null,
    })

    const { result } = renderHook(() => useProgramCertificatePrice(program), {
      wrapper,
    })

    expect(result.current).toEqual({
      price: null,
      showsRange: false,
      savings: null,
      financialAid: null,
      breakdown: null,
    })
  })

  test("no savings (list price not above product price): price set, savings null", () => {
    const program = programs.program({
      products: [courses.product({ price: "800" })],
      page: { list_price: "800" },
    })

    const { result } = renderHook(() => useProgramCertificatePrice(program), {
      wrapper,
    })

    expect(result.current.price).toBe(formatPrice(800, { avoidCents: true }))
    expect(result.current.savings).toBeNull()
    expect(result.current.financialAid).toBeNull()
  })

  test("savings when list price exceeds product price; price still the full price", () => {
    const program = programs.program({
      products: [courses.product({ price: "800" })],
      page: { list_price: "1000" },
    })

    const { result } = renderHook(() => useProgramCertificatePrice(program), {
      wrapper,
    })

    expect(result.current.savings).toEqual({
      current: { min: 800, max: 800 },
      listAmount: 1000,
      totalCourses: getTotalRequiredCourses(program),
    })
    expect(result.current.price).toBe(formatPrice(800, { avoidCents: true }))
  })

  describe("advertised price range", () => {
    test("an advertised range is displayed in place of the product price", () => {
      const program = programs.program({
        products: [courses.product({ price: "600" })],
        min_price: 250,
        max_price: 1000,
      })

      const { result } = renderHook(() => useProgramCertificatePrice(program), {
        wrapper,
      })

      expect(result.current.price).toBe("$250 – $1,000")
    })

    test("savings are measured against the top of the range", () => {
      const program = programs.program({
        products: [courses.product({ price: "600" })],
        min_price: 250,
        max_price: 1000,
        page: { list_price: "1200" },
      })

      const { result } = renderHook(() => useProgramCertificatePrice(program), {
        wrapper,
      })

      expect(result.current.savings).toEqual({
        current: { min: 250, max: 1000 },
        listAmount: 1200,
        totalCourses: getTotalRequiredCourses(program),
      })
    })

    test("a list price inside the range is not a saving at every price, so savings drop", () => {
      const program = programs.program({
        products: [courses.product({ price: "600" })],
        min_price: 250,
        max_price: 1000,
        page: { list_price: "800" },
      })

      const { result } = renderHook(() => useProgramCertificatePrice(program), {
        wrapper,
      })

      expect(result.current.savings).toBeNull()
      expect(result.current.price).toBe("$250 – $1,000")
    })
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
        urls.products.userPricingDetail(product.id),
        makeUserPricing(),
      )

      const { result } = renderHook(() => useProgramCertificatePrice(program), {
        wrapper,
      })

      await waitFor(() =>
        expect(makeRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            url: urls.products.userPricingDetail(product.id),
          }),
        ),
      )
      await waitFor(() =>
        expect(result.current.financialAid?.applied).toBe(false),
      )
      expect(result.current.price).toBe(formatPrice(800, { avoidCents: true }))
      expect(result.current.breakdown).toBeNull()
    })

    test("approved flexible price that discounts nothing -> no indicator, displayed price still the full price", async () => {
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
        urls.products.userPricingDetail(product.id),
        makeUserPricing({
          product_flexible_price: makeDiscount({
            amount: "700",
            discount_type: "dollars-off",
          }),
        }),
      )

      const { result } = renderHook(() => useProgramCertificatePrice(program), {
        wrapper,
      })

      // APPROVED means mitxonline accepted the declared income, not that the
      // income earned anything: this learner's tier takes nothing off, and the
      // aid form has already told them they did not qualify. Neither "approved"
      // nor "apply" is true, so the indicator goes away rather than claiming a
      // success that did not happen.
      await waitFor(() => expect(result.current.financialAid).toBeNull())
      expect(result.current.breakdown).toBeNull()
      expect(result.current.price).toBe(formatPrice(800, { avoidCents: true }))
    })

    test("approved flexible price that wins the quote -> the indicator reports it", async () => {
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
        urls.products.userPricingDetail(product.id),
        makeUserPricing({
          price: "800",
          user_price: "400",
          product_flexible_price: makeDiscount({
            discount_type: "percent-off",
          }),
          discount: makeUserPricingDiscount({
            discount_type: "percent-off",
            payment_type: "financial-assistance",
            amount_off: "400",
            source: null,
          }),
        }),
      )

      const { result } = renderHook(() => useProgramCertificatePrice(program), {
        wrapper,
      })

      await waitFor(() =>
        expect(result.current.financialAid?.applied).toBe(true),
      )
      expect(result.current.breakdown?.kind).toBe("aid")
    })

    test("free-only program with finaid url -> the quote is never requested", async () => {
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
      // No mock for userPricingDetail — it must NOT be requested

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
          url: urls.products.userPricingDetail(product.id),
        }),
      )
    })
  })
  describe("applied savings", () => {
    /** An authenticated learner on a purchasable program, quoted as given. */
    const setupQuote = (
      quote: Partial<Parameters<typeof makeUserPricing>[0]>,
      programOverrides = {},
    ) => {
      const product = courses.product({ price: "899" })
      const program = programs.program({
        enrollment_modes: [courses.enrollmentMode({ requires_payment: true })],
        products: [product],
        ...programOverrides,
      })
      setMockResponse.get(
        apiUrls.userMe.get(),
        makeUser({ is_authenticated: true }),
      )
      setMockResponse.get(
        urls.products.userPricingDetail(product.id),
        makeUserPricing({ id: product.id, price: "899", ...quote }),
      )
      return { product, program }
    }

    test("a purchase credit names the course it came from", async () => {
      // The factory's default discount is the program-child credit.
      const discount = makeUserPricingDiscount({ amount_off: "300" })
      const { program } = setupQuote({ user_price: "599", discount })

      const { result } = renderHook(() => useProgramCertificatePrice(program), {
        wrapper,
      })

      await waitFor(() =>
        expect(result.current.breakdown).toEqual({
          fullPrice: "$899",
          amountOff: "$300",
          todaysPrice: "$599",
          sourceTitle: discount.source?.title,
          kind: "credit",
        }),
      )
    })

    test("the winning discount is recognized as financial aid by its payment type", async () => {
      const discount = makeUserPricingDiscount({
        discount_type: "dollars-off",
        payment_type: "financial-assistance",
        amount_off: "500",
        source: null,
      })
      const { program } = setupQuote({ user_price: "399", discount })

      const { result } = renderHook(() => useProgramCertificatePrice(program), {
        wrapper,
      })

      await waitFor(() =>
        expect(result.current.breakdown).toEqual({
          fullPrice: "$899",
          amountOff: "$500",
          todaysPrice: "$399",
          sourceTitle: null,
          kind: "aid",
        }),
      )
    })

    test("a discount that is neither still shows its amount", async () => {
      // A payment type that is not aid, so a truthiness test in place of the
      // comparison would misreport this as the learner's aid tier.
      const discount = makeUserPricingDiscount({
        discount_type: "dollars-off",
        payment_type: "sales",
        amount_off: "50",
        source: null,
      })
      const { program } = setupQuote({ user_price: "849", discount })

      const { result } = renderHook(() => useProgramCertificatePrice(program), {
        wrapper,
      })

      await waitFor(() =>
        expect(result.current.breakdown).toEqual({
          fullPrice: "$899",
          amountOff: "$50",
          todaysPrice: "$849",
          sourceTitle: null,
          kind: "other",
        }),
      )
    })

    test("a paid program with no purchasable product is not quoted", async () => {
      setMockResponse.get(
        apiUrls.userMe.get(),
        makeUser({ is_authenticated: true }),
      )
      const program = programs.program({
        enrollment_modes: [courses.enrollmentMode({ requires_payment: true })],
        products: [],
      })

      renderHook(() => useProgramCertificatePrice(program), { wrapper })

      // Without its own product guard the hook asks for product 0.
      await waitFor(() => expect(makeRequest).toHaveBeenCalled())
      expect(makeRequest).not.toHaveBeenCalledWith(
        expect.objectContaining({
          url: urls.products.userPricingDetail(0),
        }),
      )
    })

    test("a program with no financial aid form is quoted anyway", async () => {
      const { product, program } = setupQuote({ user_price: "899" })

      renderHook(() => useProgramCertificatePrice(program), { wrapper })

      await waitFor(() =>
        expect(makeRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            url: urls.products.userPricingDetail(product.id),
          }),
        ),
      )
    })

    test("approved aid with no discount drops the range but keeps the savings", async () => {
      const flexiblePrice = makeDiscount({ discount_type: "dollars-off" })
      const { program } = setupQuote(
        { user_price: "899", product_flexible_price: flexiblePrice },
        { min_price: 250, max_price: 1000, page: { list_price: "1200" } },
      )

      const { result } = renderHook(() => useProgramCertificatePrice(program), {
        wrapper,
      })

      await waitFor(() => expect(result.current.showsRange).toBe(false))
      expect(result.current.price).toBe("$899")
      expect(result.current.savings).toEqual({
        current: { min: 899, max: 899 },
        listAmount: 1200,
        totalCourses: getTotalRequiredCourses(program),
      })
    })
  })
})
