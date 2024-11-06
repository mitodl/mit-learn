import React from "react"

import { render, waitFor } from "@testing-library/react"
import { PosthogIdenifier } from "./ConfiguredPostHogProvider"
import { QueryClientProvider, QueryClient } from "@tanstack/react-query"

// mock stuff
import { setMockResponse, urls } from "api/test-utils"
import type { User } from "api/hooks/user"
import { makeUserSettings } from "@/test-utils/factories"
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

describe("PosthogIdenifier", () => {
  const setup = (user: Partial<User>) => {
    const queryClient = new QueryClient()
    const userData = makeUserSettings(user)

    setMockResponse.get(urls.userMe.get(), userData)
    render(
      <QueryClientProvider client={queryClient}>
        <PosthogIdenifier />
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

  test("If authenticated, calls `identify` with user id and username", async () => {
    const user = setup({ is_authenticated: true })
    await waitFor(() => {
      expect(mockPosthog.identify).toHaveBeenCalledWith(String(user.id))
    })
    expect(mockPosthog.reset).not.toHaveBeenCalled()
  })
})
