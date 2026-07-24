import React from "react"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test-utils"
import { UnsubscribedPage } from "./UnsubscribedPage"
import * as urls from "@/common/urls"

describe("UnsubscribedPage", () => {
  it("shows success message when no errorCode", () => {
    renderWithProviders(<UnsubscribedPage />)
    expect(
      screen.getByText(/you have successfully unsubscribed from mit learn/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("shows error message when errorCode is present", () => {
    renderWithProviders(<UnsubscribedPage errorCode="invalid_token" />)
    expect(
      screen.getByText(
        /unable to unsubscribe you with that link, login to unsubscribe manually/i,
      ),
    ).toBeInTheDocument()
  })

  it("shows a login link pointing to the settings page when errorCode is present", () => {
    renderWithProviders(<UnsubscribedPage errorCode="invalid_token" />)
    const link = screen.getByRole("link", { name: /log in/i })
    expect(link).toBeInTheDocument()
    expect(decodeURIComponent(link.getAttribute("href") ?? "")).toContain(
      urls.SETTINGS,
    )
  })
})
