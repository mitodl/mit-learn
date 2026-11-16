import { act, renderHook } from "@testing-library/react"
import posthog from "posthog-js"
import * as Sentry from "@sentry/nextjs"
import * as yup from "yup"
import { FeatureFlags } from "./feature_flags"
import { useFeatureFlagResult } from "./useFeatureFlagResult"

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    getFeatureFlagResult: jest.fn(),
    onFeatureFlags: jest.fn(),
  },
}))
jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}))
const mockGetResult = jest.mocked(posthog.getFeatureFlagResult)
const mockOnFeatureFlags = jest.mocked(posthog.onFeatureFlags)
const mockCaptureException = jest.mocked(Sentry.captureException)

const schema = yup.object({
  code: yup.string().required(),
  percent: yup.number().required(),
})
const FLAG = FeatureFlags.CyberSaleBanner

const setResult = (payload: unknown, variant = "sale", enabled = true) => {
  mockGetResult.mockReturnValue({
    key: FLAG,
    enabled,
    variant,
    payload: payload as never,
  })
}

describe("useFeatureFlagResult", () => {
  beforeEach(() => {
    mockOnFeatureFlags.mockReturnValue(() => {})
  })

  test("Returns the flag's variant and validated payload, without unknown keys", () => {
    setResult({ code: "LEVELUP", percent: 15, x: 1 })
    const { result } = renderHook(() => useFeatureFlagResult(FLAG, schema))
    expect(result.current).toEqual({
      enabled: true,
      variant: "sale",
      payload: { code: "LEVELUP", percent: 15 },
    })
    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  test("Is undefined before PostHog has the flag", () => {
    mockGetResult.mockReturnValue(undefined)
    const { result } = renderHook(() => useFeatureFlagResult(FLAG, schema))
    expect(result.current).toBeUndefined()
  })

  test.each([undefined, null])(
    "A missing payload (%s) is undefined and not reported",
    (payload) => {
      setResult(payload)
      const { result } = renderHook(() => useFeatureFlagResult(FLAG, schema))
      expect(result.current).toEqual({
        enabled: true,
        variant: "sale",
        payload: undefined,
      })
      expect(mockCaptureException).not.toHaveBeenCalled()
    },
  )

  test("A payload that fails the schema is undefined and reported once", () => {
    setResult({ code: "LEVELUP" })
    const { result, rerender } = renderHook(() =>
      useFeatureFlagResult(FLAG, schema),
    )
    rerender()
    expect(result.current?.payload).toBeUndefined()
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
    mockGetResult.mockReturnValue(undefined)
    const { result } = renderHook(() => useFeatureFlagResult(FLAG, schema))
    expect(result.current).toBeUndefined()
    setResult({ code: "LEVELUP", percent: 15 }, "awareness")
    act(() => mockOnFeatureFlags.mock.calls[0][0]([], {}))
    expect(result.current?.variant).toBe("awareness")
  })
})
