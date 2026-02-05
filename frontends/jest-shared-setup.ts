import failOnConsole from "jest-fail-on-console"
import "@testing-library/jest-dom"
import "cross-fetch/polyfill"
import { resetAllWhenMocks } from "jest-when"
import * as matchers from "jest-extended"
import { mockRouter } from "ol-test-utilities/mocks/nextNavigation"
import { setDefaultTimezone } from "ol-test-utilities"

expect.extend(matchers)

setDefaultTimezone("UTC")

// env vars
process.env.NEXT_PUBLIC_MITOL_API_BASE_URL =
  "http://api.test.learn.odl.local:8065"
process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL =
  "http://api.test.learn.odl.local:8065/mitxonline"
process.env.NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL =
  "http://mitxonline.odl.local:8065"
process.env.NEXT_PUBLIC_ORIGIN = "http://test.learn.odl.local:8062"
process.env.NEXT_PUBLIC_EMBEDLY_KEY = "fake-embedly-key"

// Pulled from the docs - see https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

Element.prototype.scrollIntoView = jest.fn()

window.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
}))

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
  if (
    window.ResizeObserver !== undefined &&
    // @ts-expect-error happyDOM specific property
    window.happyDOM === undefined
  ) {
    console.info(
      "ResizeObserver is already defined (expected if using the Happy DOM test environment). Skipping polyfill.",
    )
  }
  window.ResizeObserver = window.ResizeObserver || FakeResizeObserver
}
polyfillResizeObserver()

jest.mock("next/navigation", () => {
  return {
    ...jest.requireActual("ol-test-utilities/mocks/nextNavigation")
      .nextNavigationMocks,
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
  jest.clearAllMocks()
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
