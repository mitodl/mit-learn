import React from "react"
import {
  screen,
  within,
  waitFor,
  renderWithProviders,
  user,
} from "@/test-utils"
import { setMockResponse, urls, factories, makeRequest } from "api/test-utils"
import type {
  LearningResourcesSearchResponse,
  PaginatedLearningResourceOfferorDetailList,
} from "api"
import invariant from "tiny-invariant"
import type { Channel } from "api/v0"
import { ChannelTypeEnum } from "api/v0"
import ChannelPage from "./ChannelPage"
import { useFeatureFlagEnabled, usePostHog } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { PostHogEvents } from "@/common/constants"

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  useFeatureFlagEnabled: jest.fn(),
  usePostHog: jest.fn(),
}))

const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)

const mockCapture = jest.fn()
jest.mocked(usePostHog).mockReturnValue(
  // @ts-expect-error Not mocking all of posthog
  { capture: mockCapture },
)

/**
 * Mock the named flags, leaving every other flag `undefined`—PostHog's value
 * for "not loaded / not set".
 */
const mockFeatureFlags = (flags: Partial<Record<FeatureFlags, boolean>>) => {
  mockedUseFeatureFlagEnabled.mockImplementation(
    (flag) => flags[flag as FeatureFlags],
  )
}

// jest clears calls between tests but not implementations, so reset flags to
// "not set" so a kill-switch test cannot leak into the next test.
beforeEach(() => {
  mockFeatureFlags({})
})

