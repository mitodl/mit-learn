import { mockAxiosFactory, assertMockAdapterInstalled } from "./mockAxios"

// Wrapped in `() => …` to defer the identifier lookup past TDZ — jest.mock
// is hoisted above imports, so passing `mockAxiosFactory` directly would
// evaluate the (still-unbound) reference at registration time.
// https://jestjs.io/docs/es6-class-mocks#calling-jestmock-with-the-module-factory-parameter
jest.mock("axios", () => mockAxiosFactory())

beforeEach(() => {
  assertMockAdapterInstalled()
})
