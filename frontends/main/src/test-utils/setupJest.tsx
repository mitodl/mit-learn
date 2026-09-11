// React is referenced by the JSX in the jest.mock factory below; @swc/jest's
// transform inlines React.createElement, so the import must stay even though
// TS sees it as unused.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from "react"
import {
  mockAxiosFactory,
  assertMockAdapterInstalled,
} from "api/test-utils/mockAxios"
import preloadAll from "jest-next-dynamic-ts"
import {
  dismissErrorToast,
  getToastSnapshot,
} from "@/page-components/Toaster/toastStore"

// Wrapped in `() => …` to defer the identifier lookup past TDZ — jest.mock
// is hoisted above imports, so passing `mockAxiosFactory` directly would
// evaluate the (still-unbound) reference at registration time.
// https://jestjs.io/docs/es6-class-mocks#calling-jestmock-with-the-module-factory-parameter
jest.mock("axios", () => mockAxiosFactory())

const { configureApiClients } = jest.requireActual("api/runtime")

// NEXT_PUBLIC_* test values live here (the main workspace setup) rather than the
// shared setup: only main's app code reads them, via the env() helper which
// falls back to process.env under jsdom. The api workspace and ol-* packages
// don't need them.
const LEARN_BASE_URL = "http://api.test.learn.odl.local:8065"
const MITX_ONLINE_BASE_URL = "http://api.test.learn.odl.local:8065/mitxonline"
const ANALYTICS_BASE_URL = "http://api.test.learn.odl.local:8065/analytics"

process.env.NEXT_PUBLIC_ORIGIN = "http://test.learn.odl.local:8062"
process.env.NEXT_PUBLIC_VERSION = "test-version"
process.env.NEXT_PUBLIC_MITOL_API_BASE_URL = LEARN_BASE_URL
process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL = MITX_ONLINE_BASE_URL
process.env.NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL =
  "http://mitxonline.odl.local:8065"
process.env.NEXT_PUBLIC_ANALYTICS_API_BASE_URL = ANALYTICS_BASE_URL

configureApiClients({
  learn: {
    baseUrl: LEARN_BASE_URL,
    csrfCookieName: "csrftoken",
    withCredentials: false,
  },
  mitxonline: {
    baseUrl: MITX_ONLINE_BASE_URL,
    csrfCookieName: "mitxcsrftoken",
    withCredentials: false,
  },
  analytics: {
    baseUrl: ANALYTICS_BASE_URL,
    csrfCookieName: "csrftoken",
    withCredentials: false,
  },
})

jest.mock("react-markdown", () => {
  return {
    __esModule: true,
    default: ({ children }: { children: string }) => <div>{children}</div>,
  }
})

beforeAll(async () => {
  await preloadAll()
})

beforeEach(() => {
  // React testing library mounts the components into a container, and clears
  // the container automatically after each test.
  // However, react-helmet manipulates the document head, which is outside that
  // container. So we need to clear it manually.
  // document.head.innerHTML = ""
  document.querySelector("title")?.remove()

  // The error-toast store is module-level global state; a toast fired by one
  // test would otherwise persist into the next. (The afterEach below usually
  // clears it, but a toast can land asynchronously after that check runs.)
  dismissErrorToast()

  assertMockAdapterInstalled()
})

afterEach(() => {
  // Every mutation failure raises the global error toast unless the call site
  // opts out. A toast left showing at the end of a test means the test drove a
  // failure without deciding which error surface the user should see.
  const toast = getToastSnapshot()
  if (toast) {
    dismissErrorToast()
    throw new Error(
      [
        `A mutation failure fired the global error toast ("${toast.message}") and the test did not acknowledge it.`,
        '- If the component renders its own inline error for this failure, opt out of the toast: pass `meta: SILENCE_ERROR_TOAST` (from "api/mutation-meta") to the mutation hook.',
        '- If the toast is the intended error surface, acknowledge it in the test: `await expectErrorToast(...)` (from "@/test-utils").',
      ].join("\n"),
    )
  }
})

window.scrollTo = jest.fn()
