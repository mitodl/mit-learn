import { renderHook, waitFor } from "@testing-library/react"
import { act } from "react"
import { usePostHog } from "posthog-js/react"
import type { PostHog } from "posthog-js"

// Import the real implementation, not the mock
const { useFeatureFlagsLoaded } = jest.requireActual("./useFeatureFlagsLoaded")

jest.mock("posthog-js/react", () => {
  return {
    __esModule: true,
    usePostHog: jest.fn(),
  }
})

const mockUsePostHog = jest.mocked(usePostHog)

describe("useFeatureFlagsLoaded", () => {
  let onFeatureFlagsCallback:
    | ((flags: string[], variants: Record<string, string | boolean>) => void)
    | null = null

  const createPostHogMock = (hasLoadedFlags: boolean) => {
    return {
      featureFlags: {
        hasLoadedFlags,
      },
      onFeatureFlags: jest.fn((callback) => {
        onFeatureFlagsCallback = callback
        return () => {} // Return cleanup function
      }),
    } as unknown as PostHog
  }

  beforeEach(() => {
    onFeatureFlagsCallback = null
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test("Returns false when flags have not loaded yet", () => {
    mockUsePostHog.mockReturnValue(createPostHogMock(false))

    const { result } = renderHook(() => useFeatureFlagsLoaded())

    expect(result.current).toBe(false)
  })

  test("Returns true when flags have already loaded", () => {
    mockUsePostHog.mockReturnValue(createPostHogMock(true))

    const { result } = renderHook(() => useFeatureFlagsLoaded())

    expect(result.current).toBe(true)
  })

  test("Returned value is reactive and re-renders when onFeatureFlags callback runs", async () => {
    mockUsePostHog.mockReturnValue(createPostHogMock(false))

    const { result } = renderHook(() => useFeatureFlagsLoaded())

    // Initially should be false
    expect(result.current).toBe(false)

    // Simulate flags loading by calling the callback
    expect(onFeatureFlagsCallback).not.toBeNull()
    act(() => {
      onFeatureFlagsCallback!([], {})
    })

    // Wait for the state to update
    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })

  test("onFeatureFlags callback is registered on mount", () => {
    const mockPostHog = createPostHogMock(false)
    mockUsePostHog.mockReturnValue(mockPostHog)

    renderHook(() => useFeatureFlagsLoaded())

    expect(mockPostHog.onFeatureFlags).toHaveBeenCalledTimes(1)
    expect(mockPostHog.onFeatureFlags).toHaveBeenCalledWith(
      expect.any(Function),
    )
  })
})
