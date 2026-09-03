import { factories, makeRequest, setMockResponse, urls } from "api/test-utils"
import { ChannelTypeEnum } from "api/v0"
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

const setupChannel = () => {
  const channel = factories.channels.channel({
    channel_type: ChannelTypeEnum.Topic,
    search_filter: "topic=Economics",
  })
  setMockResponse.get(
    urls.channels.details(channel.channel_type, channel.name),
    channel,
  )
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
  return channel
}

const calledWith = (base: string) =>
  makeRequest.mock.calls.some(([args]) => args.url.startsWith(base))

test("prefetches vector results by default", async () => {
  const channel = setupChannel()

  await Page({
    params: Promise.resolve({
      channelType: channel.channel_type,
      name: channel.name,
    }),
    searchParams: Promise.resolve({ q: "test" }),
  })

  expect(calledWith(urls.search.vectorResources())).toBe(true)
  expect(calledWith(urls.search.resources())).toBe(false)
})

test("keeps the channel's constant search params in the vector prefetch", async () => {
  const channel = setupChannel()

  await Page({
    params: Promise.resolve({
      channelType: channel.channel_type,
      name: channel.name,
    }),
    searchParams: Promise.resolve({ q: "test" }),
  })

  const vectorCall = makeRequest.mock.calls.find(([args]) =>
    args.url.startsWith(urls.search.vectorResources()),
  )
  const searchParams = new URL(vectorCall?.[0].url ?? "").searchParams
  expect(searchParams.get("hybrid_search")).toBe("true")
  expect(searchParams.get("q")).toBe("test")
  // The channel's own filter must survive; user-selected facets are applied
  // client-side for text queries.
  expect(searchParams.get("topic")).toBe("Economics")
})

test("prefetches OpenSearch results when vector_search is disabled", async () => {
  const channel = setupChannel()

  await Page({
    params: Promise.resolve({
      channelType: channel.channel_type,
      name: channel.name,
    }),
    searchParams: Promise.resolve({ q: "test", vector_search: "false" }),
  })

  expect(calledWith(urls.search.resources())).toBe(true)
  expect(calledWith(urls.search.vectorResources())).toBe(false)
})
