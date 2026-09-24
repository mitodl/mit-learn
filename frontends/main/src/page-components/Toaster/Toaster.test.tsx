import React from "react"
import {
  renderWithTheme,
  screen,
  act,
  waitFor,
  user,
  within,
} from "@/test-utils"
import * as urls from "@/common/urls"
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

test("renders a support link when the toast asks for one", async () => {
  renderWithTheme(<Toaster />)

  act(() => {
    showErrorToast("Enrollment failed", { contactSupport: true })
  })

  const alert = await screen.findByRole("alert")
  expect(alert).toHaveTextContent("Enrollment failed")
  expect(
    within(alert).getByRole("link", { name: "Contact Support" }),
  ).toHaveAttribute("href", urls.SUPPORT_REQUEST)
  act(() => dismissErrorToast())
})

test("renders no support link by default", async () => {
  renderWithTheme(<Toaster />)

  act(() => {
    showErrorToast("Something went wrong")
  })

  await screen.findByRole("alert")
  expect(
    screen.queryByRole("link", { name: "Contact Support" }),
  ).not.toBeInTheDocument()
  act(() => dismissErrorToast())
})