const setMockApiResponses = ({
  search,
  channelPatch = {},
  offerors,
}: {
  search?: Partial<LearningResourcesSearchResponse>
  channelPatch?: Partial<Channel>
  offerors?: PaginatedLearningResourceOfferorDetailList
}) => {
  const channel = factories.channels.channel(channelPatch)
  const urlParams = new URLSearchParams(channelPatch?.search_filter)
  const subscribeParams: Record<string, string[] | string> = {}
  for (const [key, value] of urlParams.entries()) {
    subscribeParams[key] = value.split(",")
  }
  subscribeParams["source_type"] = "channel_subscription_type"
  if (channelPatch?.search_filter) {
    setMockResponse.get(
      `${urls.userSubscription.check(subscribeParams)}`,
      factories.percolateQueries,
    )
  }
  setMockResponse.get(
    urls.learningResources.featured({ limit: 12, offered_by: ["ocw"] }),
    factories.learningResources.resources({ count: 0 }),
  )
  setMockResponse.get(
    urls.learningResources.featured({ limit: 12 }),
    factories.learningResources.resources({ count: 0 }),
  )

  setMockResponse.get(
    urls.userSubscription.check({ source_type: "channel_subscription_type" }),
    factories.percolateQueries,
  )
  setMockResponse.get(
    urls.channels.details(channel.channel_type, channel.name),
    channel,
  )

  // A topic hero carries a Featured row, which reads the channel's own list.
  setMockResponse.get(
    expect.stringContaining(
      urls.channels.featured(channel.channel_type, channel.name),
    ),
    { count: 0, next: null, previous: null, results: [] },
  )

  setMockResponse.get(
    urls.platforms.list(),
    factories.learningResources.platforms({ count: 5 }),
  )

  setMockResponse.get(
    urls.offerors.list(),
    offerors ?? factories.learningResources.offerors({ count: 5 }),
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
  setMockResponse.get(expect.stringContaining(urls.search.vectorResources()), {
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

  setMockResponse.get(urls.userMe.get(), { is_authenticated: true })
  setMockResponse.get(urls.userLists.membershipList(), [])
  setMockResponse.get(urls.learningPaths.membershipList(), [])

  if (channel.channel_type === ChannelTypeEnum.Topic) {
    const topicId = channel.topic_detail.topic
    if (topicId) {
      setMockResponse.get(urls.topics.get(topicId), null)
      setMockResponse.get(
        urls.topics.list({ parent_topic_id: [topicId] }),
        null,
      )
    }
  }

  return {
    channel,
  }
}

const getLastApiSearchParams = () => {
  const call = makeRequest.mock.calls.find(([args]) => {
    if (args.method !== "get") return false
    return (
      args.url.startsWith(urls.search.resources()) ||
      args.url.startsWith(urls.search.vectorResources())
    )
  })
  invariant(call)
  const fullUrl = new URL(call[0].url, "http://mit.edu")
  return fullUrl.searchParams
}

describe("ChannelSearch", () => {
  test("Renders search results", async () => {
    const resources = factories.learningResources.resources({
      count: 10,
    }).results
    const { channel } = setMockApiResponses({
      search: {
        count: 1000,
        metadata: {
          aggregations: {
            resource_type: [
              { key: "course", doc_count: 100 },
              { key: "podcast", doc_count: 200 },
              { key: "program", doc_count: 300 },
              { key: "irrelevant", doc_count: 400 },
            ],
          },
          suggestions: [],
        },
        results: resources,
      },
    })

    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}`,
    })
    await screen.findAllByText(channel.title)
    const tabpanel = await screen.findByRole("tabpanel")
    for (const resource of resources) {
      await within(tabpanel).findByText(resource.title)
    }
  }, 10000)

  test("Topic channel pages load hybrid search", async () => {
    const { channel } = setMockApiResponses({
      channelPatch: { channel_type: ChannelTypeEnum.Topic },
    })

    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}`,
    })

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "get",
          url: expect.stringContaining(urls.search.vectorResources()),
        }),
      )
    })

    const apiSearchParams = getLastApiSearchParams()
    expect(apiSearchParams.get("hybrid_search")).toBe("true")
  })

  test.each([
    ChannelTypeEnum.Topic,
    ChannelTypeEnum.Department,
    ChannelTypeEnum.Unit,
    ChannelTypeEnum.Pathway,
  ])("%s channel pages load hybrid search by default", async (channelType) => {
    mockFeatureFlags({})
    const { channel } = setMockApiResponses({
      channelPatch: { channel_type: channelType },
    })

    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}`,
    })

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "get",
          url: expect.stringContaining(urls.search.vectorResources()),
        }),
      )
    })
    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({
        method: "get",
        url: expect.stringContaining(urls.search.resources()),
      }),
    )
  })

  test("Channel pages fall back to OpenSearch when disable-hybrid-search is enabled", async () => {
    mockFeatureFlags({ [FeatureFlags.DisableHybridSearch]: true })
    const { channel } = setMockApiResponses({
      channelPatch: { channel_type: ChannelTypeEnum.Topic },
    })

    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}`,
    })

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "get",
          url: expect.stringContaining(urls.search.resources()),
        }),
      )
    })
    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({
        method: "get",
        url: expect.stringContaining(urls.search.vectorResources()),
      }),
    )
  })

  test("Topic channel page with search term preserves constant search parameters in API request", async () => {
    const { channel } = setMockApiResponses({
      channelPatch: {
        channel_type: ChannelTypeEnum.Topic,
        search_filter: "topic=Economics",
      },
    })

    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}?q=python`,
    })

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "get",
          url: expect.stringContaining(urls.search.vectorResources()),
        }),
      )
    })

    const apiSearchParams = getLastApiSearchParams()
    expect(apiSearchParams.get("q")).toBe("python")
    expect(apiSearchParams.get("topic")).toBe("Economics")
  })

  test("Hybrid search 'Offered By' facet only shows facets with 'display_facet' set to true", async () => {
    const offerors = factories.learningResources.offerors({ count: 3 })
    offerors.results[0]!.display_facet = true
    offerors.results[1]!.display_facet = false
    offerors.results[2]!.display_facet = false

    const resources = factories.learningResources.resources({
      count: 3,
    }).results
    resources.forEach((resource, i) => {
      resource.professional = true
      resource.offered_by = {
        code: offerors.results[i]!.code,
        name: offerors.results[i]!.name,
        channel_url: null,
      }
    })

    const { channel } = setMockApiResponses({
      /* Department, not Topic: "Offered By" is a sidebar facet, and the topic
         design has no sidebar -- its bar offers Format, Certificate and Free
         only. Department still renders the facet this asserts. */
      channelPatch: { channel_type: ChannelTypeEnum.Department },
      offerors,
      search: {
        count: resources.length,
        results: resources,
        metadata: {
          aggregations: {
            offered_by: offerors.results.map((o, i) => ({
              key: o.code,
              doc_count: 10 + i,
            })),
          },
          suggestions: [],
        },
      },
    })

    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}?q=python&professional=true`,
    })

    const showFacetButton = await screen.findByRole("button", {
      name: /Offered By/i,
    })
    await user.click(showFacetButton)

    const offeror0 = await screen.findByRole("checkbox", {
      name: new RegExp(`^${offerors.results[0]!.name}`),
    })
    expect(offeror0).toBeVisible()
    expect(
      screen.queryByRole("checkbox", {
        name: new RegExp(`^${offerors.results[1]!.name}`),
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("checkbox", {
        name: new RegExp(`^${offerors.results[2]!.name}`),
      }),
    ).not.toBeInTheDocument()
  })

  test.each([
    {
      searchFilter: "offered_by=ocw",
      url: "?topic=physics",
      expected: { offered_by: "ocw", topic: "physics" },
    },
    {
      searchFilter: "offered_by=ocw",
      url: "?offered_by=xpro&topic=physics",
      expected: { offered_by: "xpro", topic: "physics" },
    },
    {
      searchFilter: "offered_by=ocw",
      url: "?offered_by=xpro&topic=physics",
      expected: { offered_by: "xpro", topic: "physics" },
    },
  ])(
    "Filters by combined parameters from the search_filter and the url",
    async ({ searchFilter, url, expected }) => {
      const { channel } = setMockApiResponses({
        channelPatch: { search_filter: searchFilter },
        search: {
          count: 700,
          metadata: {
            aggregations: {
              topic: [
                { key: "physics", doc_count: 100 },
                { key: "chemistry", doc_count: 200 },
              ],
              department: [{ key: "1", doc_count: 100 }],
              level: [{ key: "graduate", doc_count: 100 }],
              resource_type: [{ key: "course", doc_count: 100 }],
              platform: [{ key: "ocw", doc_count: 100 }],
              offered_by: [{ key: "ocw", doc_count: 100 }],
            },
            suggestions: [],
          },
        },
      })

      renderWithProviders(<ChannelPage />, {
        url: `/c/${channel.channel_type}/${channel.name}/${url}`,
      })

      await waitFor(() => {
        expect(makeRequest.mock.calls.length > 0).toBe(true)
      })
      const apiSearchParams = getLastApiSearchParams()
      expect(Object.fromEntries(apiSearchParams.entries())).toEqual(
        expect.objectContaining(expected),
      )
    },
  )

  test.each([
    {
      channelType: ChannelTypeEnum.Department,
      displayedFacets: ["Certificate", "Offered By", "Topic", "Format"],
    },
    {
      channelType: ChannelTypeEnum.Unit,
      displayedFacets: ["Certificate", "Department", "Topic", "Format"],
    },
    {
      channelType: ChannelTypeEnum.Pathway,
      displayedFacets: [],
    },
  ])(
    "Displays the correct facets for the channelType",
    async ({ channelType, displayedFacets }) => {
      const { channel } = setMockApiResponses({
        channelPatch: { channel_type: channelType },
        search: {
          count: 700,
          metadata: {
            aggregations: {
              topic: [
                { key: "physics", doc_count: 100 },
                { key: "chemistry", doc_count: 200 },
              ],
              department: [{ key: "1", doc_count: 100 }],
              level: [{ key: "graduate", doc_count: 100 }],
              resource_type: [{ key: "course", doc_count: 100 }],
              platform: [{ key: "ocw", doc_count: 100 }],
              offered_by: [{ key: "ocw", doc_count: 100 }],
              certification: [{ key: "true", doc_count: 100 }],
              delivery: [{ key: "online", doc_count: 100 }],
              certification_type: [{ key: "micromasters", doc_count: 100 }],
            },
            suggestions: [],
          },
        },
      })

      renderWithProviders(<ChannelPage />, {
        url: `/c/${channel.channel_type}/${channel.name}/`,
      })

      await waitFor(() => {
        expect(makeRequest.mock.calls.length > 0).toBe(true)
      })

      const facetsContainer = screen.getByTestId("facets-container")

      for (const facetName of [
        "Professional",
        "Certificate",
        "Department",
        "Offered By",
        "Topic",
        "Format",
      ]) {
        if ((displayedFacets as string[]).includes(facetName as string)) {
          await within(facetsContainer).findByText(facetName)
        } else {
          expect(within(facetsContainer).queryByText(facetName)).toBeNull()
        }
      }
    },
  )

  test("Shows and aggregates a facet that is in the URL but not shown by default", async () => {
    const { channel } = setMockApiResponses({
      channelPatch: { channel_type: ChannelTypeEnum.Unit },
      search: {
        count: 700,
        metadata: {
          aggregations: {
            level: [{ key: "graduate", doc_count: 100 }],
          },
          suggestions: [],
        },
      },
    })

    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}/?level=graduate`,
    })

    await waitFor(() => {
      expect(makeRequest.mock.calls.length > 0).toBe(true)
    })

    // "level" is not a default facet for this channel type, but it is requested
    // as an aggregation because it is present in the URL.
    const apiSearchParams = getLastApiSearchParams()
    expect(apiSearchParams.getAll("aggregations")).toContain("level")

    // ...and it renders as a facet.
    const facetsContainer = screen.getByTestId("facets-container")
    await within(facetsContainer).findByText("Level")
  })

  test("Does not duplicate a facet already shown by default as an extra URL facet", async () => {
    const { channel } = setMockApiResponses({
      channelPatch: { channel_type: ChannelTypeEnum.Unit },
      search: {
        count: 700,
        metadata: {
          aggregations: {
            topic: [{ key: "physics", doc_count: 100 }],
          },
          suggestions: [],
        },
      },
    })

    // "topic" is a default facet for Unit channels and is also present in the
    // URL; it must appear exactly once.
    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}/?topic=physics`,
    })

    const facetsContainer = await screen.findByTestId("facets-container")
    expect(await within(facetsContainer).findAllByText("Topic")).toHaveLength(1)
  })

  test("Submitting search text updates URL correctly", async () => {
    const resources = factories.learningResources.resources({
      count: 10,
    }).results
    const { channel } = setMockApiResponses({
      search: {
        count: 1000,
        metadata: {
          aggregations: {
            resource_type: [
              { key: "course", doc_count: 100 },
              { key: "podcast", doc_count: 200 },
              { key: "program", doc_count: 300 },
              { key: "irrelevant", doc_count: 400 },
            ],
          },
          suggestions: [],
        },
        results: resources,
      },
    })

    const initialSearch = "?q=meow&page=2"

    const { location } = renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}${initialSearch}`,
    })

    const queryInput = await screen.findByRole<HTMLInputElement>("textbox", {
      name: "Search for",
    })
    expect(queryInput.value).toBe("meow")
    await user.clear(queryInput)
    await user.paste("woof")
    expect(location.current.searchParams.get("q")).toBe("meow")
    await user.click(screen.getByRole("button", { name: "Search" }))
    expect(location.current.searchParams.get("q")).toBe("woof")
  })

  /* Topic omitted: its design has no facet sidebar for this to appear in. */
  test.each([
    { channelType: ChannelTypeEnum.Department },
    { channelType: ChannelTypeEnum.Unit },
  ])(
    "Shows Resource Category facet only when resource_type_group=learning_material ($channelType)",
    async ({ channelType }) => {
      const { channel } = setMockApiResponses({
        channelPatch: { channel_type: channelType },
        search: {
          count: 700,
          metadata: {
            aggregations: {
              resource_type_group: [
                { key: "course", doc_count: 100 },
                { key: "learning_material", doc_count: 200 },
              ],
              resource_category: [
                { key: "Course", doc_count: 100 },
                { key: "Video", doc_count: 100 },
              ],
              topic: [{ key: "physics", doc_count: 100 }],
              department: [{ key: "1", doc_count: 100 }],
              certification_type: [{ key: "micromasters", doc_count: 100 }],
              delivery: [{ key: "online", doc_count: 100 }],
              offered_by: [{ key: "ocw", doc_count: 100 }],
            },
            suggestions: [],
          },
        },
      })

      const {
        view: { unmount },
      } = renderWithProviders(<ChannelPage />, {
        url: `/c/${channel.channel_type}/${channel.name}/`,
      })

      const facetsContainer = await screen.findByTestId("facets-container")
      await within(facetsContainer).findByText("Certificate")
      expect(
        within(facetsContainer).queryByText("Resource Category"),
      ).toBeNull()

      unmount()

      // Re-render with resource_type_group=learning_material
      renderWithProviders(<ChannelPage />, {
        url: `/c/${channel.channel_type}/${channel.name}/?resource_type_group=learning_material`,
      })

      expect(
        await within(await screen.findByTestId("facets-container")).findByText(
          "Resource Category",
        ),
      ).toBeInTheDocument()
    },
  )

  /**
   * The topic layout's filter card is a row of controls with nowhere to go on
   * a narrow screen, so the design hides it there and puts the same filters
   * in the drawer instead -- the search box among them, which is why the
   * drawer carries one and the other channels' drawers do not.
   */
  test("a topic page puts its filters in the drawer on a narrow screen", async () => {
    const { channel } = setMockApiResponses({
      channelPatch: { channel_type: ChannelTypeEnum.Topic },
    })

    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}`,
    })
    await user.click(await screen.findByRole("button", { name: "Filter" }))

    const drawer = await screen.findByRole("presentation")
    expect(
      within(drawer).getByPlaceholderText(
        "Search for courses, programs, and learning materials...",
      ),
    ).toBeInTheDocument()
    /* The toggle rides along with the facets; this design does not list it. */
    expect(within(drawer).queryByText("Academic")).toBe(null)
    /* Nor Offered By or Department, which the drawer design stops short of. */
    expect(within(drawer).queryByText("Offered By")).toBe(null)
    expect(within(drawer).queryByText("Department")).toBe(null)
  }, 10000)

  /**
   * The tab row does not fit a phone, so the design moves the choice into the
   * drawer. It is still the tabs: one at a time, writing the same param, and
   * unchecking the chosen one is how it gets back to All.
   */
  test("the drawer carries the resource type choice", async () => {
    const { channel } = setMockApiResponses({
      channelPatch: { channel_type: ChannelTypeEnum.Topic },
    })

    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}`,
    })
    await user.click(await screen.findByRole("button", { name: "Filter" }))
    const drawer = await screen.findByRole("presentation")
    const courses = () =>
      within(drawer).getByRole("checkbox", { name: "Courses" })

    await user.click(courses())
    expect(courses()).toBeChecked()

    /* Unchecking it is the All tab, which the design draws no row for. */
    await user.click(courses())
    expect(courses()).not.toBeChecked()
  }, 10000)

  test("other channels keep the narrow screen's filter drawer", async () => {
    const { channel } = setMockApiResponses({
      channelPatch: { channel_type: ChannelTypeEnum.Department },
    })

    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}`,
    })

    await screen.findByRole("button", { name: "Filter" })
  }, 10000)

  /**
   * The bar sits beside the results rather than inside them, so it is reached
   * by setters the page wraps rather than ones the results display wraps for
   * itself. Reporting exactly once is the point of both halves: the bar used
   * to report nothing at all, and wrapping in both places would report twice.
   */
  describe("topic filter bar analytics", () => {
    const previousKey = process.env.NEXT_PUBLIC_POSTHOG_API_KEY

    beforeEach(() => {
      process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "test-key"
      mockCapture.mockClear()
    })
    afterEach(() => {
      if (previousKey === undefined) {
        delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
      } else {
        process.env.NEXT_PUBLIC_POSTHOG_API_KEY = previousKey
      }
    })

    const renderTopic = async () => {
      const { channel } = setMockApiResponses({
        channelPatch: { channel_type: ChannelTypeEnum.Topic },
      })
      renderWithProviders(<ChannelPage />, {
        url: `/c/${channel.channel_type}/${channel.name}`,
      })
      await screen.findByTestId("topic-search-filter-bar")
    }

    test("the Free checkbox reports the filter it changed", async () => {
      await renderTopic()

      await user.click(await screen.findByRole("checkbox", { name: "Free" }))

      expect(mockCapture).toHaveBeenCalledExactlyOnceWith(
        PostHogEvents.SearchFilterUpdate,
        { control: "free" },
      )
    }, 10000)

    test("a dropdown reports the filter it changed", async () => {
      await renderTopic()

      await user.click(await screen.findByText("Format"))
      const option = (await screen.findAllByRole("option"))[0]
      await user.click(option)

      expect(mockCapture).toHaveBeenCalledExactlyOnceWith(
        PostHogEvents.SearchFilterUpdate,
        { control: "delivery" },
      )
    }, 10000)
  })

  /**
   * The dropdowns say what they are narrowed to, so the card states the
   * filters without any of them being opened.
   */
  /**
   * The bar's dropdowns close over what they selected, so the row above the
   * results is the only place the applied filters are named -- and the only
   * place each one can be switched off by itself.
   */
  describe("selected filter chips", () => {
    const chipRowAt = async (query: string) => {
      const { channel } = setMockApiResponses({
        channelPatch: { channel_type: ChannelTypeEnum.Topic },
      })
      renderWithProviders(<ChannelPage />, {
        url: `/c/${channel.channel_type}/${channel.name}/${query}`,
      })
      return screen.findByTestId("selected-filters")
    }

    /* Labelled as the facets are labelled wherever else they are drawn. */
    test("names each applied filter", async () => {
      const row = await chipRowAt(
        "?delivery=in_person&certification_type=professional&free=true",
      )

      expect(
        within(row).getByRole("button", { name: "Remove filter In-Person" }),
      ).toBeInTheDocument()
      expect(
        within(row).getByRole("button", {
          name: "Remove filter Professional Certificate",
        }),
      ).toBeInTheDocument()
      expect(
        within(row).getByRole("button", { name: "Remove filter Free" }),
      ).toBeInTheDocument()
    }, 10000)

    /**
     * One order for both screens: the same list that puts Format above
     * Certificate in the narrow screen's drawer puts the formats before the
     * certificates here, rather than leaving the chips in whichever order the
     * URL happens to carry them.
     */
    test("lists them in the drawer's order, not the URL's", async () => {
      const row = await chipRowAt(
        "?certification_type=professional&delivery=in_person&free=true",
      )

      expect(
        within(row)
          .getAllByRole("button")
          .map((button) => button.textContent),
      ).toEqual([
        "Free",
        "In-Person",
        "Professional Certificate",
        "Clear all filters",
      ])
    }, 10000)

    test("a chip removes only its own filter", async () => {
      const row = await chipRowAt("?delivery=in_person&free=true")

      await user.click(
        within(row).getByRole("button", { name: "Remove filter Free" }),
      )

      expect(
        within(row).queryByRole("button", { name: "Remove filter Free" }),
      ).toBe(null)
      expect(
        within(row).getByRole("button", { name: "Remove filter In-Person" }),
      ).toBeInTheDocument()
    }, 10000)

    test("Clear all filters drops them all but keeps the query", async () => {
      const row = await chipRowAt("?q=robots&delivery=in_person&free=true")

      await user.click(
        within(row).getByRole("button", { name: "Clear all filters" }),
      )

      expect(screen.queryByTestId("selected-filters")).toBe(null)
      /* The search box sits beside the filters but is not one of them. */
      expect(screen.getByDisplayValue("robots")).toBeInTheDocument()
    }, 10000)

    test("the row is absent when nothing is filtering", async () => {
      const { channel } = setMockApiResponses({
        channelPatch: { channel_type: ChannelTypeEnum.Topic },
      })
      renderWithProviders(<ChannelPage />, {
        url: `/c/${channel.channel_type}/${channel.name}/?q=robots`,
      })
      await screen.findByTestId("topic-search-filter-bar")

      expect(screen.queryByTestId("selected-filters")).toBe(null)
    }, 10000)
  })

  /**
   * The results are a grid here rather than rows, and laying them out that way
   * is no reason for a screen reader to lose the list -- how many results
   * there are, and which one it is on.
   */
  test("the card grid is still a list", async () => {
    const resources = factories.learningResources.resources({ count: 3 })
    const { channel } = setMockApiResponses({
      channelPatch: { channel_type: ChannelTypeEnum.Topic },
      search: { count: 3, results: resources.results },
    })

    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}`,
    })

    /* Wait for the results themselves: the skeletons occupy the same grid. */
    await screen.findByText(resources.results[0].title)

    const list = await screen.findByTestId("topic-results-grid")
    expect(list.tagName).toBe("UL")
    expect(within(list).getAllByRole("listitem")).toHaveLength(
      resources.results.length,
    )
  }, 10000)

  /**
   * The skeletons stand in for what is coming, so they take the same shape:
   * rows resolving into a grid would rearrange the page under the reader at
   * the moment the results land.
   */
  test("the loading skeletons take the grid's shape, not the rows'", async () => {
    const { channel } = setMockApiResponses({
      channelPatch: { channel_type: ChannelTypeEnum.Topic },
    })
    /* Held pending, so the display stays in its loading state. */
    setMockResponse.get(
      expect.stringContaining(urls.search.resources()),
      new Promise(() => {}),
    )

    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}`,
    })

    const grid = await screen.findByTestId("topic-results-grid")
    expect(grid.tagName).toBe("UL")
    expect(within(grid).getAllByRole("listitem").length).toBeGreaterThan(0)
  }, 10000)
})
