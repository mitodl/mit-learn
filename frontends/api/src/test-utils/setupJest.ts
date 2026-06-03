import { mockAxiosFactory, assertMockAdapterInstalled } from "./mockAxios"
import { configureApiClients } from "../runtime"

// Wrapped in `() => …` to defer the identifier lookup past TDZ — jest.mock
// is hoisted above imports, so passing `mockAxiosFactory` directly would
// evaluate the (still-unbound) reference at registration time.
// https://jestjs.io/docs/es6-class-mocks#calling-jestmock-with-the-module-factory-parameter
jest.mock("axios", () => mockAxiosFactory())

beforeEach(() => {
  assertMockAdapterInstalled()
})

// Hardcoded test base URLs are the single source of truth for this workspace:
// the test URL builders (test-utils/urls.ts) read them back from the configured
// axios instance, so requests and their expected URLs stay in sync. No env vars
// are consulted — this workspace has no runtime env injection.
configureApiClients({
  learn: {
    baseUrl: "http://api.test.learn.odl.local:8065",
    csrfCookieName: "csrftoken",
    withCredentials: false,
  },
  mitxonline: {
    baseUrl: "http://api.test.learn.odl.local:8065/mitxonline",
    csrfCookieName: "mitxcsrftoken",
    withCredentials: false,
  },
})
