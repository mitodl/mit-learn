import React from "react"
import { renderWithTheme, screen } from "@/test-utils"
import ErrorMessageWithSupport from "./ErrorMessageWithSupport"
import * as urls from "@/common/urls"

test("Renders the message followed by a support link", () => {
  renderWithTheme(
    <ErrorMessageWithSupport>Enrollment is closed.</ErrorMessageWithSupport>,
  )

  // The message stays a single addressable node, so callers' exact-text
  // assertions keep working once the suffix is appended.
  expect(screen.getByText("Enrollment is closed.")).toBeInTheDocument()

  const link = screen.getByRole("link", { name: "Contact Support" })
  expect(link).toHaveAttribute(
    "href",
    "https://support.learn.mit.edu/hc/en-us/requests/new",
  )
  expect(link).toHaveAttribute("href", urls.SUPPORT_REQUEST)
  // A new tab: a user mid-enrollment must not lose the page they were on.
  expect(link).toHaveAttribute("target", "_blank")
  expect(link).toHaveAttribute("rel", "noopener noreferrer")
})
