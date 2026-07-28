import React from "react"

import { render, waitFor } from "@testing-library/react"
import { PosthogIdentifier } from "./ConfiguredPostHogProvider"
import { QueryClientProvider, QueryClient } from "@tanstack/react-query"

// mock stuff
import { setMockResponse, urls, factories } from "api/test-utils"
import type { User } from "api/hooks/user"
import { usePostHog } from "posthog-js/react"
import type { PostHog } from "posthog-js"

jest.mock("posthog-js/react", () => {
  return {
    __esModule: true,
    usePostHog: jest.fn(),
  }
})
const mockUsePostHog = jest.mocked(usePostHog)
const posthog: Pick<PostHog, "identify" | "reset" | "get_property"> = {
  identify: jest.fn(),
  reset: jest.fn(),
  get_property: jest.fn(),
}
mockUsePostHog.mockReturnValue(posthog as PostHog)
const mockPosthog = jest.mocked(posthog)

describe("PosthogIdentifier", () => {
  const setup = (user: Partial<User>) => {
    const queryClient = new QueryClient()
    const userData = factories.user.user(user)

    setMockResponse.get(urls.userMe.get(), userData)
    render(
      <QueryClientProvider client={queryClient}>
        <PosthogIdentifier />
      </QueryClientProvider>,
    )
    return userData
  }
  test.each([
    { posthogUserState: "anonymous", resetCalls: 0 },
    { posthogUserState: "anything_else", resetCalls: 1 },
  ])(
    "If user is NOT authenticated, calls `reset` if and only if not already anonymous",
    async ({ posthogUserState, resetCalls }) => {
      setup({ is_authenticated: false })
      mockPosthog.get_property.mockReturnValue(posthogUserState)
      await waitFor(() => {
        expect(mockPosthog.get_property).toHaveBeenCalledWith("$user_state")
      })
      expect(mockPosthog.reset).toHaveBeenCalledTimes(resetCalls)
      expect(mockPosthog.identify).not.toHaveBeenCalled()
    },
  )

  test("If authenticated, calls `identify` with the user's global id", async () => {
    const user = setup({ is_authenticated: true })
    await waitFor(() => {
      expect(mockPosthog.identify).toHaveBeenCalledExactlyOnceWith(
        user.global_id,
      )
    })
    expect(mockPosthog.reset).not.toHaveBeenCalled()
  })

  test("If authenticated with no global id, neither identifies nor resets", async () => {
    // Not "anonymous", so a fall-through to the reset branch would be visible.
    mockPosthog.get_property.mockReturnValue("identified")
    setup({ is_authenticated: true, global_id: null })
    await waitFor(() => {
      expect(mockPosthog.get_property).toHaveBeenCalledWith("$user_state")
    })
    expect(mockPosthog.identify).not.toHaveBeenCalled()
    expect(mockPosthog.reset).not.toHaveBeenCalled()
  })
})
