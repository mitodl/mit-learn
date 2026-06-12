import React from "react"
import { renderWithTheme, screen, user } from "@/test-utils"
import { factories } from "api/mitxonline-test-utils"
import { RowActionMenu } from "./RowActionMenu"

const makeCode = factories.contracts.contractCode

// MUI Tooltip injects aria-label="Coming soon" onto wrapped disabled items,
// so their accessible name becomes "Coming soon" rather than their text.
// Use getByText for those items and getByRole only for non-tooltip items.

afterEach(() => {
  // Restore clipboard so Object.defineProperty calls don't leak between tests
  Object.defineProperty(navigator, "clipboard", {
    value: undefined,
    configurable: true,
  })
})

describe("RowActionMenu", () => {
  describe("pending code", () => {
    test("opens menu with correct items on trigger click", async () => {
      const code = makeCode({ redemption_status: "assigned" })
      renderWithTheme(<RowActionMenu code={code} />)

      await user.click(screen.getByRole("button", { name: /more actions/i }))

      expect(screen.getByText("Change assigned email")).toBeInTheDocument()
      expect(screen.getByText("Resend claim email")).toBeInTheDocument()
      expect(
        screen.getByRole("menuitem", { name: "Copy claim link" }),
      ).toBeInTheDocument()
      expect(screen.getByText("Release seat")).toBeInTheDocument()
    })
  })

  describe("redeemed code", () => {
    test("opens menu with only Uninvite item", async () => {
      const code = makeCode({
        redemption_status: "redeemed",
        redeemed_by: "user@example.com",
        redeemed_on: new Date().toISOString(),
      })
      renderWithTheme(<RowActionMenu code={code} />)

      await user.click(screen.getByRole("button", { name: /more actions/i }))

      expect(screen.getByText("Uninvite")).toBeInTheDocument()
      expect(screen.queryByText("Copy claim link")).not.toBeInTheDocument()
    })
  })

  describe("Copy claim link", () => {
    test("writes the enrollment URL to clipboard and shows confirmation", async () => {
      const code = makeCode({ redemption_status: "assigned", code: "ABC123" })
      const writeText = jest.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      })

      renderWithTheme(<RowActionMenu code={code} />)

      await user.click(screen.getByRole("button", { name: /more actions/i }))
      await user.click(
        screen.getByRole("menuitem", { name: "Copy claim link" }),
      )

      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining(`/enrollmentcode/${code.code}`),
      )
      expect(
        await screen.findByRole("menuitem", {
          name: "Link copied to clipboard",
        }),
      ).toBeInTheDocument()
    })

    test("announces the copy to screen readers via aria-live region", async () => {
      const code = makeCode({ redemption_status: "assigned" })
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: jest.fn().mockResolvedValue(undefined) },
        configurable: true,
      })

      renderWithTheme(<RowActionMenu code={code} />)

      await user.click(screen.getByRole("button", { name: /more actions/i }))

      const liveRegion = document.querySelector("[aria-live='polite']")
      expect(liveRegion).toHaveTextContent("")

      await user.click(
        screen.getByRole("menuitem", { name: "Copy claim link" }),
      )

      expect(
        await screen.findByRole("menuitem", {
          name: "Link copied to clipboard",
        }),
      ).toBeInTheDocument()
      expect(liveRegion).toHaveTextContent("Link copied to clipboard")
    })

    test("falls back to execCommand when clipboard API is unavailable", async () => {
      const code = makeCode({ redemption_status: "assigned", code: "XYZ789" })
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      })
      // jsdom doesn't define execCommand, so assign it before spying
      document.execCommand = jest.fn().mockImplementation((cmd: string) => {
        if (cmd === "copy") {
          document.dispatchEvent(
            new Event("copy", { bubbles: true, cancelable: true }),
          )
          return true
        }
        return false
      })

      renderWithTheme(<RowActionMenu code={code} />)

      await user.click(screen.getByRole("button", { name: /more actions/i }))
      await user.click(
        screen.getByRole("menuitem", { name: "Copy claim link" }),
      )

      expect(document.execCommand).toHaveBeenCalledWith("copy")
      expect(
        await screen.findByRole("menuitem", {
          name: "Link copied to clipboard",
        }),
      ).toBeInTheDocument()
    })
  })
})
