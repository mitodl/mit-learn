import { factories, makeRequest, setMockResponse, urls } from "api/test-utils"
import Page from "./page"

jest.mock("@/app/getQueryClient", () => {
  const { makeBrowserQueryClient } = jest.requireActual("@/app/getQueryClient")
  return { getQueryClient: () => makeBrowserQueryClient({ maxRetries: 0 }) }
})

const SEARCH_RESPONSE = {
  count: 0,
  next: null,
  previous: null,
  results: [],
  metadata: {
    aggregations: {},
    suggestions: [],
  },
}

beforeEach(() => {
  setMockResponse.get(
    urls.offerors.list(),
    factories.learningResources.offerors({ count: 0 }),
  )
  setMockResponse.get(expect.stringContaining(urls.search.resources()), {
    ...SEARCH_RESPONSE,
  })
  setMockResponse.get(expect.stringContaining(urls.search.vectorResources()), {
    ...SEARCH_RESPONSE,
  })
})

test("prefetches vector results by default", async () => {
  await Page({
    params: Promise.resolve({}),
    searchParams: Promise.resolve({ q: "test" }),
  })

  expect(
    makeRequest.mock.calls.some(([args]) =>
      args.url.startsWith(urls.search.vectorResources()),
    ),
  ).toBe(true)
  expect(
    makeRequest.mock.calls.some(([args]) =>
      args.url.startsWith(urls.search.resources()),
    ),
  ).toBe(false)
})

test("prefetches OpenSearch results when vector_search is disabled", async () => {
  // Server components cannot read PostHog flags, so `vector_search=false` is
  // the only way to prefetch the OpenSearch fallback.
  await Page({
    params: Promise.resolve({}),
    searchParams: Promise.resolve({ q: "test", vector_search: "false" }),
  })

  expect(
    makeRequest.mock.calls.some(([args]) =>
      args.url.startsWith(urls.search.resources()),
    ),
  ).toBe(true)
  expect(
    makeRequest.mock.calls.some(([args]) =>
      args.url.startsWith(urls.search.vectorResources()),
    ),
  ).toBe(false)
})

test("prefetches vector results when vector_search is enabled", async () => {
  await Page({
    params: Promise.resolve({}),
    searchParams: Promise.resolve({
      q: "test",
      vector_search: "true",
      topic: "Physics",
    }),
  })

  const vectorCall = makeRequest.mock.calls.find(([args]) =>
    args.url.startsWith(urls.search.vectorResources()),
  )
  expect(vectorCall).toBeDefined()
  expect(
    makeRequest.mock.calls.some(([args]) =>
      args.url.startsWith(urls.search.resources()),
    ),
  ).toBe(false)

  const searchParams = new URL(vectorCall?.[0].url ?? "").searchParams
  expect(searchParams.get("hybrid_search")).toBe("true")
  expect(searchParams.get("q")).toBe("test")
  expect(searchParams.has("topic")).toBe(false)
  expect(searchParams.has("limit")).toBe(false)
  expect(searchParams.has("offset")).toBe(false)
})
