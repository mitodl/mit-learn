import React from "react"
import posthog from "posthog-js"
import { act, renderWithTheme, screen, user } from "@/test-utils"
import CyberSaleBanner from "./CyberSaleBanner"

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    getFeatureFlagPayload: jest.fn(),
    onFeatureFlags: jest.fn(),
    capture: jest.fn(),
  },
}))
jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}))
const mockGetPayload = jest.mocked(posthog.getFeatureFlagPayload)
const mockOnFeatureFlags = jest.mocked(posthog.onFeatureFlags)

const CTA_URL = "https://support.learn.mit.edu/hc/en-us/articles/123-cyber-sale"
const AWARENESS = { variant: "awareness", cta_url: CTA_URL }
const SALE = { variant: "sale", code: "LEVELUP", cta_url: CTA_URL }

const HOUR = 60 * 60 * 1000

const setPayload = (payload: unknown) => {
  mockGetPayload.mockReturnValue(payload as never)
}

const dismissButton = () =>
  screen.queryByRole("button", { name: "Dismiss Cyber Sale banner" })

describe("CyberSaleBanner", () => {
  beforeEach(() => {
    mockOnFeatureFlags.mockReturnValue(() => {})
    window.localStorage.clear()
  })

  test("Renders nothing without a payload", () => {
    setPayload(undefined)
    renderWithTheme(<CyberSaleBanner />)
    expect(screen.queryByRole("complementary")).toBeNull()
  })

  test("Sale variant shows the code and links to the payload's URL", () => {
    setPayload(SALE)
    renderWithTheme(<CyberSaleBanner />)
    const banner = screen.getByRole("complementary", { name: "Cyber Sale" })
    expect(banner).toHaveTextContent("Learn more this Cyber Monday")
    expect(banner).toHaveTextContent(
      "Save 15% on select MIT courses and programs",
    )
    expect(banner).toHaveTextContent("Ends December 1")
    expect(banner).toHaveTextContent("Use code LEVELUP")
    expect(
      screen.getByRole("link", { name: "View eligible courses" }),
    ).toHaveAttribute("href", CTA_URL)
  })

  test("Awareness variant shows the start date and no code", () => {
    setPayload(AWARENESS)
    renderWithTheme(<CyberSaleBanner />)
    const banner = screen.getByRole("complementary", { name: "Cyber Sale" })
    expect(banner).toHaveTextContent("Our Cyber Sale is coming")
    expect(banner).toHaveTextContent("Starts November 24")
    expect(banner).not.toHaveTextContent("Use code")
  })

  test.each([
    { case: "a cta_url that isn't a URL", payload: { ...SALE, cta_url: "/x" } },
    { case: "dismiss_hours of 0", payload: { ...SALE, dismiss_hours: 0 } },
    { case: "a sale without a code", payload: { ...SALE, code: undefined } },
    { case: "an unknown variant", payload: { ...SALE, variant: "flash" } },
  ])("Renders nothing for $case", ({ payload }) => {
    setPayload(payload)
    renderWithTheme(<CyberSaleBanner />)
    expect(screen.queryByRole("complementary")).toBeNull()
  })

  test("Dismissing hides it and keeps it hidden on the next render", async () => {
    setPayload(SALE)
    const { unmount } = renderWithTheme(<CyberSaleBanner />)
    await user.click(dismissButton()!)
    expect(screen.queryByRole("complementary")).toBeNull()
    unmount()

    renderWithTheme(<CyberSaleBanner />)
    expect(screen.queryByRole("complementary")).toBeNull()
  })

  test("Dismissing the awareness banner does not hide the sale banner", async () => {
    setPayload(AWARENESS)
    renderWithTheme(<CyberSaleBanner />)
    await user.click(dismissButton()!)
    expect(screen.queryByRole("complementary")).toBeNull()

    setPayload(SALE)
    act(() => mockOnFeatureFlags.mock.calls[0][0]([], {}))
    expect(screen.getByRole("complementary")).toHaveTextContent("LEVELUP")
  })

  test.each([
    { dismissHours: undefined, ageHours: 24 * 30, visible: false },
    { dismissHours: 3, ageHours: 2, visible: false },
    { dismissHours: 3, ageHours: 4, visible: true },
  ])(
    "dismiss_hours $dismissHours, dismissed $ageHours hours ago: visible $visible",
    ({ dismissHours, ageHours, visible }) => {
      window.localStorage.setItem(
        "cyber-sale-banner-dismissed:sale:LEVELUP",
        String(Date.now() - ageHours * HOUR),
      )
      setPayload({ ...SALE, dismiss_hours: dismissHours })
      renderWithTheme(<CyberSaleBanner />)
      expect(Boolean(screen.queryByRole("complementary"))).toBe(visible)
    },
  )

  test("A dismissal in another tab hides it here", () => {
    setPayload(SALE)
    renderWithTheme(<CyberSaleBanner />)
    expect(screen.getByRole("complementary")).toBeInTheDocument()
    act(() => {
      window.localStorage.setItem(
        "cyber-sale-banner-dismissed:sale:LEVELUP",
        String(Date.now()),
      )
      window.dispatchEvent(new StorageEvent("storage"))
    })
    expect(screen.queryByRole("complementary")).toBeNull()
  })
})
