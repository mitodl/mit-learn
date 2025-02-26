import React from "react"
import { renderWithProviders, screen, user, waitFor } from "@/test-utils"
import AskTIMButton from "./AskTimDrawerButton"
import { RECOMMENDER_QUERY_PARAM } from "@/common/urls"

describe("AskTIMButton", () => {
  it.each([
    { url: "", open: false },
    { url: `?${RECOMMENDER_QUERY_PARAM}`, open: true },
  ])("Opens drawer based on URL param", async ({ url, open }) => {
    renderWithProviders(<AskTIMButton />, {
      url,
    })

    const aiChat = screen.queryByTestId("ai-chat-entry-screen")
    expect(!!aiChat).toBe(open)
  })

  test("Clicking button opens / closes drawer", async () => {
    const { location } = renderWithProviders(<AskTIMButton />)

    expect(location.current.searchParams.has(RECOMMENDER_QUERY_PARAM)).toBe(
      false,
    )

    const askTim = screen.getByRole("link", { name: /ask tim/i })

    await user.click(askTim)

    expect(location.current.searchParams.has(RECOMMENDER_QUERY_PARAM)).toBe(
      true,
    )

    await user.click(screen.getByRole("button", { name: "Close" }))

    await waitFor(() => {
      expect(location.current.searchParams.has(RECOMMENDER_QUERY_PARAM)).toBe(
        false,
      )
    })
  })
})
