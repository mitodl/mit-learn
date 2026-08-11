import React from "react"
import AccountActionAlert from "./AccountActionAlert"
import { renderWithProviders, screen } from "@/test-utils"

const renderAtUrl = (search: string) =>
  renderWithProviders(<AccountActionAlert />, {
    url: `/dashboard/settings${search}`,
  })

describe("AccountActionAlert", () => {
  test.each([
    {
      search: "?account_action=update-email&account_action_status=success",
      message:
        "Check your inbox for a confirmation link to finish updating your email address.",
    },
    {
      search: "?account_action=update-password&account_action_status=success",
      message: "Your password has been updated.",
    },
    {
      search: "?account_action=update-email&account_action_status=error",
      message: "We couldn't update your email address. Please try again.",
    },
    {
      search:
        "?account_action=update-password&account_action_status=unavailable",
      message:
        "Your password is managed by your organization's single sign-on provider.",
    },
  ])("Shows the outcome of $search", async ({ search, message }) => {
    renderAtUrl(search)
    expect(await screen.findByText(message)).toBeInTheDocument()
  })

  test.each([
    // Cancelling is a deliberate choice; nothing to report.
    { search: "?account_action=update-email&account_action_status=cancelled" },
    // No account action in play at all.
    { search: "" },
  ])("Shows nothing for $search", ({ search }) => {
    const { view } = renderAtUrl(search)
    expect(view.container).toBeEmptyDOMElement()
  })

  test.each([
    // Not an action we know about.
    { search: "?account_action=delete-account&account_action_status=success" },
    { search: "?account_action=update-email&account_action_status=whoops" },
    // Half a payload.
    { search: "?account_action=update-email" },
  ])("Warns and shows nothing for $search", ({ search }) => {
    const warn = jest.spyOn(console, "warn").mockImplementation()
    const { view } = renderAtUrl(search)

    expect(view.container).toBeEmptyDOMElement()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  test("Strips the params so the alert doesn't reappear on refresh", async () => {
    const { location } = renderAtUrl(
      "?account_action=update-email&account_action_status=success&keep=me",
    )
    await screen.findByText("Check your inbox for a confirmation link to finish updating your email address.")

    expect(location.current.searchParams.get("account_action")).toBe(null)
    expect(location.current.searchParams.get("account_action_status")).toBe(
      null,
    )
    expect(location.current.searchParams.get("keep")).toBe("me")
  })
})
