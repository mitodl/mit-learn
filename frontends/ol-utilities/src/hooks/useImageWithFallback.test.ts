import { renderHook, act } from "@testing-library/react"
import type { SyntheticEvent } from "react"
import { useImageWithFallback } from "./useImageWithFallback"

const SRC = "https://example.com/image.jpg"
const FALLBACK = "/images/fallback.jpg"

/** An error event from an <img> whose src was `failedSrc`. */
const errorEvent = (failedSrc: string) =>
  ({
    currentTarget: { src: failedSrc },
  }) as unknown as SyntheticEvent<HTMLImageElement>

/** What the optimized <img> src looks like for `src`. */
const optimized = (src: string) =>
  `http://localhost/_next/image?url=${encodeURIComponent(src)}&w=640&q=75`

test("starts with the optimized src", () => {
  const { result } = renderHook(() => useImageWithFallback(SRC, FALLBACK))
  expect(result.current.src).toBe(SRC)
  expect(result.current.unoptimized).toBe(false)
})

test.each([null, undefined, ""])("uses the fallback when src is %p", (src) => {
  const { result } = renderHook(() => useImageWithFallback(src, FALLBACK))
  expect(result.current.src).toBe(FALLBACK)
  expect(result.current.unoptimized).toBe(false)
})

test("retries the original unoptimized, then uses the fallback", () => {
  const { result } = renderHook(() => useImageWithFallback(SRC, FALLBACK))

  act(() => result.current.onError(errorEvent(optimized(SRC))))
  expect(result.current.src).toBe(SRC)
  expect(result.current.unoptimized).toBe(true)

  act(() => result.current.onError(errorEvent(SRC)))
  expect(result.current.src).toBe(FALLBACK)
  expect(result.current.unoptimized).toBe(false)

  // Stays on the fallback if that fails too
  act(() => result.current.onError(errorEvent(`http://localhost${FALLBACK}`)))
  expect(result.current.src).toBe(FALLBACK)
  expect(result.current.unoptimized).toBe(false)
})

test("skips to the fallback when the failed image was already the original", () => {
  // e.g. Next.js serves SVGs unoptimized, so the retry would be identical
  const { result } = renderHook(() => useImageWithFallback(SRC, FALLBACK))
  act(() => result.current.onError(errorEvent(SRC)))
  expect(result.current.src).toBe(FALLBACK)
  expect(result.current.unoptimized).toBe(false)
})

test("retries the original when the failed image went through the optimizer", () => {
  const { result } = renderHook(() =>
    useImageWithFallback("/images/local.png", FALLBACK),
  )
  act(() => result.current.onError(errorEvent(optimized("/images/local.png"))))
  expect(result.current.src).toBe("/images/local.png")
  expect(result.current.unoptimized).toBe(true)
})

test("starts over when src changes", () => {
  const { result, rerender } = renderHook(
    ({ src }) => useImageWithFallback(src, FALLBACK),
    { initialProps: { src: SRC } },
  )
  act(() => result.current.onError(errorEvent(optimized(SRC))))
  act(() => result.current.onError(errorEvent(SRC)))
  expect(result.current.src).toBe(FALLBACK)

  const other = "https://example.com/other.jpg"
  rerender({ src: other })
  expect(result.current.src).toBe(other)
  expect(result.current.unoptimized).toBe(false)
})

test("a new src never renders with the previous src's stage", () => {
  const renders: { src: string; unoptimized: boolean }[] = []
  const { result, rerender } = renderHook(
    ({ src }) => {
      const value = useImageWithFallback(src, FALLBACK)
      renders.push({ src: value.src, unoptimized: value.unoptimized })
      return value
    },
    { initialProps: { src: SRC } },
  )
  // SRC is now loading its original, unoptimized
  act(() => result.current.onError(errorEvent(optimized(SRC))))
  expect(result.current.unoptimized).toBe(true)

  const other = "https://example.com/other.jpg"
  renders.length = 0
  rerender({ src: other })
  // Every render of `other` goes through the optimizer first
  expect(renders.filter((r) => r.src === other)).not.toHaveLength(0)
  expect(renders.filter((r) => r.src === other && r.unoptimized)).toEqual([])
})
