import { act, renderHook } from "@testing-library/react"
import posthog from "posthog-js"
import * as Sentry from "@sentry/nextjs"
import * as yup from "yup"
import { FeatureFlags } from "./feature_flags"
import { useFeatureFlagPayload } from "./useFeatureFlagPayload"

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    getFeatureFlagPayload: jest.fn(),
    onFeatureFlags: jest.fn(),
  },
}))
jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}))
const mockGetPayload = jest.mocked(posthog.getFeatureFlagPayload)
const mockOnFeatureFlags = jest.mocked(posthog.onFeatureFlags)
const mockCaptureException = jest.mocked(Sentry.captureException)

const schema = yup.object({
  code: yup.string().required(),
  percent: yup.number().required(),
})
const FLAG = FeatureFlags.CyberSaleBanner

describe("useFeatureFlagPayload", () => {
  beforeEach(() => {
    mockOnFeatureFlags.mockReturnValue(() => {})
  })

  test("Returns the validated payload, without unknown keys", () => {
    mockGetPayload.mockReturnValue({ code: "LEVELUP", percent: 15, x: 1 })
    const { result } = renderHook(() => useFeatureFlagPayload(FLAG, schema))
    expect(result.current).toEqual({ code: "LEVELUP", percent: 15 })
    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  test.each([undefined, null])(
    "A missing payload (%s) is undefined and not reported",
    (payload) => {
      mockGetPayload.mockReturnValue(payload)
      const { result } = renderHook(() => useFeatureFlagPayload(FLAG, schema))
      expect(result.current).toBeUndefined()
      expect(mockCaptureException).not.toHaveBeenCalled()
    },
  )

  test("A payload that fails the schema is undefined and reported once", () => {
    mockGetPayload.mockReturnValue({ code: "LEVELUP" })
    const { result, rerender } = renderHook(() =>
      useFeatureFlagPayload(FLAG, schema),
    )
    rerender()
    expect(result.current).toBeUndefined()
    expect(mockCaptureException).toHaveBeenCalledTimes(1)
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(yup.ValidationError),
      {
        tags: { feature_flag: FLAG },
        extra: { payload: JSON.stringify({ code: "LEVELUP" }) },
      },
    )
  })

  test("Updates when PostHog's flags change", () => {
    mockGetPayload.mockReturnValue(undefined)
    const { result } = renderHook(() => useFeatureFlagPayload(FLAG, schema))
    expect(result.current).toBeUndefined()
    mockGetPayload.mockReturnValue({ code: "LEVELUP", percent: 15 })
    act(() => mockOnFeatureFlags.mock.calls[0][0]([], {}))
    expect(result.current).toEqual({ code: "LEVELUP", percent: 15 })
  })
})
