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

process.env.NEXT_PUBLIC_ORIGIN = "http://test.learn.odl.local:8062"
process.env.NEXT_PUBLIC_VERSION = "test-version"
process.env.NEXT_PUBLIC_MITOL_API_BASE_URL = LEARN_BASE_URL
process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL = MITX_ONLINE_BASE_URL
process.env.NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL =
  "http://mitxonline.odl.local:8065"

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

  assertMockAdapterInstalled()
})

window.scrollTo = jest.fn()
