import React from "react"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test-utils"
import { setMockResponse, urls } from "api/test-utils"
import { UnsubscribePage } from "./UnsubscribePage"

describe("UnsubscribePage", () => {
  it("shows the error message when no token is present", () => {
    renderWithProviders(<UnsubscribePage />)
    expect(
      screen.getByText(
        /unable to unsubscribe you with that link, login to unsubscribe manually/i,
      ),
    ).toBeInTheDocument()
  })

  it("shows a confirmation prompt with a button when a token is present", () => {
    renderWithProviders(<UnsubscribePage token="abc123" />)
    expect(
      screen.getByText(/are you sure you want to unsubscribe/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /confirm unsubscribe/i }),
    ).toBeInTheDocument()
  })

  it("posts to the unsubscribe endpoint and shows success on confirm", async () => {
    setMockResponse.post(urls.unsubscribe.post("abc123"), {})
    renderWithProviders(<UnsubscribePage token="abc123" />)

    const button = screen.getByRole("button", { name: /confirm unsubscribe/i })
    await userEvent.click(button)

    await waitFor(() => {
      expect(
        screen.getByText(/you have successfully unsubscribed from mit learn/i),
      ).toBeInTheDocument()
    })
  })

  it("shows an error message if the unsubscribe request fails", async () => {
    setMockResponse.post(
      urls.unsubscribe.post("abc123"),
      { error: "Invalid or expired token" },
      { code: 400 },
    )
    renderWithProviders(<UnsubscribePage token="abc123" />)

    const button = screen.getByRole("button", { name: /confirm unsubscribe/i })
    await userEvent.click(button)

    await waitFor(() => {
      expect(
        screen.getByText(
          /unable to unsubscribe you with that link, login to unsubscribe manually/i,
        ),
      ).toBeInTheDocument()
    })
  })

  it("disables the button while the request is pending", async () => {
    setMockResponse.post(urls.unsubscribe.post("abc123"), new Promise(() => {}))
    renderWithProviders(<UnsubscribePage token="abc123" />)

    const button = screen.getByRole("button", { name: /confirm unsubscribe/i })
    await userEvent.click(button)

    await waitFor(() => {
      expect(button).toBeDisabled()
    })
  })
})
