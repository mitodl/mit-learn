import React from "react"
import posthog from "posthog-js"
import { allowConsoleErrors } from "ol-test-utilities"
import { act, renderWithTheme, screen, user } from "@/test-utils"
import { capturePostHog } from "@/common/analytics/posthog"
import { PostHogEvents } from "@/common/constants"
import CyberSaleBanner from "./CyberSaleBanner"

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    getFeatureFlagResult: jest.fn(),
    onFeatureFlags: jest.fn(),
  },
}))
jest.mock("@/common/analytics/posthog", () => ({
  ...jest.requireActual("@/common/analytics/posthog"),
  capturePostHog: jest.fn(),
}))
jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}))
const mockGetResult = jest.mocked(posthog.getFeatureFlagResult)
const mockOnFeatureFlags = jest.mocked(posthog.onFeatureFlags)

const CTA_URL = "https://support.learn.mit.edu/hc/en-us/articles/123-cyber-sale"
const AWARENESS = {
  eyebrow: "Our Cyber Sale is coming",
  headline_bold: "Save 15%",
  headline: "on select MIT courses and programs",
  date: "Starts November 24",
  cta_url: CTA_URL,
}
const SALE = {
  ...AWARENESS,
  eyebrow: "Learn more this Cyber Monday",
  date: "Ends December 1",
  code: "LEVELUP",
}

const HOUR = 60 * 60 * 1000

const setFlag = (
  variant: string,
  payload: unknown,
  { enabled = true } = {},
) => {
  mockGetResult.mockReturnValue({
    key: "cyber-sale-banner",
    enabled,
    variant,
    payload: payload as never,
  })
}

const dismissButton = () =>
  screen.queryByRole("button", { name: "Dismiss Cyber Sale banner" })

describe("CyberSaleBanner", () => {
  beforeEach(() => {
    mockOnFeatureFlags.mockReturnValue(() => {})
    window.localStorage.clear()
  })

  test("Renders nothing before PostHog has the flag", () => {
    mockGetResult.mockReturnValue(undefined)
    renderWithTheme(<CyberSaleBanner />)
    expect(screen.queryByRole("complementary")).toBeNull()
  })

  test.each([
    { case: "the flag is off", enabled: false, payload: SALE },
    { case: "there's no payload", enabled: true, payload: undefined },
  ])("Renders nothing when $case", ({ enabled, payload }) => {
    setFlag("sale", payload, { enabled })
    renderWithTheme(<CyberSaleBanner />)
    expect(screen.queryByRole("complementary")).toBeNull()
  })

  test("Shows the payload's copy and code, and links to its URL", () => {
    setFlag("sale", SALE)
    renderWithTheme(<CyberSaleBanner />)
    const banner = screen.getByRole("complementary", { name: "Cyber Sale" })
    expect(banner).toHaveTextContent(SALE.eyebrow)
    expect(banner).toHaveTextContent(`${SALE.headline_bold} ${SALE.headline}`)
    expect(banner).toHaveTextContent(SALE.date)
    expect(banner).toHaveTextContent(`Use code ${SALE.code}`)
    expect(
      screen.getByRole("link", { name: "View eligible courses" }),
    ).toHaveAttribute("href", CTA_URL)
  })

  test("Without a code it shows no code", () => {
    setFlag("awareness", AWARENESS)
    renderWithTheme(<CyberSaleBanner />)
    const banner = screen.getByRole("complementary", { name: "Cyber Sale" })
    expect(banner).toHaveTextContent(AWARENESS.date)
    expect(banner).not.toHaveTextContent("Use code")
  })

  test("Without a cta_url it shows the banner but no button", () => {
    setFlag("sale", { ...SALE, cta_url: undefined })
    renderWithTheme(<CyberSaleBanner />)
    expect(screen.getByRole("complementary")).toHaveTextContent(SALE.code)
    expect(screen.queryByRole("link")).toBeNull()
  })

  test.each([
    { case: "a cta_url that isn't a URL", payload: { ...SALE, cta_url: "/x" } },
    {
      case: "a cta_url without https",
      payload: { ...SALE, cta_url: "//mit.edu/x" },
    },
    { case: "dismiss_hours of 0", payload: { ...SALE, dismiss_hours: 0 } },
    { case: "no headline", payload: { ...SALE, headline: undefined } },
  ])("Renders nothing for $case", ({ payload }) => {
    setFlag("sale", payload)
    renderWithTheme(<CyberSaleBanner />)
    expect(screen.queryByRole("complementary")).toBeNull()
  })

  test("Clicking the button sends cta_clicked with the flag's variant", async () => {
    // jsdom logs an error when a click navigates.
    allowConsoleErrors()
    setFlag("sale", SALE)
    renderWithTheme(<CyberSaleBanner />)
    await user.click(
      screen.getByRole("link", { name: "View eligible courses" }),
    )
    expect(capturePostHog).toHaveBeenCalledWith(
      PostHogEvents.CallToActionClicked,
      { label: "View eligible courses", banner: "cyber-sale", variant: "sale" },
    )
  })

  test("Dismissing hides it and records the dismissal", async () => {
    setFlag("sale", SALE)
    renderWithTheme(<CyberSaleBanner />)
    await user.click(dismissButton()!)
    expect(screen.queryByRole("complementary")).toBeNull()
    expect(
      window.localStorage.getItem("cyber-sale-banner-dismissed:sale:LEVELUP"),
    ).not.toBeNull()
  })

  test("Dismissing still hides it when localStorage is blocked", async () => {
    // A code no other test uses: the fallback lives in module memory.
    setFlag("sale", { ...SALE, code: "NOSTORAGE" })
    const blocked = () => {
      throw new DOMException("SecurityError")
    }
    const setItem = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(blocked)
    const getItem = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(blocked)
    try {
      renderWithTheme(<CyberSaleBanner />)
      await user.click(dismissButton()!)
      expect(screen.queryByRole("complementary")).toBeNull()
    } finally {
      setItem.mockRestore()
      getItem.mockRestore()
    }
  })

  test("Dismissing the awareness banner does not hide the sale banner", async () => {
    setFlag("awareness", AWARENESS)
    renderWithTheme(<CyberSaleBanner />)
    await user.click(dismissButton()!)
    expect(screen.queryByRole("complementary")).toBeNull()

    setFlag("sale", SALE)
    act(() => mockOnFeatureFlags.mock.calls[0][0]([], {}))
    expect(screen.getByRole("complementary")).toHaveTextContent(SALE.code)
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
      setFlag("sale", { ...SALE, dismiss_hours: dismissHours })
      renderWithTheme(<CyberSaleBanner />)
      expect(Boolean(screen.queryByRole("complementary"))).toBe(visible)
    },
  )

  test("A dismissal in another tab hides it here", () => {
    setFlag("sale", SALE)
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
