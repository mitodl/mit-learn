import React from "react"
import { renderWithProviders, screen, user, waitFor } from "@/test-utils"
import { setMockResponse } from "api/test-utils"
import { factories, urls } from "api/mitxonline-test-utils"
import { RowActionMenu } from "./RowActionMenu"

const makeCode = factories.contracts.contractCode

const ORG_ID = 1
const CONTRACT_ID = 2

const renderMenu = (
  code: ReturnType<typeof makeCode>,
  onResult = jest.fn(),
) => {
  renderWithProviders(
    <RowActionMenu
      code={code}
      orgId={ORG_ID}
      contractId={CONTRACT_ID}
      onResult={onResult}
    />,
  )
  return { onResult }
}

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
      renderMenu(code)

      await user.click(screen.getByRole("button", { name: /more actions/i }))

      expect(
        screen.getByRole("menuitem", { name: "Change assigned email" }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole("menuitem", { name: "Resend claim email" }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole("menuitem", { name: "Copy claim link" }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole("menuitem", { name: "Release seat" }),
      ).toBeInTheDocument()
    })
  })

  describe("redeemed code", () => {
    test("opens menu with only Uninvite item", async () => {
      const code = makeCode({
        redemption_status: "redeemed",
        redeemed_by: "user@example.com",
        redeemed_on: new Date().toISOString(),
      })
      renderMenu(code)

      await user.click(screen.getByRole("button", { name: /more actions/i }))

      expect(
        screen.getByRole("menuitem", { name: "Uninvite" }),
      ).toBeInTheDocument()
      expect(screen.queryByText("Copy claim link")).not.toBeInTheDocument()
    })
  })

  describe("Resend claim email", () => {
    test("calls the remind endpoint and reports success", async () => {
      const code = makeCode({
        redemption_status: "assigned",
        assigned_to: "learner@example.com",
      })
      setMockResponse.post(
        urls.contracts.managerContractCodeRemind(
          ORG_ID,
          CONTRACT_ID,
          code.code,
        ),
        code,
      )
      const { onResult } = renderMenu(code)

      await user.click(screen.getByRole("button", { name: /more actions/i }))
      await user.click(
        screen.getByRole("menuitem", { name: "Resend claim email" }),
      )

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith(
          expect.stringContaining("learner@example.com"),
          "success",
        )
      })
    })

    test("is disabled when the seat has no assigned email", async () => {
      const code = makeCode({ redemption_status: "assigned", assigned_to: "" })
      const { onResult } = renderMenu(code)

      await user.click(screen.getByRole("button", { name: /more actions/i }))

      const item = screen.getByRole("menuitem", { name: "Resend claim email" })
      expect(item).toHaveAttribute("aria-disabled", "true")

      await user.click(item)
      expect(onResult).not.toHaveBeenCalled()
    })

    test("reports an error when the remind endpoint fails", async () => {
      const code = makeCode({ redemption_status: "assigned" })
      setMockResponse.post(
        urls.contracts.managerContractCodeRemind(
          ORG_ID,
          CONTRACT_ID,
          code.code,
        ),
        { detail: "boom" },
        { code: 404 },
      )
      const { onResult } = renderMenu(code)

      await user.click(screen.getByRole("button", { name: /more actions/i }))
      await user.click(
        screen.getByRole("menuitem", { name: "Resend claim email" }),
      )

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith(expect.any(String), "error")
      })
    })
  })

  describe("Release seat / revoke", () => {
    test("opens a confirmation dialog before revoking", async () => {
      const code = makeCode({ redemption_status: "assigned" })
      const { onResult } = renderMenu(code)

      await user.click(screen.getByRole("button", { name: /more actions/i }))
      await user.click(screen.getByRole("menuitem", { name: "Release seat" }))

      // Dialog appears; nothing has been revoked yet.
      expect(
        screen.getByRole("heading", { name: "Release seat" }),
      ).toBeInTheDocument()
      expect(onResult).not.toHaveBeenCalled()
    })

    test("revokes on confirm and reports success", async () => {
      const code = makeCode({ redemption_status: "assigned" })
      setMockResponse.delete(
        urls.contracts.managerContractCodeRevoke(
          ORG_ID,
          CONTRACT_ID,
          code.code,
        ),
        code,
      )
      const { onResult } = renderMenu(code)

      await user.click(screen.getByRole("button", { name: /more actions/i }))
      await user.click(screen.getByRole("menuitem", { name: "Release seat" }))
      await user.click(screen.getByRole("button", { name: "Release seat" }))

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith("Seat released.", "success")
      })
    })

    test("surfaces the already-redeemed (409) error", async () => {
      const code = makeCode({
        redemption_status: "redeemed",
        redeemed_by: "user@example.com",
        redeemed_on: new Date().toISOString(),
      })
      setMockResponse.delete(
        urls.contracts.managerContractCodeRevoke(
          ORG_ID,
          CONTRACT_ID,
          code.code,
        ),
        { detail: "Cannot revoke a code that has already been redeemed." },
        { code: 409 },
      )
      const { onResult } = renderMenu(code)

      await user.click(screen.getByRole("button", { name: /more actions/i }))
      await user.click(screen.getByRole("menuitem", { name: "Uninvite" }))
      await user.click(screen.getByRole("button", { name: "Uninvite" }))

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith(
          expect.stringContaining("already been redeemed"),
          "error",
        )
      })
    })
  })

  describe("Change assigned email / reassign", () => {
    test("opens a dialog prefilled with the current assignee email", async () => {
      const code = makeCode({
        redemption_status: "assigned",
        assigned_to: "old@example.com",
      })
      renderMenu(code)

      await user.click(screen.getByRole("button", { name: /more actions/i }))
      await user.click(
        screen.getByRole("menuitem", { name: "Change assigned email" }),
      )

      expect(
        screen.getByRole("heading", { name: "Change assigned email" }),
      ).toBeInTheDocument()
      expect(screen.getByLabelText(/New email address/i)).toHaveValue(
        "old@example.com",
      )
    })

    test("reassigns on submit and reports success", async () => {
      const code = makeCode({
        redemption_status: "assigned",
        assigned_to: "old@example.com",
      })
      setMockResponse.put(
        urls.contracts.managerContractCodeReassign(
          ORG_ID,
          CONTRACT_ID,
          code.code,
        ),
        code,
      )
      const { onResult } = renderMenu(code)

      await user.click(screen.getByRole("button", { name: /more actions/i }))
      await user.click(
        screen.getByRole("menuitem", { name: "Change assigned email" }),
      )

      const input = screen.getByLabelText(/New email address/i)
      await user.clear(input)
      await user.type(input, "new@example.com")
      await user.click(screen.getByRole("button", { name: "Reassign seat" }))

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith(
          expect.stringContaining("new@example.com"),
          "success",
        )
      })
    })

    test("blocks submission and shows an error for an invalid email", async () => {
      const code = makeCode({ redemption_status: "assigned", assigned_to: "" })
      const { onResult } = renderMenu(code)

      await user.click(screen.getByRole("button", { name: /more actions/i }))
      await user.click(
        screen.getByRole("menuitem", { name: "Change assigned email" }),
      )

      const input = screen.getByLabelText(/New email address/i)
      await user.type(input, "not-an-email")

      // Confirm button is disabled while the email is invalid.
      expect(
        screen.getByRole("button", { name: "Reassign seat" }),
      ).toBeDisabled()
      expect(
        screen.getByText("Enter a valid email address."),
      ).toBeInTheDocument()
      expect(onResult).not.toHaveBeenCalled()
    })

    test("surfaces the already-redeemed (409) error", async () => {
      const code = makeCode({
        redemption_status: "assigned",
        assigned_to: "old@example.com",
      })
      setMockResponse.put(
        urls.contracts.managerContractCodeReassign(
          ORG_ID,
          CONTRACT_ID,
          code.code,
        ),
        { detail: "Cannot reassign a code that has already been redeemed." },
        { code: 409 },
      )
      const { onResult } = renderMenu(code)

      await user.click(screen.getByRole("button", { name: /more actions/i }))
      await user.click(
        screen.getByRole("menuitem", { name: "Change assigned email" }),
      )
      const input = screen.getByLabelText(/New email address/i)
      await user.clear(input)
      await user.type(input, "new@example.com")
      await user.click(screen.getByRole("button", { name: "Reassign seat" }))

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith(
          expect.stringContaining("already been redeemed"),
          "error",
        )
      })
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

      renderMenu(code)

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

      renderMenu(code)

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

      renderMenu(code)

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
