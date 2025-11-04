import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { HOME } from "@/common/urls"
import ErrorPage from "./error"
import { ForbiddenError } from "@/common/errors"
import { setMockResponse, urls, factories } from "api/test-utils"

const makeUser = factories.user.user

test("The error page shows error message", () => {
  const consoleSpy = jest.spyOn(console, "error").mockImplementation()
  const error = new Error("Ruh roh")
  renderWithProviders(<ErrorPage error={error} />)
  screen.getByRole("heading", { name: "Something went wrong." })
  screen.getByText("Oops!")
  const homeLink = screen.getByRole("link", { name: "Home" })
  expect(homeLink).toHaveAttribute("href", HOME)
  expect(consoleSpy).toHaveBeenCalledWith(
    "Error encountered in React error boundary:",
    error,
  )
  consoleSpy.mockRestore()
})

test("The Forbidden loads with a link that directs to HomePage", async () => {
  const consoleSpy = jest.spyOn(console, "error").mockImplementation()
  const error = new ForbiddenError()
  setMockResponse.get(urls.userMe.get(), makeUser())

  renderWithProviders(<ErrorPage error={error} />)
  await screen.findByRole("heading", {
    name: "You do not have permission to access this resource.",
  })
  screen.getByText("Oops!")
  const homeLink = screen.getByRole("link", { name: "Home" })
  expect(homeLink).toHaveAttribute("href", HOME)
  expect(consoleSpy).toHaveBeenCalledWith(
    "Error encountered in React error boundary:",
    error,
  )
  consoleSpy.mockRestore()
})
