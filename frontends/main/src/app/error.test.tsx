import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { HOME } from "@/common/urls"
import ErrorPage from "./error"
import { ForbiddenError } from "@/common/errors"

test("The error page shows error message", () => {
  const error = new Error("Ruh roh")
  renderWithProviders(<ErrorPage error={error} />)
  screen.getByRole("heading", { name: "Something went wrong." })
  screen.getByText("Oops!")
  const homeLink = screen.getByRole("link", { name: "Home" })
  expect(homeLink).toHaveAttribute("href", HOME)
})

test("The NotFoundPage loads with a link that directs to HomePage", () => {
  const error = new ForbiddenError()
  renderWithProviders(<ErrorPage error={error} />, { user: {} })
  screen.getByRole("heading", {
    name: "You do not have permission to access this resource.",
  })
  screen.getByText("Oops!")
  const homeLink = screen.getByRole("link", { name: "Home" })
  expect(homeLink).toHaveAttribute("href", HOME)
})
