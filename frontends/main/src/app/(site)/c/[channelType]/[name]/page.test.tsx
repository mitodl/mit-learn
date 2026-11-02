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

const setupChannel = (channelType: ChannelTypeEnum = ChannelTypeEnum.Topic) => {
  const channel = factories.channels.channel({
    channel_type: channelType,
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
  /* A topic page prefetches its Featured row, the hero being drawn
     differently where there is none to carry. */
  setMockResponse.get(
    expect.stringContaining(
      urls.channels.featured(channel.channel_type, channel.name),
    ),
    { count: 0, next: null, previous: null, results: [] },
  )
  return channel
}

const calledWith = (base: string) =>
  makeRequest.mock.calls.some(([args]) => args.url.startsWith(base))

afterEach(() => {
  delete process.env.NEXT_PUBLIC_DISABLE_HYBRID_SEARCH
})

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

test("prefetches OpenSearch results when the env kill switch is set", async () => {
  // Server components cannot read PostHog flags. Without this env var the
  // prefetch would fetch a hybrid query that the client discards and refetches
  // from OpenSearch on hydration.
  process.env.NEXT_PUBLIC_DISABLE_HYBRID_SEARCH = "true"
  const channel = setupChannel()

  await Page({
    params: Promise.resolve({
      channelType: channel.channel_type,
      name: channel.name,
    }),
    searchParams: Promise.resolve({ q: "test" }),
  })

  expect(calledWith(urls.search.resources())).toBe(true)
  expect(calledWith(urls.search.vectorResources())).toBe(false)
})

/** The resource_type_group values of each vector search prefetched. */
const prefetchedGroups = () =>
  makeRequest.mock.calls
    .filter(([args]) => args.url.startsWith(urls.search.vectorResources()))
    .map(([args]) =>
      new URL(args.url, "http://mit.edu").searchParams.getAll(
        "resource_type_group",
      ),
    )

test("a bare topic URL also prefetches the redesign's courses and programs", async () => {
  // Which page the client draws is a PostHog flag the server cannot read, so
  // both searches are prefetched and either one hydrates.
  const channel = setupChannel()

  await Page({
    params: Promise.resolve({
      channelType: channel.channel_type,
      name: channel.name,
    }),
    searchParams: Promise.resolve({}),
  })

  expect(prefetchedGroups()).toEqual(
    expect.arrayContaining([[], ["course", "program"]]),
  )
  expect(prefetchedGroups()).toHaveLength(2)
})

test("a bare department URL prefetches the same two searches", async () => {
  // The redesigned department page draws the same tabs as a topic, so it
  // opens on the same groups -- and a type left out of the server's guard is
  // a page that discards what was prefetched for it and asks again.
  const channel = setupChannel(ChannelTypeEnum.Department)

  await Page({
    params: Promise.resolve({
      channelType: channel.channel_type,
      name: channel.name,
    }),
    searchParams: Promise.resolve({}),
  })

  expect(prefetchedGroups()).toEqual(
    expect.arrayContaining([[], ["course", "program"]]),
  )
  expect(prefetchedGroups()).toHaveLength(2)
})

test("a topic URL naming its groups prefetches only those", async () => {
  const channel = setupChannel()

  await Page({
    params: Promise.resolve({
      channelType: channel.channel_type,
      name: channel.name,
    }),
    searchParams: Promise.resolve({ resource_type_group: "learning_material" }),
  })

  expect(prefetchedGroups()).toEqual([["learning_material"]])
})

test("a department prefetches its own featured row", async () => {
  const channel = setupChannel(ChannelTypeEnum.Department)

  await Page({
    params: Promise.resolve({
      channelType: channel.channel_type,
      name: channel.name,
    }),
    searchParams: Promise.resolve({}),
  })

  expect(
    calledWith(urls.channels.featured(channel.channel_type, channel.name)),
  ).toBe(true)
})

test("other channels prefetch only the unfiltered search", async () => {
  /* A pathway: the department has joined the redesign above, and a unit
     prefetches a featured row of its own. */
  const channel = setupChannel(ChannelTypeEnum.Pathway)

  await Page({
    params: Promise.resolve({
      channelType: channel.channel_type,
      name: channel.name,
    }),
    searchParams: Promise.resolve({}),
  })

  expect(prefetchedGroups()).toEqual([[]])
})
