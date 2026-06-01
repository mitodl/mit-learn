import { when } from "jest-when"
import { isFunction } from "lodash"
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from "axios"

const actualAxios = jest.requireActual<typeof import("axios")>("axios")
const { AxiosError } = actualAxios
// Fresh real-axios instance used purely to delegate URL resolution to axios's
// own buildFullPath / buildURL via getUri(). No requests are ever sent
// through it — getUri is synchronous.
const urlResolver = actualAxios.default.create()

type Method = "get" | "post" | "put" | "patch" | "delete"

type PartialAxiosResponse = Pick<AxiosResponse, "data" | "status">

type RequestArgs<TBody = unknown> = {
  method: Method
  url: string
  body?: TBody
}

type RequestMaker = (args: RequestArgs) => Promise<PartialAxiosResponse>

const alwaysError: RequestMaker = ({ method, url, body }) => {
  const msg = `No response specified for ${method} ${url}`
  console.error(msg)
  if (body !== undefined) {
    console.error("and body:")
    console.error(body)
  }
  throw new Error(msg)
}

const standardizeUrl = (url: string) => {
  if (!url.includes("?")) {
    return url
  }
  const [path, queryString] = url.split("?")
  const query = new URLSearchParams(queryString)
  query.sort()
  return `${path}?${query.toString()}`
}

/**
 * A jest mock function that records every fake network request. Call sites
 * receive a single object `{ method, url, body }`.
 *
 * Example assertion:
 * ```ts
 * expect(makeRequest).toHaveBeenCalledWith(
 *   expect.objectContaining({
 *     method: "post",
 *     url: "/some/url",
 *   }),
 * )
 * ```
 *
 * Method is always lowercase. URL is the fully-resolved URL (baseURL + url +
 * sorted query string). Body is deserialized (OpenAPI Generator stringifies on
 * the way out; the adapter parses it back).
 */
const makeRequest = jest.fn(alwaysError)
const makeSortedRequest: RequestMaker = ({ method, url, body }) =>
  makeRequest({ method, url: standardizeUrl(url), body })

/**
 * The mock axios adapter — the single point where tests divert from real
 * axios. Installed on `axios.defaults.adapter` in setupJest so it intercepts
 * every request regardless of whether it goes through the default export, an
 * instance, or `.create()`.
 *
 * Name must start with `mock` to satisfy jest.mock factory hoist rules
 * (factories may only reference outer-scope vars whose names begin with
 * `mock`).
 */
const mockAdapter: AxiosAdapter = async (config) => {
  const fullUrl = urlResolver.getUri({
    baseURL: config.baseURL,
    url: config.url,
    params: config.params,
  })
  const method = (config.method ?? "get").toLowerCase() as Method
  // OpenAPI Generator pre-serializes request bodies; deserialize so tests can
  // assert on object shape rather than the stringified form. Non-JSON string
  // bodies (e.g. text/plain) pass through unparsed.
  let body = config.data
  if (typeof config.data === "string") {
    try {
      body = JSON.parse(config.data)
    } catch {
      body = config.data
    }
  }

  const response = await makeSortedRequest({ method, url: fullUrl, body })

  // For successful responses, return in axios's expected shape so its default
  // validateStatus doesn't reject. For error responses, makeRequest throws an
  // AxiosError directly (see mockRequest below).
  return {
    data: response.data,
    status: response.status,
    statusText: "OK",
    headers: {},
    config,
    request: {},
  }
}

/**
 * Jest's `expect.anything()` does not match against `null` or `undefined`.
 * This suffices for usage with `when`.
 */
const expectAnythingOrNil = expect.toBeOneOf([
  expect.anything(),
  expect.toBeNil(),
])

const mockRequest = <T, U>(
  method: Method,
  // Callers may pass a literal URL string or a jest asymmetric matcher
  // (e.g. `expect.stringContaining("/api/v1/foo")`) to match URLs loosely.
  url: string | jest.AsymmetricMatcher,
  requestBody: T = expectAnythingOrNil,
  responseBody: U | ((req: T) => U) | undefined = undefined,
  code: number,
) => {
  const urlMatcher = typeof url === "string" ? standardizeUrl(url) : url
  // jest-when's `calledWith` types its arg strictly, but at runtime it
  // accepts asymmetric matchers (e.g. `expect.stringContaining(...)`) in any
  // field. Cast through `unknown` so we can pass a matcher in `url` or
  // `requestBody` while keeping the public signature accurate.
  when(makeRequest)
    .calledWith({
      method,
      url: urlMatcher,
      body: requestBody,
    } as unknown as RequestArgs)
    .mockImplementation(async () => {
      let data
      if (isFunction(responseBody)) {
        data = await responseBody(requestBody)
      } else {
        data = await responseBody
      }
      const response = { data, status: code }
      if (code >= 400) {
        throw new AxiosError(
          "Mock Error",
          String(code),
          undefined,
          undefined,
          response as AxiosResponse,
        )
      }
      return response
    })
}

interface MockResponseOptions {
  /**
   * Only match requests with this request body.
   * By default, matches anything, including null and undefined.
   *
   * @notes
   * accepts Jest matches, e.g., `expect.objectContaining({ some: 'prop' })`
   */
  requestBody?: unknown
  code?: number
}

/**
 * A URL or a jest asymmetric matcher (e.g. `expect.stringContaining(...)`)
 * used to match request URLs in `setMockResponse.*`.
 */
