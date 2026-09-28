import React from "react"
import { renderWithTheme, screen, act, waitFor, user } from "@/test-utils"
import { Toaster } from "./Toaster"
import { showErrorToast, dismissErrorToast } from "./toastStore"

test("shows nothing until an error toast is fired", () => {
  renderWithTheme(<Toaster />)
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

test("renders the error message when showErrorToast is called", async () => {
  renderWithTheme(<Toaster />)

  act(() => {
    showErrorToast("Enrollment failed")
  })

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Enrollment failed",
  )
  act(() => dismissErrorToast())
})

test("a new error replaces the current toast rather than stacking", async () => {
  renderWithTheme(<Toaster />)
  act(() => {
    showErrorToast("First failure")
  })
  await screen.findByRole("alert")

  act(() => {
    showErrorToast("Second failure")
  })

  const alert = await screen.findByRole("alert") // findByRole throws if >1
  expect(alert).toHaveTextContent("Second failure")
  act(() => dismissErrorToast())
})

test("the dismiss button clears the toast", async () => {
  renderWithTheme(<Toaster />)
  act(() => {
    showErrorToast("Enrollment failed")
  })
  await screen.findByRole("alert")

  await user.click(screen.getByRole("button", { name: "Dismiss" }))

  await waitFor(() => {
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
