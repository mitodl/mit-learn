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
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { FeatureFlags } from "@/common/feature_flags"
import { PostHogEvents } from "@/common/constants"

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  useFeatureFlagEnabled: jest.fn(),
  usePostHog: jest.fn(),
}))
jest.mock("@/common/useFeatureFlagsLoaded")

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

// jest clears calls between tests but not implementations, so reset flags
// between tests. The redesigned topic page this suite is about is not behind
// one; the cases that need a flag set it for themselves.
beforeEach(() => {
  mockFeatureFlags({})
  /* The page holds a spinner until the flags are in rather than render on a
     bootstrapped value, so without this every case here waits on one. */
  jest.mocked(useFeatureFlagsLoaded).mockReturnValue(true)
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
  /* Without a name the checkboxes announce as a loose set of three. */
  test("the drawer's resource type choice is a named group", async () => {
    const { channel } = setMockApiResponses({
      channelPatch: { channel_type: ChannelTypeEnum.Topic },
    })

    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}`,
    })
    await user.click(await screen.findByRole("button", { name: "Filter" }))
    const drawer = await screen.findByRole("presentation")

    expect(
      within(drawer).getByRole("group", { name: "Resource type" }),
    ).toBeInTheDocument()
  }, 10000)

  test("topic channels offer courses and programs together, and no All", async () => {
    const { channel } = setMockApiResponses({
      channelPatch: { channel_type: ChannelTypeEnum.Topic },
    })

    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}`,
    })

    const tabs = await screen.findAllByRole("tab")
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      expect.stringContaining("Courses & Programs"),
      expect.stringContaining("Learning Materials"),
    ])
    expect(tabs[0]).toHaveAttribute("aria-selected", "true")

    await waitFor(() => {
      expect(makeRequest.mock.calls.length > 0).toBe(true)
    })
    expect(getLastApiSearchParams().getAll("resource_type_group")).toEqual([
      "course",
      "program",
    ])
  })

  test("a topic channel link to just courses lands on Courses & Programs", async () => {
    const { channel } = setMockApiResponses({
      channelPatch: { channel_type: ChannelTypeEnum.Topic },
    })

    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}?resource_type_group=course`,
    })

    expect(
      await screen.findByRole("tab", { name: /Courses & Programs/ }),
    ).toHaveAttribute("aria-selected", "true")
  })

  test("other channels keep separate Courses and Programs tabs", async () => {
    const { channel } = setMockApiResponses({
      channelPatch: { channel_type: ChannelTypeEnum.Department },
    })

    renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}`,
    })

    const tabs = await screen.findAllByRole("tab")
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      expect.stringContaining("All"),
      expect.stringContaining("Courses"),
      expect.stringContaining("Programs"),
      expect.stringContaining("Learning Materials"),
    ])
  })

  test("the drawer carries the resource type choice", async () => {
    const { channel } = setMockApiResponses({
      channelPatch: { channel_type: ChannelTypeEnum.Topic },
    })

    const { location } = renderWithProviders(<ChannelPage />, {
      url: `/c/${channel.channel_type}/${channel.name}`,
    })
    await user.click(await screen.findByRole("button", { name: "Filter" }))
    await screen.findByRole("presentation")
    /* Switching tabs remounts the drawer in the new tab's panel, so look it
       up afresh each time rather than hold on to the one that was removed. */
    const inDrawer = (name: string) =>
      within(screen.getByRole("presentation")).getByRole("checkbox", { name })
    const coursesAndPrograms = () => inDrawer("Courses & Programs")
    const learningMaterials = () => inDrawer("Learning Materials")

    expect(coursesAndPrograms()).toBeChecked()
    expect(learningMaterials()).not.toBeChecked()

    await user.click(learningMaterials())
    await waitFor(() => expect(coursesAndPrograms()).not.toBeChecked())
    expect(learningMaterials()).toBeChecked()
    expect(
      new URLSearchParams(location.current.search).getAll(
        "resource_type_group",
      ),
    ).toEqual(["learning_material"])

    /* With no All to fall back to, unchecking goes back to the default. */
    await user.click(learningMaterials())
    await waitFor(() => expect(coursesAndPrograms()).toBeChecked())
    expect(learningMaterials()).not.toBeChecked()
    expect(
      new URLSearchParams(location.current.search).has("resource_type_group"),
    ).toBe(false)
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

    /**
     * Counts, because the bar offers only what the search has something
     * under: with nothing counting there is no menu to report a change from
     * and no Free to tick.
     */
    const renderTopic = async () => {
      const { channel } = setMockApiResponses({
        channelPatch: { channel_type: ChannelTypeEnum.Topic },
        search: {
          metadata: {
            aggregations: {
              delivery: [{ key: "online", doc_count: 7 }],
              free: [
                { key: "true", doc_count: 3 },
                { key: "false", doc_count: 4 },
              ],
            },
            suggestions: [],
          },
        },
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
  describe("filter counts on the controls", () => {
    const barAt = async (query: string) => {
      const { channel } = setMockApiResponses({
        channelPatch: { channel_type: ChannelTypeEnum.Topic },
        search: {
          metadata: {
            aggregations: {
              delivery: [
                { key: "online", doc_count: 7 },
                { key: "in_person", doc_count: 4 },
              ],
              certification_type: [{ key: "professional", doc_count: 5 }],
            },
            suggestions: [],
          },
        },
      })
      renderWithProviders(<ChannelPage />, {
        url: `/c/${channel.channel_type}/${channel.name}/${query}`,
      })
      return screen.findByTestId("topic-search-filter-bar")
    }

    /**
     * The menu closes over what it selected, so a control that says only its
     * own name reads the same whether or not it is narrowing anything.
     */
    test("counts what each control has narrowed by", async () => {
      const bar = await barAt("?delivery=online&delivery=in_person")

      expect(
        within(bar).getByRole("combobox", { name: "Format, 2 selected" }),
      ).toHaveTextContent("2")
      expect(
        within(bar).getByRole("combobox", { name: "Certificate" }),
      ).not.toHaveTextContent(/\d/)
    }, 10000)

    /**
     * The disc is drawn, not named: `aria-label` on a combobox replaces what
     * is inside it, so a count left to the disc alone is read by nobody.
     */
    test("says the count in the control's name, not just the disc", async () => {
      const bar = await barAt("?delivery=online&delivery=in_person")

      expect(
        within(bar).getByRole("combobox", { name: "Format, 2 selected" }),
      ).toBeInTheDocument()
      expect(
        within(bar).queryByRole("combobox", { name: "Format" }),
      ).not.toBeInTheDocument()
    }, 10000)

    /* A badge reading 0 is a filter announcing that it is not filtering. */
    test("says nothing where a control is narrowing nothing", async () => {
      const bar = await barAt("")

      expect(
        within(bar).getByRole("combobox", { name: "Format" }),
      ).not.toHaveTextContent(/\d/)
      expect(
        within(bar).getByRole("combobox", { name: "Certificate" }),
      ).not.toHaveTextContent(/\d/)
    }, 10000)
  })

  /**
   * The bar's dropdowns close over what they selected, so the row under the
   * search box is the only place the applied filters are named -- and the
   * only place each one can be switched off by itself.
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
        /* Reads "Clear all filters" to assistive tech; the row it ends is what
           supplies "filters" to everyone else. */
        "Clear all",
      ])
    }, 10000)

    /**
     * Removing a chip unmounts the button that removed it, and the browser
     * drops focus to the body rather than passing it on.
     */
    test("hands focus to the next chip when one is removed", async () => {
      const row = await chipRowAt("?delivery=in_person&free=true")
      const free = within(row).getByRole("button", {
        name: "Remove filter Free",
      })
      free.focus()

      await user.click(free)

      expect(document.activeElement).toBe(
        within(row).getByRole("button", { name: "Remove filter In-Person" }),
      )
      expect(document.activeElement).not.toBe(document.body)
    }, 10000)

    test("hands focus to the results when the last filter goes", async () => {
      const row = await chipRowAt("?free=true")

      await user.click(
        within(row).getByRole("button", { name: "Remove filter Free" }),
      )

      expect(screen.queryByTestId("selected-filters")).toBe(null)
      expect(document.activeElement).not.toBe(document.body)
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

  describe("the empty state", () => {
    /* The mocked search answers with no results, so every case here is empty. */
    const emptyAt = async (query: string) => {
      const { channel } = setMockApiResponses({
        channelPatch: { channel_type: ChannelTypeEnum.Topic },
      })
      const { location } = renderWithProviders(<ChannelPage />, {
        url: `/c/${channel.channel_type}/${channel.name}/${query}`,
      })
      return { location, card: await screen.findByTestId("no-results") }
    }

    /**
     * The filters are what emptied the search, so the way out of it is to drop
     * them -- and the grid they would have appeared above is not there to
     * carry the chip row's own link into view.
     */
    test("offers to clear the filters that emptied the search", async () => {
      const { card, location } = await emptyAt("?delivery=online&free=true")

      await user.click(
        within(card).getByRole("button", { name: "Clear all filters" }),
      )

      await waitFor(() => {
        expect(location.current.searchParams.get("delivery")).toBe(null)
      })
      expect(location.current.searchParams.get("free")).toBe(null)
    }, 10000)

    /* A button that cannot change the answer is worse than no button. */
    test("offers nothing to clear when nothing is filtering", async () => {
      const { card } = await emptyAt("")

      expect(
        within(card).queryByRole("button", { name: "Clear all filters" }),
      ).toBe(null)
    }, 10000)

    /**
     * "No results" says nothing the empty grid does not. Naming what was
     * looked for says which tab came back empty, where the other may not have.
     */
    test("names what the active tab found none of", async () => {
      const { card } = await emptyAt("?resource_type_group=learning_material")

      expect(card).toHaveTextContent(
        "No learning materials match these filters",
      )
    }, 10000)

    test("names courses and programs on the default tab", async () => {
      const { card } = await emptyAt("")

      expect(card).toHaveTextContent(
        "No courses or programs match these filters",
      )
    }, 10000)
  })
})
