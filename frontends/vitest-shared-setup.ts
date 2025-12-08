import { vi, beforeEach, afterEach, expect } from "vitest"
import failOnConsole from "jest-fail-on-console"
import "@testing-library/jest-dom"
import "cross-fetch/polyfill"
import { resetAllWhenMocks } from "jest-when"
import * as matchers from "jest-extended"
import { mockRouter } from "ol-test-utilities/mocks/nextNavigation"

expect.extend(matchers)

// Note: Environment variables are now set in vitest-jest-compat.ts
// which runs before this file, ensuring they're available when modules load

// Pulled from the docs - see https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

Element.prototype.scrollIntoView = vi.fn()

window.IntersectionObserver = class IntersectionObserver {
  observe() {
    return null
  }
  unobserve() {
    return null
  }
  disconnect() {
    return null
  }
} as any

/*
 * This used to live in ol-ckeditor but we also need it now for NukaCarousel,
 * so it's now here so it's available across the board.
 */
class FakeResizeObserver {
  observe() {
    /** pass */
  }
  unobserve() {
    /** pass */
  }
  disconnect() {
    /** pass */
  }
}
const polyfillResizeObserver = () => {
  // happy-dom already provides ResizeObserver, so we only polyfill if it's missing
  if (window.ResizeObserver === undefined) {
    window.ResizeObserver = FakeResizeObserver
  }
  // If ResizeObserver exists but isn't fully functional, we can override it
  // For now, we'll use the native one if available (happy-dom) or our fake one (jsdom)
}
polyfillResizeObserver()

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<{
    nextNavigationMocks: any
  }>("ol-test-utilities/mocks/nextNavigation")
  return {
    ...actual.nextNavigationMocks,
  }
})

beforeEach(() => {
  mockRouter.setCurrentUrl("/")
  window.history.replaceState({}, "", "/")
})
afterEach(() => {
  /**
   * Clear all mock call counts between tests.
   * This does NOT clear mock implementations.
   * Mock implementations are always cleared between test files.
   */
  vi.clearAllMocks()
  resetAllWhenMocks()
})

/**
 * NOTE: This registers hooks (afterEach, etc) with Jest that cause tests to
 * fail when console.warn or console.error are called.
 *
 * However, method calls occurring in beforeEach hooks earlier or afterEach hooks
 * after this line will not error.
 * - beforeEach hooks declared earlier than this call
 * - afterEach hooks declared later than this call
 */
failOnConsole({
  allowMessage(message, _methodName, _context) {
    const ALLLOWED_PATTERNS = [
      /**
       * A warning thrown by next/image.
       * See https://nextjs.org/docs/messages/next-image-unconfigured-qualities
       * We do not currently use next/jest, but that may eventually handle this.
       */
      /which is not configured in images.qualities/.test(message),
    ]
    return ALLLOWED_PATTERNS.some((x) => x === true)
  },
})

