import React from "react"
import { renderWithTheme, screen, user } from "@/test-utils"
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

  test("disabled pseudo-links are in the tab order", () => {
    renderWithTheme(<AssignSeatsSection />)

    // Both DisabledLinks get aria-label="Coming soon" from the enclosing Tooltip
    const pseudoLinks = screen.getAllByRole("button", { name: "Coming soon" })
    expect(pseudoLinks).toHaveLength(2)

    for (const link of pseudoLinks) {
      expect(link).toHaveAttribute("tabindex", "0")
    }
  })

  test("disabled pseudo-links have aria-disabled set", () => {
    renderWithTheme(<AssignSeatsSection />)

    const pseudoLinks = screen.getAllByRole("button", { name: "Coming soon" })
    for (const link of pseudoLinks) {
      expect(link).toHaveAttribute("aria-disabled", "true")
    }
  })

  test("pressing Enter on a focused pseudo-link does not throw", async () => {
    renderWithTheme(<AssignSeatsSection />)

    const [importLink] = screen.getAllByRole("button", { name: "Coming soon" })
    importLink.focus()
    expect(importLink).toHaveFocus()

    // No click handler on a <span>, so Enter should produce no side-effect
    await user.keyboard("{Enter}")
  })

  test("email textarea is disabled", () => {
    renderWithTheme(<AssignSeatsSection />)

    expect(screen.getByPlaceholderText(/enter employee emails/i)).toBeDisabled()
  })

  test("Assign Seats button is disabled", () => {
    renderWithTheme(<AssignSeatsSection />)

    expect(screen.getByRole("button", { name: "Assign Seats" })).toBeDisabled()
  })
})
