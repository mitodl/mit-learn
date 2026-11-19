import React from "react"
import { act, configure, screen, waitFor } from "@testing-library/react"
import type { QueryClient } from "@tanstack/react-query"
import posthog from "posthog-js"
import ConfiguredPostHogProvider from "./ConfiguredPostHogProvider"
import { renderWithProviders } from "@/test-utils"
import type { TestAppOptions } from "@/test-utils"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { setMockResponse, urls, factories } from "api/test-utils"
import { userQueries } from "api/hooks/user"
import type { User } from "api/hooks/user"
import { getFirstFlagLoad, loadFlags } from "@/bootstrap/posthog"

type ReloadStatus = "loaded" | "error" | "skipped" | "cancelled"

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    identify: jest.fn(),
    reset: jest.fn(),
    get_property: jest.fn(),
    get_distinct_id: jest.fn(),
    featureFlags: { reloadFeatureFlagsAsync: jest.fn() },
  },
}))
jest.mock("posthog-js/react", () => ({
  __esModule: true,
  PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock("@/bootstrap/posthog", () => ({
  ...jest.requireActual("@/bootstrap/posthog"),
  getFirstFlagLoad: jest.fn(),
}))

const mockPosthog = jest.mocked(posthog)
const mockGetFirstFlagLoad = jest.mocked(getFirstFlagLoad)
const mockReload = jest.mocked(posthog.featureFlags.reloadFeatureFlagsAsync)

/**
 * Each reloadFeatureFlagsAsync call stays pending until the test settles it,
 * by index, with `settleReload`.
 */
let reloads: Array<(status: ReloadStatus) => void> = []
const settleReload = (index: number, status: ReloadStatus = "loaded") =>
  act(() => reloads[index](status))

const FlagsLoaded = () => (
  <div data-testid="flags-loaded">{String(useFeatureFlagsLoaded())}</div>
)
const flagsLoaded = () => screen.getByTestId("flags-loaded").textContent

/** Has identify switch posthog's distinct id, as the real one does. */
const identifyChangesId = () =>
  mockPosthog.identify.mockImplementation((id) => {
    mockPosthog.get_distinct_id.mockReturnValue(id as string)
  })

const refetchMe = (queryClient: QueryClient, user: User) => {
  setMockResponse.get(urls.userMe.get(), user)
  return act(() =>
    queryClient.refetchQueries({ queryKey: userQueries.me().queryKey }),
  )
}

type RenderOptions = Partial<TestAppOptions> & {
  /** `false` for a page where bootstrapPostHog didn't start posthog. */
  posthogRunning?: boolean
}

/** Starts the page's first flag load (reload 0), as bootstrapPostHog does. */
const renderProvider = ({
  posthogRunning = true,
  ...options
}: RenderOptions = {}) => {
  mockGetFirstFlagLoad.mockReturnValue(posthogRunning ? loadFlags() : undefined)
  return renderWithProviders(
    <ConfiguredPostHogProvider>
      <FlagsLoaded />
    </ConfiguredPostHogProvider>,
    options,
  )
}

/**
 * No `user` option: the user arrives via the mocked request, so the identity
 * effect runs on a pending-then-resolved query as it does in the app, rather
 * than on a pre-seeded cache.
 */
const setup = (user: Partial<User> = {}, options: RenderOptions = {}) => {
  const userData = factories.user.user(user)
  setMockResponse.get(urls.userMe.get(), userData)
  const { queryClient } = renderProvider(options)
  return { user: userData, queryClient }
}

const waitForMe = (queryClient: QueryClient, status: "success" | "error") =>
  waitFor(() =>
    expect(queryClient.getQueryState(userQueries.me().queryKey)?.status).toBe(
      status,
    ),
  )

describe("ConfiguredPostHogProvider", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "test-key"
    reloads = []
    mockReload.mockImplementation(
      () =>
        new Promise((resolve) => {
          reloads.push((status) => resolve({ status }))
        }),
    )
    mockPosthog.identify.mockReset()
    mockPosthog.get_property.mockReturnValue("anonymous")
    mockPosthog.get_distinct_id.mockReturnValue("anonymous-id")
  })
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
  })

  test("When posthog isn't running on the page, flags count as loaded and nobody is identified or reset", async () => {
    // Not "anonymous", so a reset would happen if the identity were synced.
    mockPosthog.get_property.mockReturnValue("identified")
    const { queryClient } = setup({}, { posthogRunning: false })
    await waitForMe(queryClient, "success")
    expect(flagsLoaded()).toBe("true")
    expect(mockPosthog.identify).not.toHaveBeenCalled()
    expect(mockPosthog.reset).not.toHaveBeenCalled()
    expect(mockReload).not.toHaveBeenCalled()
  })

  test("An anonymous visitor's flags load with the first request", async () => {
    setup({ is_authenticated: false })
    await waitFor(() => expect(mockPosthog.get_property).toHaveBeenCalled())
    expect(flagsLoaded()).toBe("false")
    await settleReload(0)
    expect(flagsLoaded()).toBe("true")
    expect(mockPosthog.reset).not.toHaveBeenCalled()
    expect(mockPosthog.identify).not.toHaveBeenCalled()
  })

  test("A failed flag request ends the wait", async () => {
    setup({ is_authenticated: false })
    await waitFor(() => expect(mockPosthog.get_property).toHaveBeenCalled())
    await settleReload(0, "error")
    expect(flagsLoaded()).toBe("true")
    expect(mockReload).toHaveBeenCalledOnce()
  })

  test("A logged-out visitor whom posthog still has as identified is reset, and waits for the reset's flags", async () => {
    mockPosthog.get_property.mockReturnValue("identified")
    setup({ is_authenticated: false })
    await waitFor(() => expect(mockPosthog.reset).toHaveBeenCalledOnce())
    await settleReload(0)
    expect(flagsLoaded()).toBe("false")
    await settleReload(1)
    expect(flagsLoaded()).toBe("true")
  })

  test.each([
    { order: "anonymous answer first", settleOrder: [0, 1] },
    { order: "identified answer first", settleOrder: [1, 0] },
  ])(
    "A /me change from anonymous to logged in during the first load waits for the identified flags ($order)",
    async ({ settleOrder }) => {
      const { queryClient } = setup({ is_authenticated: false })
      await waitForMe(queryClient, "success")
      identifyChangesId()
      await refetchMe(queryClient, factories.user.user())
      await waitFor(() => expect(mockReload).toHaveBeenCalledTimes(2))
      const [first, second] = settleOrder
      await settleReload(first)
      expect(flagsLoaded()).toBe(first === 1 ? "true" : "false")
      await settleReload(second)
      expect(flagsLoaded()).toBe("true")
    },
  )

  test("A /me change that keeps the identity waits for that identity's pending flags", async () => {
    identifyChangesId()
    const { user, queryClient } = setup()
    await waitFor(() => expect(mockReload).toHaveBeenCalledTimes(2))
    await refetchMe(queryClient, { ...user, first_name: "Changed" })
    await waitFor(() => expect(mockPosthog.identify).toHaveBeenCalledTimes(2))
    await settleReload(0)
    expect(flagsLoaded()).toBe("false")
    await settleReload(1)
    expect(flagsLoaded()).toBe("true")
    expect(mockReload).toHaveBeenCalledTimes(2)
  })

  test("Identifying the user posthog already has waits only for the first request", async () => {
    const { user } = setup()
    mockPosthog.get_distinct_id.mockReturnValue(user.global_id as string)
    await waitFor(() =>
      expect(mockPosthog.identify).toHaveBeenCalledExactlyOnceWith(
        user.global_id,
      ),
    )
    await settleReload(0)
    expect(flagsLoaded()).toBe("true")
    expect(mockReload).toHaveBeenCalledOnce()
  })

  test("A cached user, synced on the first render, waits for the first request", async () => {
    const user = factories.user.user()
    setMockResponse.get(urls.userMe.get(), user)
    renderProvider({ user })
    await waitFor(() => expect(mockPosthog.identify).toHaveBeenCalled())
    expect(flagsLoaded()).toBe("false")
    await settleReload(0)
    expect(flagsLoaded()).toBe("true")
  })

  test("Under Strict Mode, a cached user whom identify switches to waits for the identified request", async () => {
    identifyChangesId()
    const user = factories.user.user()
    setMockResponse.get(urls.userMe.get(), user)
    configure({ reactStrictMode: true })
    try {
      renderProvider({ user })
    } finally {
      configure({ reactStrictMode: false })
    }
    await waitFor(() => expect(mockReload).toHaveBeenCalledTimes(2))
    await settleReload(0)
    expect(flagsLoaded()).toBe("false")
    await settleReload(1)
    expect(flagsLoaded()).toBe("true")
  })

  test("A user with no global id is neither identified nor reset", async () => {
    // Not "anonymous", so a fall-through to the reset branch would be visible.
    mockPosthog.get_property.mockReturnValue("identified")
    const { queryClient } = setup({ global_id: null })
    await waitForMe(queryClient, "success")
    expect(flagsLoaded()).toBe("false")
    await settleReload(0)
    expect(flagsLoaded()).toBe("true")
    expect(mockPosthog.identify).not.toHaveBeenCalled()
    expect(mockPosthog.reset).not.toHaveBeenCalled()
  })

  test("A cancelled load waits for the next one", async () => {
    setup({ is_authenticated: false })
    await waitFor(() => expect(mockPosthog.get_property).toHaveBeenCalled())
    await settleReload(0, "cancelled")
    expect(flagsLoaded()).toBe("false")
    await settleReload(1)
    expect(flagsLoaded()).toBe("true")
  })

  test("A failed /me waits only for the first request", async () => {
    setMockResponse.get(urls.userMe.get(), {}, { code: 500 })
    const { queryClient } = renderProvider()
    await waitForMe(queryClient, "error")
    expect(flagsLoaded()).toBe("false")
    await settleReload(0)
    expect(flagsLoaded()).toBe("true")
    expect(mockPosthog.identify).not.toHaveBeenCalled()
    expect(mockPosthog.reset).not.toHaveBeenCalled()
  })

  test("Doesn't warn about the cap once flags have loaded", async () => {
    jest.useFakeTimers()
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
    try {
      setup({ is_authenticated: false })
      await waitFor(() => expect(mockPosthog.get_property).toHaveBeenCalled())
      await settleReload(0)
      await act(() => jest.advanceTimersByTime(10_000))
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
      jest.useRealTimers()
    }
  })

  test("Stops waiting after 10 seconds, with a warning", async () => {
    jest.useFakeTimers()
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
    try {
      setup()
      await act(() => jest.advanceTimersByTime(9_999))
      expect(flagsLoaded()).toBe("false")
      expect(warn).not.toHaveBeenCalled()
      await act(() => jest.advanceTimersByTime(1))
      expect(flagsLoaded()).toBe("true")
      expect(warn).toHaveBeenCalledOnce()
    } finally {
      warn.mockRestore()
      jest.useRealTimers()
    }
  })

  test("Without an api key, flags count as loaded", () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
    setup({}, { posthogRunning: false })
    expect(flagsLoaded()).toBe("true")
  })
})
