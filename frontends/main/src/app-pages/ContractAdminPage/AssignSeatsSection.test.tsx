import React from "react"
import { renderWithTheme, screen, user, waitFor } from "@/test-utils"
import { AssignSeatsSection } from "./AssignSeatsSection"

// MUI Tooltip injects aria-label="Coming soon" onto the wrapped disabled spans,
// so their accessible name becomes "Coming soon" rather than their visible text.
// Use getAllByRole(..., { name: "Coming soon" }) to target them, and getByText
// for asserting visible text content separately.

describe("AssignSeatsSection", () => {
  test("renders section title and key UI elements", () => {
    renderWithTheme(<AssignSeatsSection />)

    expect(
      screen.getByRole("heading", { name: "Assign Seats" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Assign Seats" }),
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText(/enter employee emails/i),
    ).toBeInTheDocument()
    // Pseudo-links visible text
    expect(screen.getByText("import from CSV")).toBeInTheDocument()
    expect(screen.getByText("(download sample CSV)")).toBeInTheDocument()
  })

  test("download sample CSV pseudo-link is in the tab order and disabled", () => {
    renderWithTheme(<AssignSeatsSection />)

    // Only the download link is still disabled — import from CSV is now active
    const downloadLink = screen.getByRole("button", { name: "Coming soon" })
    expect(downloadLink).toHaveAttribute("tabindex", "0")
    expect(downloadLink).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByText("(download sample CSV)")).toBeInTheDocument()
  })

  test("import from CSV button is active and in the tab order", () => {
    renderWithTheme(<AssignSeatsSection />)

    const importButton = screen.getByRole("button", { name: "import from CSV" })
    expect(importButton).toBeInTheDocument()
    expect(importButton).toHaveAttribute("tabindex", "0")
    expect(importButton).not.toHaveAttribute("aria-disabled")
  })

  test("Assign Seats button is disabled when textarea is empty", () => {
    renderWithTheme(<AssignSeatsSection />)

    expect(screen.getByRole("button", { name: "Assign Seats" })).toBeDisabled()
  })

  test("Assign Seats button enables when at least one valid email is entered", async () => {
    renderWithTheme(<AssignSeatsSection />)

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.type(textarea, "alice@example.com")

    expect(
      screen.getByRole("button", { name: "Assign Seats" }),
    ).not.toBeDisabled()
  })

  test("Assign Seats button stays disabled when only invalid emails are entered", async () => {
    renderWithTheme(<AssignSeatsSection />)

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.type(textarea, "notanemail")

    expect(screen.getByRole("button", { name: "Assign Seats" })).toBeDisabled()
  })

  test("shows valid/invalid counts after entering emails", async () => {
    renderWithTheme(<AssignSeatsSection />)

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.type(textarea, "alice@example.com, bob@example.com, notvalid")

    expect(screen.getByText("2 valid")).toBeInTheDocument()
    expect(screen.getByText("1 invalid")).toBeInTheDocument()
  })

  test("shows only valid count when all emails are valid", async () => {
    renderWithTheme(<AssignSeatsSection />)

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.type(textarea, "alice@example.com, bob@example.com")

    expect(screen.getByText("2 valid")).toBeInTheDocument()
    expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument()
  })

  test("validation badge is not shown when textarea is empty", () => {
    renderWithTheme(<AssignSeatsSection />)

    expect(screen.queryByText(/valid/i)).not.toBeInTheDocument()
  })

  test("live region announces email validation summary after debounce", async () => {
    renderWithTheme(<AssignSeatsSection />)

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.type(textarea, "alice@example.com, bad-email")

    const liveRegion = document.querySelector("[aria-live='polite']")
    expect(liveRegion).not.toBeNull()
    // Announcement is debounced — wait for the timeout to fire
    await waitFor(
      () =>
        expect(liveRegion as HTMLElement).toHaveTextContent(
          "1 valid email, 1 invalid",
        ),
      { timeout: 1000 },
    )
  })

  test("clicking Assign Seats opens the confirm modal", async () => {
    renderWithTheme(<AssignSeatsSection />)

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.type(textarea, "alice@example.com")
    await user.click(screen.getByRole("button", { name: "Assign Seats" }))

    expect(
      await screen.findByRole("heading", { name: /email.*ready to assign/i }),
    ).toBeInTheDocument()
  })

  test("modal shows invalid emails when textarea has mixed input", async () => {
    renderWithTheme(<AssignSeatsSection />)

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.click(textarea)
    await user.paste("alice@example.com\nbadtoken")
    await user.click(screen.getByRole("button", { name: "Assign Seats" }))

    expect(await screen.findAllByText("badtoken")).not.toHaveLength(0)
  })

  test("modal shows duplicate count when textarea has repeated emails", async () => {
    renderWithTheme(<AssignSeatsSection />)

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.click(textarea)
    await user.paste("alice@example.com\nalice@example.com\nbob@example.com")
    await user.click(screen.getByRole("button", { name: "Assign Seats" }))

    expect(await screen.findByText(/1 duplicate.*removed/i)).toBeInTheDocument()
  })

  test("closing the modal hides it", async () => {
    renderWithTheme(<AssignSeatsSection />)

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.type(textarea, "alice@example.com")
    await user.click(screen.getByRole("button", { name: "Assign Seats" }))
    await screen.findByRole("heading", { name: /email.*ready to assign/i })

    await user.click(screen.getByRole("button", { name: /cancel/i }))

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: /email.*ready to assign/i }),
      ).not.toBeInTheDocument(),
    )
  })

  // CSV import tests

  test("importing a valid CSV opens the modal without populating the textarea", async () => {
    renderWithTheme(<AssignSeatsSection />)

    const csvContent = "email\nalice@example.com\nbob@example.com"
    const file = new File([csvContent], "emails.csv", { type: "text/csv" })

    const fileInput = document.querySelector(
      "input[type='file']",
    ) as HTMLInputElement
    await user.upload(fileInput, file)

    expect(
      await screen.findByRole("heading", { name: /2 emails ready to assign/i }),
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/enter employee emails/i)).toHaveValue(
      "",
    )
  })

  test("importing a CSV with invalid emails shows them in the modal", async () => {
    renderWithTheme(<AssignSeatsSection />)

    const csvContent = "alice@example.com\nbad@\nnot-quite@.com"
    const file = new File([csvContent], "emails.csv", { type: "text/csv" })

    const fileInput = document.querySelector(
      "input[type='file']",
    ) as HTMLInputElement
    await user.upload(fileInput, file)

    expect(await screen.findByText("bad@")).toBeInTheDocument()
    expect(screen.getByText("not-quite@.com")).toBeInTheDocument()
  })

  test("importing a CSV with duplicates shows duplicate count in modal", async () => {
    renderWithTheme(<AssignSeatsSection />)

    const csvContent = "alice@example.com\nbob@example.com\nalice@example.com"
    const file = new File([csvContent], "emails.csv", { type: "text/csv" })

    const fileInput = document.querySelector(
      "input[type='file']",
    ) as HTMLInputElement
    await user.upload(fileInput, file)

    expect(await screen.findByText(/1 duplicate.*removed/i)).toBeInTheDocument()
  })

  test("importing a CSV with no valid emails shows inline error", async () => {
    renderWithTheme(<AssignSeatsSection />)

    const csvContent = "Email\nNot An Email\nbad@"
    const file = new File([csvContent], "emails.csv", { type: "text/csv" })

    const fileInput = document.querySelector(
      "input[type='file']",
    ) as HTMLInputElement
    await user.upload(fileInput, file)

    expect(
      await screen.findByText(/no valid email addresses found in this file/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: /ready to assign/i }),
    ).not.toBeInTheDocument()
  })

  test("accepts newline-separated emails", async () => {
    renderWithTheme(<AssignSeatsSection />)

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    // Simulate pasting newline-separated emails
    await user.click(textarea)
    await user.paste("alice@example.com\nbob@example.com\nbad")

    expect(screen.getByText("2 valid")).toBeInTheDocument()
    expect(screen.getByText("1 invalid")).toBeInTheDocument()
  })
})
