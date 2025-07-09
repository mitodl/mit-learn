import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { HOME } from "@/common/urls"
import NotFoundPage from "./NotFoundPage"

test("The NotFoundPage loads with correct text", () => {
  renderWithProviders(<NotFoundPage />, {})
  screen.getByRole("heading", {
    name: "Looks like we couldn't find what you were looking for!",
  })
  screen.getByText("404")
})

test("The NotFoundPage loads with a link that directs to HomePage", () => {
  renderWithProviders(<NotFoundPage />, {})
  const homeLink = screen.getByRole("link", { name: "Home" })
  expect(homeLink).toHaveAttribute("href", HOME)
})
