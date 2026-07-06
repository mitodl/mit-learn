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
  within,
} from "@/test-utils"
import { factories, setMockResponse, makeRequest, urls } from "api/test-utils"
import { LearningResourceCard } from "ol-components"
import { ControlledPromise, allowConsoleErrors } from "ol-test-utilities"
import invariant from "tiny-invariant"
import { usePostHog } from "posthog-js/react"
import { PostHogEvents } from "@/common/constants"

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  usePostHog: jest.fn(),
}))
const mockCapture = jest.fn()
jest.mocked(usePostHog).mockReturnValue(
  // @ts-expect-error Not mocking all of posthog
  { capture: mockCapture },
)

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
    "Hits the carousel endpoint iff not in loading state (isLoading=$isLoading)",
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

      const carouselCall = expect.objectContaining({
        method: "get",
        url: expect.stringContaining(urls.search.resources()),
      })
      if (isLoading) {
        // Other requests (e.g. useUserMe from ResourceCard) may fire, but the
        // carousel endpoint specifically should not.
        expect(makeRequest).not.toHaveBeenCalledWith(carouselCall)
      } else {
        expect(makeRequest).toHaveBeenCalledWith(carouselCall)
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
        expect.objectContaining({
          method: "get",
          url: expect.stringContaining(urls.learningResources.list()),
        }),
      )
    })
    const call = makeRequest.mock.calls.find(([args]) => {
      return args.url.includes(urls.learningResources.list())
    })
    const url = call?.[0].url
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

  it("Does not render if all resources are excluded by excludeResourceId", async () => {
    const config: ResourceCarouselProps["config"] = [
      {
        label: "Resources",
        data: {
          type: "resources",
          params: { resource_type: ["course", "program"], professional: true },
        },
      },
    ]
    const { resources } = setupApis({ count: 1 })
    const { view } = renderWithProviders(
      <ResourceCarousel
        titleComponent="h1"
        title="My Carousel"
        config={config}
        excludeResourceId={resources.list.results[0].id}
      />,
    )
    await waitFor(() => {
      expect(view.container.firstChild).toBeNull()
    })
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

  test("clicking a card fires course_card_clicked with key payload fields", async () => {
    allowConsoleErrors()
    const config: ResourceCarouselProps["config"] = [
      {
        label: "Test Carousel",
        data: {
          type: "resources",
          params: { resource_type: ["course"] },
        },
      },
    ]
    const { resources } = setupApis({ count: 2 })
    process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "test-key"
    mockCapture.mockClear()

    renderWithProviders(
      <ResourceCarousel
        titleComponent="h2"
        title="Test Carousel"
        config={config}
      />,
    )

    const firstResource = resources.list.results[0]
    const card = await screen.findByRole("heading", {
      name: firstResource.title,
    })
    await user.click(card)

    expect(mockCapture).toHaveBeenCalledWith(
      PostHogEvents.CourseCardClicked,
      expect.objectContaining({
        label: "Test Carousel",
        resourceId: firstResource.id,
        readableId: firstResource.readable_id,
      }),
    )
    delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
  })

  describe("keyboard accessibility (roving tabindex)", () => {
    const setupCarousel = async (count = 3) => {
      const config: ResourceCarouselProps["config"] = [
        {
          label: "Resources",
          data: {
            type: "resources",
            params: { resource_type: ["course"] },
          },
        },
      ]
      const { resources } = setupApis({ count })
      renderWithProviders(
        <>
          <ResourceCarousel
            titleComponent="h2"
            title="Test Carousel"
            config={config}
          />
          <button>Outside the carousel</button>
        </>,
      )
      await screen.findByText(resources.list.results[0].title)
      const getSlides = () =>
        screen.getAllByRole("group", { name: /^\d+ of \d+:/ })
      return { resources, getSlides }
    }

    it("exposes each card as a single tab stop with slide semantics, only the active card tabbable", async () => {
      const { resources, getSlides } = await setupCarousel(3)
      const slides = getSlides()

      expect(slides).toHaveLength(3)
      slides.forEach((slide, index) => {
        expect(slide).toHaveAttribute("aria-roledescription", "slide")
        expect(slide).toHaveAttribute(
          "aria-label",
          `${index + 1} of 3: ${resources.list.results[index].title}`,
        )
        expect(slide).toHaveAttribute("tabindex", index === 0 ? "0" : "-1")
      })
    })

    it("moves focus and the roving tabindex to the next/previous card on ArrowRight/ArrowLeft", async () => {
      const { getSlides } = await setupCarousel(3)
      const slides = getSlides()

      slides[0].focus()
      await user.keyboard("{ArrowRight}")
      expect(document.activeElement).toBe(slides[1])
      expect(slides[0]).toHaveAttribute("tabindex", "-1")
      expect(slides[1]).toHaveAttribute("tabindex", "0")

      await user.keyboard("{ArrowLeft}")
      expect(document.activeElement).toBe(slides[0])
      expect(slides[0]).toHaveAttribute("tabindex", "0")
      expect(slides[1]).toHaveAttribute("tabindex", "-1")
    })

    it("does not move past the first/last card on ArrowLeft/ArrowRight", async () => {
      const { getSlides } = await setupCarousel(2)
      const slides = getSlides()

      slides[0].focus()
      await user.keyboard("{ArrowLeft}")
      expect(document.activeElement).toBe(slides[0])

      slides[1].focus()
      await user.keyboard("{ArrowRight}")
      expect(document.activeElement).toBe(slides[1])
    })

    it("jumps to the first/last card on Home/End", async () => {
      const { getSlides } = await setupCarousel(3)
      const slides = getSlides()

      slides[1].focus()
      await user.keyboard("{End}")
      expect(document.activeElement).toBe(slides[2])

      await user.keyboard("{Home}")
      expect(document.activeElement).toBe(slides[0])
    })

    it("does not intercept arrow keys when focus is on a nested element like the bookmark button", async () => {
      const { getSlides } = await setupCarousel(2)
      const slides = getSlides()
      const bookmarkButton = within(slides[0]).getByRole("button", {
        name: /Bookmark/i,
      })

      bookmarkButton.focus()
      await user.keyboard("{ArrowRight}")
      expect(document.activeElement).toBe(bookmarkButton)
      expect(slides[0]).toHaveAttribute("tabindex", "0")
      expect(slides[1]).toHaveAttribute("tabindex", "-1")
    })

    it("tabs from the focused card into its own title link, not into the next card", async () => {
      const { getSlides } = await setupCarousel(2)
      const slides = getSlides()

      slides[0].focus()
      await user.tab()
      expect(document.activeElement).toBe(within(slides[0]).getByRole("link"))
      expect(document.activeElement).not.toBe(slides[1])
    })

    it("exits the carousel entirely after tabbing through the active card, skipping every inactive card's internal links/buttons", async () => {
      const { getSlides } = await setupCarousel(2)
      const slides = getSlides()
      const outsideButton = screen.getByRole("button", {
        name: "Outside the carousel",
      })

      slides[0].focus()
      // Tab through every focusable element inside the active card (title
      // link, bookmark button, etc.) plus one more Tab to leave the carousel.
      for (let i = 0; i < 10 && document.activeElement !== outsideButton; i++) {
        // eslint-disable-next-line no-await-in-loop
        await user.tab()
        expect(slides[1].contains(document.activeElement)).toBe(false)
      }
      expect(document.activeElement).toBe(outsideButton)
    })

    test("pressing Enter on the focused card opens it, mirroring a click", async () => {
      allowConsoleErrors()
      process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "test-key"
      mockCapture.mockClear()
      const { resources, getSlides } = await setupCarousel(2)
      const slides = getSlides()
      const firstResource = resources.list.results[0]

      slides[0].focus()
      await user.keyboard("{Enter}")

      expect(mockCapture).toHaveBeenCalledWith(
        PostHogEvents.CourseCardClicked,
        expect.objectContaining({
          label: "Test Carousel",
          resourceId: firstResource.id,
          readableId: firstResource.readable_id,
        }),
      )
      delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
    })
  })
})
