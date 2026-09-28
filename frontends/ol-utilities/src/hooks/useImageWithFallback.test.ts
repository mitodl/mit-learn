import { renderHook, act } from "@testing-library/react"
import type { SyntheticEvent } from "react"
import { useImageWithFallback } from "./useImageWithFallback"

const SRC = "https://example.com/image.jpg"
const FALLBACK = "/images/fallback.jpg"

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

  act(() => result.current.onError())
  expect(result.current.src).toBe(SRC)
  expect(result.current.unoptimized).toBe(true)

  act(() => result.current.onError())
  expect(result.current.src).toBe(FALLBACK)
  expect(result.current.unoptimized).toBe(false)

  // Stays on the fallback if that fails too
  act(() => result.current.onError())
  expect(result.current.src).toBe(FALLBACK)
  expect(result.current.unoptimized).toBe(false)
})

const errorEvent = (failedSrc: string) =>
  ({
    currentTarget: { src: failedSrc },
  }) as unknown as SyntheticEvent<HTMLImageElement>

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
  act(() =>
    result.current.onError(
      errorEvent(
        "http://localhost/_next/image?url=%2Fimages%2Flocal.png&w=640&q=75",
      ),
    ),
  )
  expect(result.current.src).toBe("/images/local.png")
  expect(result.current.unoptimized).toBe(true)
})

test("starts over when src changes", () => {
  const { result, rerender } = renderHook(
    ({ src }) => useImageWithFallback(src, FALLBACK),
    { initialProps: { src: SRC } },
  )
  act(() => result.current.onError())
  act(() => result.current.onError())
  expect(result.current.src).toBe(FALLBACK)

  const other = "https://example.com/other.jpg"
  rerender({ src: other })
  expect(result.current.src).toBe(other)
  expect(result.current.unoptimized).toBe(false)
})
