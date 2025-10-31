import React from "react"
import ResourceCarousel from "./ResourceCarousel"
import type { ResourceCarouselProps } from "./ResourceCarousel"
import {
  act,
  expectLastProps,
  renderWithProviders,
  screen,
  user,
  waitFor,
} from "@/test-utils"
import { factories, setMockResponse, makeRequest, urls } from "api/test-utils"
import { LearningResourceCard } from "ol-components"
import { ControlledPromise } from "ol-test-utilities"
import invariant from "tiny-invariant"

jest.mock("ol-components", () => {
  const actual = jest.requireActual("ol-components")
  return {
    ...actual,
    LearningResourceCard: jest.fn(actual.LearningResourceCard),
  }
})

const spyLearningResourceCard = jest.mocked(LearningResourceCard)

describe("ResourceCarousel", () => {
  const setupApis = ({
    count = 3,
    autoResolve = true,
  }: { count?: number; autoResolve?: boolean } = {}) => {
    const resources = {
      search: factories.learningResources.resources({ count }),
      list: factories.learningResources.resources({ count }),
    }
    setMockResponse.get(urls.userMe.get(), { is_authenticated: true })
    setMockResponse.get(urls.userLists.membershipList(), [])
    setMockResponse.get(urls.learningPaths.membershipList(), [])

    const searchResponse = new ControlledPromise()
    const listResponse = new ControlledPromise()
    setMockResponse.get(
      expect.stringContaining(urls.search.resources()),
      searchResponse,
    )
    setMockResponse.get(
      expect.stringContaining(urls.learningResources.list()),
      listResponse,
    )
    const resolve = () => {
      searchResponse.resolve(resources.search)
      listResponse.resolve(resources.list)
    }
    if (autoResolve) {
      resolve()
    }
    return { resources, resolve, searchResponse }
  }

  it.each([
    { cardProps: undefined },
    { cardProps: { size: "small" } },
    { cardProps: { size: "medium" } },
    { cardProps: undefined },
    { cardProps: { size: "small" } },
    { cardProps: { size: "medium" } },
  ] as const)(
    "Shows loading state then renders results from the correct endpoint with expected props",
    async ({ cardProps }) => {
      const config: ResourceCarouselProps["config"] = [
        {
          label: "Resources",
          data: {
            type: "resources",
            params: { resource_type: ["video", "podcast"] },
          },
          cardProps,
        },
        {
          label: "Search",
          data: {
            type: "lr_search",
            params: { professional: true },
          },
          cardProps,
        },
      ]

      const { resources } = setupApis({ autoResolve: true })

      renderWithProviders(
        <ResourceCarousel
          titleComponent="h1"
          title="My Carousel"
          config={config}
        />,
      )

      const tabs = await screen.findAllByRole("tab")

      expect(tabs).toHaveLength(2)
      expect(tabs[0]).toHaveTextContent("Resources")
      expect(tabs[1]).toHaveTextContent("Search")

      await screen.findByText(resources.list.results[0].title)
      await screen.findByText(resources.list.results[1].title)
      await screen.findByText(resources.list.results[2].title)
      expectLastProps(spyLearningResourceCard, { ...cardProps })

      await user.click(tabs[1])
      await screen.findByText(resources.search.results[0].title)
      await screen.findByText(resources.search.results[1].title)
      await screen.findByText(resources.search.results[2].title)
      expectLastProps(spyLearningResourceCard, { ...cardProps })
    },
  )

  it.each([{ isLoading: true }, { isLoading: false }])(
    "Makes no API calls in loading state (isLoading=$isLoading)",
    async ({ isLoading }) => {
      const config: ResourceCarouselProps["config"] = [
        {
          label: "Search",
          data: { type: "lr_search", params: { professional: true } },
        },
      ]

      renderWithProviders(
        <ResourceCarousel
          titleComponent="h1"
          title="My Carousel"
          config={config}
          isLoading={isLoading}
        />,
      )
      setupApis()
      await act(() => {
        // Goal here is just to flush the event queue; 0 timeout is good enough.
        return new Promise((resolve) => setTimeout(resolve, 0))
      })

      if (isLoading) {
        /**
         * makeRequest is actually called, just not with the carousel URL.
         * The ResourceCard components call `useUserMe` regardless of their
         * loading state.
         */
        expect(makeRequest).not.toHaveBeenCalledWith([
          "get",
          expect.stringContaining(urls.search.resources()),
          undefined,
        ])
      } else {
        expect(makeRequest).not.toHaveBeenCalledWith([
          "get",
          expect.stringContaining(urls.search.resources()),
          undefined,
        ])
      }
    },
  )

  it.each([
    { labels: ["First Tab", "Second Tab"], expectTabs: true },
    { labels: ["Irrelevant title"], expectTabs: false },
  ])(
    "Only renders tabs if multiple config items",
    async ({ labels, expectTabs }) => {
      const config: ResourceCarouselProps["config"] = labels.map((label) => {
        return {
          label,
          data: { type: "lr_search", params: { q: label } },
        }
      })

      const { resources } = setupApis()

      renderWithProviders(
        <ResourceCarousel
          titleComponent="h1"
          title="My Carousel"
          config={config}
        />,
      )

      if (expectTabs) {
        const tabs = await screen.findAllByRole("tab")
        expect(tabs.map((tab) => tab.textContent)).toEqual(labels)
      } else {
        const tabs = screen.queryAllByRole("tab")
        expect(tabs).toHaveLength(0)
      }

      await screen.findByText(resources.search.results[1].title)
      await screen.findByText(resources.search.results[0].title)
      await screen.findByText(resources.search.results[2].title)
    },
  )

  it("calls API with expected parameters", async () => {
    const config: ResourceCarouselProps["config"] = [
      {
        label: "Resources",
        data: {
          type: "resources",
          params: { resource_type: ["course", "program"], professional: true },
        },
      },
    ]
    setMockResponse.get(urls.userMe.get(), { is_authenticated: true })
    setupApis()
    renderWithProviders(
      <ResourceCarousel
        titleComponent="h1"
        title="My Carousel"
        config={config}
      />,
    )
    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        "get",
        expect.stringContaining(urls.learningResources.list()),
        undefined,
      )
    })
    const [_method, url] =
      makeRequest.mock.calls.find(([_method, url]) => {
        return url.includes(urls.learningResources.list())
      }) ?? []
    invariant(url)
    const urlParams = new URLSearchParams(url.split("?")[1])
    expect(urlParams.getAll("resource_type")).toEqual(["course", "program"])
    expect(urlParams.get("professional")).toEqual("true")
  })

  it.each([
    { titleComponent: "h1", expectedTag: "H1" },
    { titleComponent: "h3", expectedTag: "H3" },
  ] as const)(
    "Shows the correct title with correct heading level",
    async ({ titleComponent, expectedTag }) => {
      const config: ResourceCarouselProps["config"] = [
        {
          label: "Resources",
          data: {
            type: "resources",
            params: {
              resource_type: ["course", "program"],
              professional: true,
            },
          },
        },
      ]
      setMockResponse.get(urls.userMe.get(), { is_authenticated: true })
      setupApis()
      renderWithProviders(
        <ResourceCarousel
          titleComponent={titleComponent}
          title="My Favorite Carousel"
          config={config}
        />,
      )

      const title = await screen.findByRole("heading", {
        name: "My Favorite Carousel",
      })
      expect(title.tagName).toBe(expectedTag)
    },
  )

  it("Excludes a resource if excludeResourceId is provided", async () => {
    const config: ResourceCarouselProps["config"] = [
      {
        label: "Resources",
        data: {
          type: "resources",
          params: { resource_type: ["course", "program"], professional: true },
        },
      },
    ]
    const { resources } = setupApis()
    renderWithProviders(
      <ResourceCarousel
        titleComponent="h1"
        title="My Carousel"
        config={config}
        excludeResourceId={resources.list.results[1].id}
      />,
    )
    await screen.findByText(resources.list.results[0].title)
    await screen.findByText(resources.list.results[2].title)
    expect(screen.queryByText(resources.list.results[1].title)).toBeNull()
  })

  it.each([
    { titleComponent: "h1", expectedLevel: 2 },
    { titleComponent: "h2", expectedLevel: 3 },
    { titleComponent: "h3", expectedLevel: 4 },
    { titleComponent: "h4", expectedLevel: 5 },
    { titleComponent: "h5", expectedLevel: 6 },
    { titleComponent: "h6", expectedLevel: 6 },
  ] as const)(
    "Resource cards have headingLevel set to next level down for screen reader navigation",
    async ({ titleComponent, expectedLevel }) => {
      const config: ResourceCarouselProps["config"] = [
        {
          label: "Resources",
          data: {
            type: "resources",
            params: { resource_type: ["course"] },
          },
        },
      ]
      const { resources } = setupApis()
      renderWithProviders(
        <ResourceCarousel
          titleComponent={titleComponent}
          title="My Carousel"
          config={config}
        />,
      )

      const titleHeading = await screen.findByRole("heading", {
        name: resources.list.results[0].title,
      })
      expect(titleHeading.getAttribute("aria-level")).toBe(
        String(expectedLevel),
      )
    },
  )
})
