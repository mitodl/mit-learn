import { renderHook } from "@testing-library/react"
import mockRouter from "next-router-mock"
import { useAppSearchParams } from "./useAppSearchParams"

// next/navigation is globally mocked via jest-shared-setup.ts (next-router-mock)

test("returns the current URL's search params", () => {
  mockRouter.setCurrentUrl("/search?q=physics&page=2")
  const { result } = renderHook(() => useAppSearchParams())
  expect(result.current.get("q")).toBe("physics")
  expect(result.current.get("page")).toBe("2")
  expect(result.current.has("resource")).toBe(false)
  expect(result.current.toString()).toBe("q=physics&page=2")
})
