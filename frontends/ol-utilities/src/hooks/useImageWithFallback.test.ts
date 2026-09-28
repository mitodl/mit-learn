import { renderHook, act } from "@testing-library/react"
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
