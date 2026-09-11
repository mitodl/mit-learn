import React from "react"

import { waitFor } from "@testing-library/react"
import ConfiguredPostHogProvider, {
  PosthogIdentifier,
} from "./ConfiguredPostHogProvider"
import { renderWithProviders } from "@/test-utils"

// mock stuff
import { setMockResponse, urls, factories } from "api/test-utils"
import type { User } from "api/hooks/user"
import { usePostHog } from "posthog-js/react"
import posthogClient from "posthog-js"
import type { PostHog } from "posthog-js"

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { init: jest.fn() },
}))

jest.mock("posthog-js/react", () => {
  return {
    __esModule: true,
    usePostHog: jest.fn(),
    PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
  }
})
const mockInit = jest.mocked(posthogClient.init)
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
    const userData = factories.user.user(user)

    setMockResponse.get(urls.userMe.get(), userData)
    /**
     * No `user` option: we want the user to arrive via the mocked request, so
     * that the effect runs on a pending-then-resolved query as it does in the
     * app, rather than on a pre-seeded cache.
     */
    renderWithProviders(<PosthogIdentifier />)
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

describe("ConfiguredPostHogProvider", () => {
  beforeEach(() => {
    mockInit.mockClear()
    process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "test-key"
  })
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
  })

  /**
   * posthog-js resolves `capture_pageview` from `defaults`: without a date it
   * is `true`, which only captures hard page loads. App Router navigations
   * need the "history_change" behavior that this date opts into.
   */
  test("Initializes posthog with a pinned defaults date", async () => {
    setMockResponse.get(urls.userMe.get(), factories.user.user({}))
    renderWithProviders(
      <ConfiguredPostHogProvider>{null}</ConfiguredPostHogProvider>,
    )

    await waitFor(() => {
      expect(mockInit).toHaveBeenCalledExactlyOnceWith(
        "test-key",
        expect.objectContaining({ defaults: "2025-05-24" }),
      )
    })
  })

  test("Does not initialize posthog without an api key", () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
    setMockResponse.get(urls.userMe.get(), factories.user.user({}))
    renderWithProviders(
      <ConfiguredPostHogProvider>{null}</ConfiguredPostHogProvider>,
    )

    expect(mockInit).not.toHaveBeenCalled()
  })
})
