import React from "react"
import { urls, factories, makeRequest } from "api/test-utils"
import { ChannelTypeEnum, type Channel } from "api/v0"
import type { LearningResourcesSearchResponse } from "api"
import {
  screen,
  setMockResponse,
  waitFor,
  renderWithProviders,
} from "@/test-utils"
import ChannelSearch from "./ChannelSearch"
import { assertHeadings, getByImageSrc } from "ol-test-utilities"
import invariant from "tiny-invariant"
import ChannelPage from "./ChannelPage"

jest.mock("./ChannelSearch", () => {
  const actual = jest.requireActual("./ChannelSearch")
  return {
    __esModule: true,
    default: jest.fn(actual.default),
  }
})
const mockedChannelSearch = jest.mocked(ChannelSearch)

const someAncestor = (el: HTMLElement, cb: (el: HTMLElement) => boolean) => {
  let ancestor = el.parentElement
  while (ancestor) {
    if (cb(ancestor)) return true
    ancestor = ancestor.parentElement
  }
  return false
}

const setupApis = (
  channelPatch?: Partial<Channel>,
  search?: Partial<LearningResourcesSearchResponse>,
  { isSubscribed = false, isAuthenticated = false } = {},
) => {
  const channel = factories.channels.channel(channelPatch)
  setMockResponse.get(urls.userMe.get(), {
    is_authenticated: isAuthenticated,
  })
  setMockResponse.get(
    urls.channels.details(channel.channel_type, channel.name),
    channel,
  )
  setMockResponse.get(
    expect.stringContaining(urls.learningResources.featured()),
    factories.learningResources.resources({ count: 10 }),
  )

  const urlParams = new URLSearchParams(channelPatch?.search_filter)
  const subscribeParams: Record<string, string[] | string> = {}
  for (const [key, value] of urlParams.entries()) {
    if (
      subscribeParams[key] !== undefined &&
      Array.isArray(subscribeParams[key])
    ) {
      subscribeParams[key] = [...subscribeParams[key], value]
    } else {
      subscribeParams[key] = [value]
    }
  }
  subscribeParams["source_type"] = "channel_subscription_type"
  const subscribeResponse = isSubscribed
    ? factories.percolateQueries.percolateQueryList({ count: 1 }).results
    : factories.percolateQueries.percolateQueryList({ count: 0 }).results
  if (channelPatch?.search_filter) {
    setMockResponse.get(
      `${urls.userSubscription.check(subscribeParams)}`,
      subscribeResponse,
    )
  }

  setMockResponse.get(
    `${urls.userSubscription.check({
      source_type: "channel_subscription_type",
    })}`,
    subscribeResponse,
  )

  setMockResponse.get(
    urls.platforms.list(),
    factories.learningResources.platforms({ count: 5 }),
  )

  setMockResponse.get(
    urls.offerors.list(),
    factories.learningResources.offerors({ count: 5 }),
  )

  setMockResponse.get(expect.stringContaining(urls.search.resources()), {
    count: 0,
    next: null,
    previous: null,
    results: [],
    metadata: {
      aggregations: {},
      suggestions: [],
    },
    ...search,
  })

  setMockResponse.get(expect.stringContaining(urls.testimonials.list({})), {
    results: [],
  })

  if (
    channel.channel_type === ChannelTypeEnum.Topic &&
    channel.topic_detail.topic
  ) {
    const subTopics = factories.learningResources.topics({ count: 5 })
    setMockResponse.get(
      urls.topics.list({ parent_topic_id: [channel.topic_detail.topic] }),
      subTopics,
    )
    return {
      channel,
      subTopics,
    }
  }

  return {
    channel,
  }
}

const ALL_CHANNEL_TYPES = Object.values(ChannelTypeEnum).map((v) => ({
  channelType: v,
}))
const NON_UNIT_CHANNEL_TYPES = Object.values(ChannelTypeEnum)
  .filter((v) => v !== ChannelTypeEnum.Unit)
  .map((v) => ({ channelType: v }))

