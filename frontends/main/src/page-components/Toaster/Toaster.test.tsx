import React from "react"
import { renderWithTheme, screen, act, waitFor, user } from "@/test-utils"
import { Toaster } from "./Toaster"
import { showErrorToast, showSuccessToast, dismissToast } from "./toastStore"

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
  act(() => dismissToast())
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
  act(() => dismissToast())
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

test("renders a success toast with the Success! label", async () => {
  renderWithTheme(<Toaster />)

  act(() => {
    showSuccessToast('You\'ve been enrolled in "Intro to Everything".')
  })

  const alert = await screen.findByRole("alert")
  expect(alert).toHaveTextContent(
    'You\'ve been enrolled in "Intro to Everything".',
  )
  expect(alert).toHaveTextContent("Success!")
  act(() => dismissToast())
})

test("a success toast times out on its own, an error toast does not", async () => {
  jest.useFakeTimers()
  try {
    renderWithTheme(<Toaster />)

    act(() => showErrorToast("Enrollment failed"))
    act(() => {
      jest.advanceTimersByTime(30_000)
    })
    // Errors may carry a Contact Support action, so they wait to be read.
    expect(screen.getByRole("alert")).toHaveTextContent("Enrollment failed")

    act(() => showSuccessToast("Enrolled"))
    act(() => {
      jest.advanceTimersByTime(30_000)
    })
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })
  } finally {
    jest.useRealTimers()
  }
})
