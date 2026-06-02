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

configureApiClients({
  learn: {
    baseUrl:
      process.env.NEXT_PUBLIC_MITOL_API_BASE_URL ??
      "http://api.test.learn.odl.local:8065",
    csrfCookieName: "csrftoken",
    withCredentials: false,
  },
  mitxonline: {
    baseUrl:
      process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL ??
      "http://api.test.learn.odl.local:8065/mitxonline",
    csrfCookieName: "mitxcsrftoken",
    withCredentials: false,
  },
})
