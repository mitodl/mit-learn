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

const AWARENESS = {
  eyebrow: "Our Cyber Sale is coming",
  text: "**Save 15%** on select MIT courses and programs - Starts November 24",
  link_url: "https://support.learn.mit.edu/hc/en-us/articles/123-cyber-sale",
  link_text: "View eligible courses",
}
const SALE = {
  ...AWARENESS,
  eyebrow: "Learn more this Cyber Monday",
  text: "**Save 15%** on select MIT courses and programs - Use code **LEVELUP**",
}
const DISMISSED_KEY = "cyber-sale-banner-dismissed:sale:0"

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

  test("Shows the eyebrow and text, and links to the payload's URL", () => {
    setFlag("sale", SALE)
    renderWithTheme(<CyberSaleBanner />)
    const banner = screen.getByRole("complementary", { name: "Cyber Sale" })
    expect(banner).toHaveTextContent(SALE.eyebrow)
    expect(banner).toHaveTextContent(
      "Save 15% on select MIT courses and programs - Use code LEVELUP",
    )
    expect(screen.getByRole("link", { name: SALE.link_text })).toHaveAttribute(
      "href",
      SALE.link_url,
    )
  })

  const boldRuns = () =>
    Array.from(
      screen.getByRole("complementary").querySelectorAll("strong"),
      (el) => el.textContent,
    )

  test.each([
    { text: AWARENESS.text, bold: ["Save 15%"] },
    { text: "Save 15% with code **LEVELUP** today", bold: ["LEVELUP"] },
    { text: SALE.text, bold: ["Save 15%", "LEVELUP"] },
  ])("Bolds the runs between ** markers in $text", ({ text, bold }) => {
    setFlag("sale", { ...SALE, text })
    renderWithTheme(<CyberSaleBanner />)
    expect(boldRuns()).toEqual(bold)
  })

  test("Shows text with an unpaired ** as typed", () => {
    const text = "**Save 15%** with code ** LEVELUP"
    setFlag("sale", { ...SALE, text })
    renderWithTheme(<CyberSaleBanner />)
    expect(boldRuns()).toEqual([])
    expect(screen.getByRole("complementary")).toHaveTextContent(text)
  })

  test.each([
    {
      case: "a link_url that isn't a URL",
      payload: { ...SALE, link_url: "/x" },
    },
    {
      case: "a link_url without https",
      payload: { ...SALE, link_url: "//mit.edu/x" },
    },
    { case: "no link_text", payload: { ...SALE, link_text: undefined } },
    { case: "no text", payload: { ...SALE, text: undefined } },
    { case: "dismiss_hours of 0", payload: { ...SALE, dismiss_hours: 0 } },
    { case: "a fractional revision", payload: { ...SALE, revision: 1.5 } },
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
    await user.click(screen.getByRole("link", { name: SALE.link_text }))
    expect(capturePostHog).toHaveBeenCalledWith(
      PostHogEvents.CallToActionClicked,
      { label: SALE.link_text, banner: "cyber-sale", variant: "sale" },
    )
  })

  test("Dismissing hides it and records the dismissal", async () => {
    setFlag("sale", SALE)
    renderWithTheme(<CyberSaleBanner />)
    await user.click(dismissButton()!)
    expect(screen.queryByRole("complementary")).toBeNull()
    expect(window.localStorage.getItem(DISMISSED_KEY)).not.toBeNull()
  })

  test("Dismissing still hides it when localStorage is blocked", async () => {
    // A revision no other test uses: the fallback lives in module memory.
    setFlag("sale", { ...SALE, revision: 99 })
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
    expect(screen.getByRole("complementary")).toHaveTextContent("LEVELUP")
  })

  test("Raising the revision shows a dismissed banner again", () => {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setFlag("sale", SALE)
    renderWithTheme(<CyberSaleBanner />)
    expect(screen.queryByRole("complementary")).toBeNull()

    setFlag("sale", { ...SALE, revision: 1 })
    act(() => mockOnFeatureFlags.mock.calls[0][0]([], {}))
    expect(screen.getByRole("complementary")).toBeInTheDocument()
  })

  test.each([
    { dismissHours: undefined, ageHours: 24 * 30, visible: false },
    { dismissHours: 3, ageHours: 2, visible: false },
    { dismissHours: 3, ageHours: 4, visible: true },
  ])(
    "dismiss_hours $dismissHours, dismissed $ageHours hours ago: visible $visible",
    ({ dismissHours, ageHours, visible }) => {
      window.localStorage.setItem(
        DISMISSED_KEY,
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
      window.localStorage.setItem(DISMISSED_KEY, String(Date.now()))
      window.dispatchEvent(new StorageEvent("storage"))
    })
    expect(screen.queryByRole("complementary")).toBeNull()
  })
})
