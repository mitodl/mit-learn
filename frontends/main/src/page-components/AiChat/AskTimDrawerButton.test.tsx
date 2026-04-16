import React from "react"
import { renderWithProviders, screen, user, waitFor } from "@/test-utils"
import AskTIMButton from "./AskTimDrawerButton"
import { RECOMMENDER_QUERY_PARAM } from "@/common/urls"
import { usePostHog } from "posthog-js/react"
import { PostHogEvents } from "@/common/constants"
import { allowConsoleErrors } from "ol-test-utilities"

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  usePostHog: jest.fn(),
}))
const mockCapture = jest.fn()
jest.mocked(usePostHog).mockReturnValue(
  // @ts-expect-error Not mocking all of posthog
  { capture: mockCapture },
)

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

  test("clicking Ask TIM fires asktim_clicked with type recommendation_bot", async () => {
    allowConsoleErrors()
    process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "test-key"
    mockCapture.mockClear()
    renderWithProviders(<AskTIMButton />)
    await user.click(screen.getByRole("link", { name: /ask tim/i }))
    expect(mockCapture).toHaveBeenCalledWith(PostHogEvents.AskTimClicked, {
      type: "recommendation_bot",
    })
    delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
  })
})