type UrlMatcher = string | jest.AsymmetricMatcher

const setMockResponse = {
  /**
   * Set mock response for a GET request; default response status is 200.
   *
   * If `responseBody` is a Promise, the request will resolve to the value of
   * `responseBody` when `responseBody` resolves.
   */
  get: (
    url: UrlMatcher,
    responseBody: unknown,
    { code = 200, requestBody }: MockResponseOptions = {},
  ) => mockRequest("get", url, requestBody, responseBody, code),
  /**
   * Set mock response for a POST request; default response status is 201.
   *
   * If `responseBody` is a Promise, the request will resolve to the value of
   * `responseBody` when `responseBody` resolves.
   */
  post: (
    url: UrlMatcher,
    responseBody?: unknown,
    { code = 201, requestBody }: MockResponseOptions = {},
  ) => mockRequest("post", url, requestBody, responseBody, code),
  /**
   * Set mock response for a PUT request; default response status is 200.
   *
   * If `responseBody` is a Promise, the request will resolve to the value of
   * `responseBody` when `responseBody` resolves.
   */
  put: (
    url: UrlMatcher,
    responseBody?: unknown,
    { code = 200, requestBody }: MockResponseOptions = {},
  ) => mockRequest("put", url, requestBody, responseBody, code),
  /**
   * Set mock response for a PATCH request; default response status is 200.
   *
   * If `responseBody` is a Promise, the request will resolve to the value of
   * `responseBody` when `responseBody` resolves.
   */
  patch: (
    url: UrlMatcher,
    responseBody?: unknown,
    { code = 200, requestBody }: MockResponseOptions = {},
  ) => mockRequest("patch", url, requestBody, responseBody, code),
  /**
   * Set mock response for a DELETE request; default response status is 204.
   *
   * If `responseBody` is a Promise, the request will resolve to the value of
   * `responseBody` when `responseBody` resolves.
   */
  delete: (
    url: UrlMatcher,
    responseBody?: unknown,
    { code = 204, requestBody }: MockResponseOptions = {},
  ) => mockRequest("delete", url, requestBody, responseBody, code),
  /**
   * Set a custom fallback implementation when no responses have been specified.
   *
   * If no custom fallback is specified, unmocked responses will result in an
   * error.
   */
  defaultImplementation: when(makeRequest).defaultImplementation,
}

/**
 * Mock factory for `jest.mock("axios", mockAxiosFactory)`. Routes ALL requests
 * through the mock adapter — both the default export (`axios.get(...)`) and
 * instances returned by `axios.create()` (even if the caller passed an
 * explicit adapter in config). Tests never reach a real network adapter.
 *
 * Must be passed via `jest.mock("axios", …)` at the TOP LEVEL of a
 * setupFilesAfterEnv module (i.e. setupJest), so @swc/jest's babel transform
 * hoists the registration above all imports — including the test file's
 * imports. Without hoisting, modules that import axios at module load (e.g.
 * frontends/api/src/axios.ts) would call `axios.create()` before the factory
 * could install the wrap.
 *
 * The name begins with `mock` so jest's hoist-protection rule allows the
 * factory to be referenced from the outer scope of the setup file.
 */
const mockAxiosFactory = () => {
  const real = jest.requireActual<typeof import("axios")>("axios")

  // Layer 1: route the default export through the mock adapter. Caught:
  // `axios.get(...)`, `axios.request(...)` on the default export, and any
  // instance that inherits the default adapter via `axios.create()`.
  real.default.defaults.adapter = mockAdapter

  // Layer 2: force the mock adapter onto every `axios.create()` instance,
  // overriding any explicit adapter passed in config. Belt-and-suspenders
  // for layer 1.
  const originalCreate = real.default.create.bind(real.default)
  real.default.create = (config?: AxiosRequestConfig) => {
    const instance = originalCreate(config)
    instance.defaults.adapter = mockAdapter
    return instance
  }

  return real
}

/**
 * Fail-loud assertion: confirms the mock adapter is still installed on real
 * axios. Call from `beforeEach` in test setup so that if a future change ever
 * unhooks the adapter, tests scream rather than silently start hitting the
 * network.
 *
 * Uses `jest.requireMock` to ensure the mock factory has run (lazy factories
 * only execute on first axios import; test files that never touch axios would
 * otherwise see the un-mutated module). `requireMock` returns the mocked
 * module, which is the same real-axios object the factory mutates.
 *
 * Checks both install layers: the default-export adapter (layer 1) and a
 * freshly-created instance (layer 2). Either layer regressing alone would let
 * some axios usage slip through.
 */
const assertMockAdapterInstalled = () => {
  const axios = jest.requireMock<typeof import("axios")>("axios").default
  // Layer 1: default adapter on the module-level export.
  expect(axios.defaults.adapter).toBe(mockAdapter)
  // Layer 2: create()-time override. Pass an explicit `adapter` in config so
  // we exercise the override path — not the merge-from-defaults fallback,
  // which would silently succeed via Layer 1 even if the create wrapper is
  // missing.
  const stubAdapter: AxiosAdapter = async () => {
    throw new Error("stub")
  }
  expect(axios.create({ adapter: stubAdapter }).defaults.adapter).toBe(
    mockAdapter,
  )
}

export {
  setMockResponse,
  makeRequest,
  mockAdapter,
  mockAxiosFactory,
  assertMockAdapterInstalled,
}
export type { RequestArgs }