describe.each(ALL_CHANNEL_TYPES)(
  "ChannelPage, common behavior",
  ({ channelType }) => {
    it("Displays the channel search if search_filter is not undefined", async () => {
      const { channel } = setupApis({
        search_filter:
          "platform=ocw&platform=mitxonline&department=8&department=9",
        channel_type: channelType,
      })
      renderWithProviders(<ChannelPage />, {
        url: `/c/${channel.channel_type}/${channel.name}`,
      })
      await screen.findAllByText(channel.title)
      const expectedProps = expect.objectContaining({
        constantSearchParams: {
          platform: ["ocw", "mitxonline"],
          department: ["8", "9"],
        },
      })
      const expectedContext = expect.anything()

      expect(mockedChannelSearch).toHaveBeenLastCalledWith(
        expectedProps,
        expectedContext,
      )
    })
    it("Does not display the channel search if search_filter is undefined", async () => {
      const { channel } = setupApis({
        channel_type: channelType,
      })
      channel.search_filter = undefined
      renderWithProviders(<ChannelPage />, {
        url: `/c/${channel.channel_type}/${channel.name}`,
      })
      await screen.findAllByText(channel.title)

      expect(mockedChannelSearch).toHaveBeenCalledTimes(0)
    })

    it("Includes heading and subheading in banner", async () => {
      const { channel } = setupApis({
        channel_type: channelType,
      })
      channel.search_filter = undefined
      renderWithProviders(<ChannelPage />, {
        url: `/c/${channel.channel_type}/${channel.name}`,
      })
      await screen.findAllByText(channel.title)

      await waitFor(() => {
        screen.getAllByText(channel.configuration.sub_heading).forEach((el) => {
          expect(el).toBeInTheDocument()
        })
      })
      await waitFor(() => {
        screen.getAllByText(channel.configuration.heading).forEach((el) => {
          expect(el).toBeInTheDocument()
        })
      })
    })

    it.each([{ isSubscribed: false }, { isSubscribed: true }])(
      "Displays the subscribe toggle for authenticated and unauthenticated users",
      async ({ isSubscribed }) => {
        const { channel } = setupApis(
          { search_filter: "q=ocw", channel_type: channelType },
          {},
          { isSubscribed },
        )
        renderWithProviders(<ChannelPage />, {
          url: `/c/${channel.channel_type}/${channel.name}`,
        })
        const subscribedButton = await screen.findByText("Follow")
        expect(subscribedButton).toBeVisible()
      },
    )
  },
)

describe.each(NON_UNIT_CHANNEL_TYPES)(
  "ChannelPage, common non-unit ($channelType)",
  ({ channelType }) => {
    it("Does not display a featured carousel if the channel type is not 'unit'", async () => {
      const { channel } = setupApis({
        search_filter: "topic=physics",
        channel_type: channelType,
      })

      renderWithProviders(<ChannelPage />, {
        url: `/c/${channel.channel_type}/${channel.name}`,
      })
      await screen.findAllByText(channel.title)
      const carousels = screen.queryByText("Featured Courses")
      expect(carousels).toBe(null)
    })

    it("Displays the title, background, and avatar (channelType: %s)", async () => {
      const { channel } = setupApis({
        search_filter: "offered_by=ocw",
        channel_type: channelType,
      })

      const { view } = renderWithProviders(<ChannelPage />, {
        url: `/c/${channel.channel_type}/${channel.name}`,
      })
      const title = await screen.findByRole("heading", { name: channel.title })
      // Banner background image
      expect(
        someAncestor(title, (el) =>
          window
            .getComputedStyle(el)
            .backgroundImage.includes(channel.configuration.banner_background),
        ),
      ).toBe(true)
      // logo
      getByImageSrc(
        view.container,
        `${window.origin}${channel.configuration.logo}`,
      )
    })

    test("headings", async () => {
      const { channel } = setupApis({
        search_filter: "topic=Physics",
        channel_type: channelType,
      })
      renderWithProviders(<ChannelPage />, {
        url: `/c/${channel.channel_type}/${channel.name}`,
      })

      await waitFor(() => {
        assertHeadings([
          { level: 1, name: channel.title },
          { level: 2, name: `Search within ${channel.title}` },
          { level: 3, name: "Filter" },
          { level: 3, name: "Search Results" },
        ])
      })
    })
  },
)

describe("Channel Pages, Topic only", () => {
  test("Subtopics display", async () => {
    const { channel, subTopics } = setupApis({
      search_filter: "topic=Physics",
      channel_type: ChannelTypeEnum.Topic,
    })
    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}`,
    })

    invariant(subTopics)
    const links = await screen.findAllByRole("link", {
      // name arg can be string, regex, or function
      name: (name) => subTopics?.results.map((t) => t.name).includes(name),
    })
    links.forEach((link, i) => {
      expect(link).toHaveAttribute(
        "href",
        new URL(subTopics.results[i].channel_url!).pathname,
      )
    })
  })
})

describe("Channel Pages, Unit only", () => {
  it("Displays the channel title, banner, and avatar", async () => {
    const { channel } = setupApis({
      search_filter: "offered_by=ocw",
      channel_type: "unit",
    })
    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}`,
    })

    const title = await screen.findByRole("heading", { name: channel.title })
    getByImageSrc(title, `${window.origin}${channel.configuration.logo}`)
  })
  it("Displays a featured carousel if the channel type is 'unit'", async () => {
    const { channel } = setupApis({
      search_filter: "offered_by=ocw",
      channel_type: "unit",
    })

    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}`,
    })
    await screen.findAllByText(channel.title)
    const carousel = await screen.findByText("Featured Courses")
    expect(carousel).toBeInTheDocument()

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        "get",
        urls.learningResources.featured({ limit: 12, offered_by: ["ocw"] }),
        undefined,
      )
    })

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        "get",
        urls.learningResources.featured({ limit: 12 }),
        undefined,
      )
    })
  })

  test("headings", async () => {
    const { channel } = setupApis({
      search_filter: "offered_by=ocw",
      channel_type: "unit",
    })
    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}`,
    })

    await waitFor(() => {
      assertHeadings([
        { level: 1, name: channel.title },
        { level: 2, name: "Featured Courses" },
        { level: 2, name: "What Learners Say" },
        { level: 2, name: `Search within ${channel.title}` },
        { level: 3, name: "Filter" },
        { level: 3, name: "Search Results" },
      ])
    })
  })
})