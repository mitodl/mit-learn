import React from "react"
import HomePage from "./HomePage"
import NewsEventsSection from "./NewsEventsSection"
import { urls, setMockResponse } from "api/test-utils"
import {
  learningResources,
  newsEvents,
  testimonials,
} from "api/test-utils/factories"
import {
  renderWithProviders,
  screen,
  user,
  within,
  waitFor,
} from "@/test-utils"
import invariant from "tiny-invariant"
import * as routes from "@/common/urls"
import { assertHeadings } from "ol-test-utilities"
import { useFeatureFlagEnabled, usePostHog } from "posthog-js/react"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
const mockedPostHogCapture = jest.fn()
jest.mock("posthog-js/react")
jest.mocked(usePostHog).mockReturnValue(
  // @ts-expect-error Not mocking all of posthog
  { capture: mockedPostHogCapture },
)

const assertLinksTo = (
  el: HTMLElement,
  {
    pathname,
    search = {},
  }: {
    pathname: string
    search?: Record<string, string>
  },
) => {
  invariant(el instanceof HTMLAnchorElement, "Expected an anchor element")
  const url = new URL(el.href, window.location.href)
  const searchParams = Object.fromEntries(url.searchParams.entries())
  expect(url.pathname).toEqual(pathname)
  expect(searchParams).toEqual(search)
}

const setupAPIs = () => {
  setMockResponse.get(urls.userMe.get(), { is_authenticated: true })
  setMockResponse.get(urls.userLists.membershipList(), [])
  setMockResponse.get(urls.learningPaths.membershipList(), [])

  const featured = learningResources.resources({ count: 2 })
  const media = learningResources.resources({ count: 2 })
  const attestations = testimonials.testimonials({ count: 3 })

  setMockResponse.get(
    expect.stringContaining(urls.learningResources.featured()),
    featured,
  )
  setMockResponse.get(
    expect.stringContaining(urls.learningResources.list()),
    media,
  )

  setMockResponse.get(
    urls.newsEvents.list({
      feed_type: ["news"],
      limit: 6,
      sortby: "-news_date",
    }),
    newsEvents.newsItems({ count: 6 }),
  )
  setMockResponse.get(
    urls.newsEvents.list({
      feed_type: ["events"],
      limit: 6,
      sortby: "event_date",
    }),
    newsEvents.eventItems({ count: 6 }),
  )

  setMockResponse.get(urls.topics.list({ is_toplevel: true }), {
    results: [],
  })

  setMockResponse.get(
    expect.stringContaining(urls.testimonials.list({})),
    attestations,
  )

  mockedUseFeatureFlagEnabled.mockReturnValue(false)
  return { featured, media }
}

describe("Home Page Hero", () => {
  test("Submitting search goes to search page", async () => {
    setupAPIs()
    const { location } = renderWithProviders(<HomePage heroImageIndex={1} />)
    const searchbox = screen.getByRole("textbox", { name: /search for/i })
    await user.click(searchbox)
    await user.paste("physics")
    await user.type(searchbox, "[Enter]")
    expect(location.current).toEqual(
      expect.objectContaining({
        pathname: "/search",
        search: "?q=physics",
      }),
    )
  })

  test("Displays popular searches", () => {
    setMockResponse.get(urls.topics.list({ is_toplevel: true }), {
      results: [],
    })
    setupAPIs()
    renderWithProviders(<HomePage heroImageIndex={1} />)
    const expected = [
      { label: "Topic", href: "/topics" },
      { label: "Recently Added", href: "/search?sortby=new" },
      { label: "Popular", href: "/search?sortby=-views" },
      { label: "Upcoming", href: "/search?sortby=upcoming" },
      { label: "Free", href: "/search?free=true" },
      {
        label: "With Certificate",
        href: "/search?certification_type=professional&certification_type=completion&certification_type=micromasters",
      },
      { label: "Explore All", href: "/search" },
    ]
    expected.forEach(({ label, href }) => {
      const link = screen.getByRole<HTMLAnchorElement>("link", { name: label })
      expect(link).toHaveAttribute("href", href)
    })
  })
})

describe("Home Page Browse by Topic", () => {
  test("Displays topics links", async () => {
    setupAPIs()

    const response = learningResources.topics({ count: 3 })
    setMockResponse.get(urls.topics.list({ is_toplevel: true }), response)

    renderWithProviders(<HomePage heroImageIndex={1} />)

    await waitFor(() => {
      const section = screen
        .getByRole("heading", {
          name: "Browse by Topic",
        })!
        .closest("section")!

      const links = within(section).getAllByRole("link")
      assertLinksTo(links[0], {
        pathname: new URL(response.results[0].channel_url!).pathname,
      })
      assertLinksTo(links[1], {
        pathname: new URL(response.results[1].channel_url!).pathname,
      })
      assertLinksTo(links[2], {
        pathname: new URL(response.results[2].channel_url!).pathname,
      })
    })
  })
})

describe("Home Page News and Events", () => {
  test("Displays News section", async () => {
    const news = newsEvents.newsItems({ count: 6 })
    setMockResponse.get(
      urls.newsEvents.list({
        feed_type: ["news"],
        limit: 6,
        sortby: "-news_date",
      }),
      news,
    )

    const events = newsEvents.eventItems({ count: 6 })
    setMockResponse.get(
      urls.newsEvents.list({
        feed_type: ["events"],
        limit: 6,
        sortby: "event_date",
      }),
      events,
    )

    renderWithProviders(<NewsEventsSection />)

    let section
    await waitFor(() => {
      section = screen
        .getAllByRole("heading", { name: "News" })!
        .at(0)!
        .closest("section")!
    })

    const links = within(section!).getAllByRole("link")

    expect(links[0]).toHaveAttribute("href", news.results[0].url)
    within(links[0]).getByText(news.results[0].title)

    expect(links[1]).toHaveAttribute("href", news.results[1].url)
    within(links[1]).getByText(news.results[1].title)

    expect(links[2]).toHaveAttribute("href", news.results[2].url)
    within(links[2]).getByText(news.results[2].title)

    expect(links[3]).toHaveAttribute("href", news.results[3].url)
    within(links[3]).getByText(news.results[3].title)

    expect(links[4]).toHaveAttribute("href", news.results[4].url)
    within(links[4]).getByText(news.results[4].title)

    expect(links[5]).toHaveAttribute("href", news.results[5].url)
    within(links[5]).getByText(news.results[5].title)
  })

  test("Displays Events section", async () => {
    const news = newsEvents.newsItems({ count: 6 })
    setMockResponse.get(
      urls.newsEvents.list({
        feed_type: ["news"],
        limit: 6,
        sortby: "-news_date",
      }),
      news,
    )

    const events = newsEvents.eventItems({ count: 6 })
    setMockResponse.get(
      urls.newsEvents.list({
        feed_type: ["events"],
        limit: 6,
        sortby: "event_date",
      }),
      events,
    )

    renderWithProviders(<NewsEventsSection />)

    let section
    await waitFor(() => {
      section = screen
        .getAllByRole("heading", { name: "Events" })!
        .at(0)!
        .closest("section")!
    })

    const links = within(section!).getAllByRole("link")

    expect(links[0]).toHaveAttribute("href", events.results[0].url)
    within(links[0]).getByText(events.results[0].title)

    expect(links[1]).toHaveAttribute("href", events.results[1].url)
    within(links[1]).getByText(events.results[1].title)

    expect(links[2]).toHaveAttribute("href", events.results[2].url)
    within(links[2]).getByText(events.results[2].title)

    expect(links[3]).toHaveAttribute("href", events.results[3].url)
    within(links[3]).getByText(events.results[3].title)

    expect(links[4]).toHaveAttribute("href", events.results[4].url)
    within(links[4]).getByText(events.results[4].title)

    expect(links[5]).toHaveAttribute("href", events.results[5].url)
    within(links[5]).getByText(events.results[5].title)
  })
})

describe("Home Page personalize section", () => {
  test("Links to dashboard when authenticated", async () => {
    setupAPIs()

    renderWithProviders(<HomePage heroImageIndex={1} />)
    const personalize = (
      await screen.findByRole("heading", {
        name: "Continue Your Journey",
      })
    ).closest("section")
    invariant(personalize)
    const link = within(personalize).getByRole("link")
    expect(link).toHaveAttribute("href", "/dashboard")
  })

  test("Links to login when not authenticated", async () => {
    setupAPIs()

    setMockResponse.get(urls.userMe.get(), { is_authenticated: false })
    renderWithProviders(<HomePage heroImageIndex={1} />)
    const personalize = (
      await screen.findByRole("heading", {
        name: "Personalize Your Journey",
      })
    ).closest("section")
    invariant(personalize)
    const link = within(personalize).getByRole("link")
    expect(link).toHaveAttribute(
      "href",
      routes.auth({
        next: {
          pathname: routes.DASHBOARD_HOME,
          searchParams: null,
        },
      }),
    )
  })
})

describe("Home Page Testimonials", () => {
  test("Displays testimonials carousel", async () => {
    setupAPIs()

    renderWithProviders(<HomePage heroImageIndex={1} />)

    await waitFor(() => {
      screen.getAllByText(/testable title/i)
    })
  })
})

describe("Home Page Carousel", () => {
  test("Tabbed Carousel sanity check", async () => {
    setupAPIs()

    renderWithProviders(<HomePage heroImageIndex={1} />)

    await screen.findAllByRole("tablist").then(([featured, media]) => {
      within(featured).getByRole("tab", { name: "All" })
      within(featured).getByRole("tab", { name: "Free" })
      within(featured).getByRole("tab", { name: "With Certificate" })
      within(featured).getByRole("tab", {
        name: "Professional & Executive Learning",
      })
      within(media).getByRole("tab", { name: "All" })
      within(media).getByRole("tab", { name: "Videos" })
      within(media).getByRole("tab", { name: "Podcasts" })
    })
  })
})

test("Headings", async () => {
  const { featured, media } = setupAPIs()

  renderWithProviders(<HomePage heroImageIndex={1} />)
  await waitFor(() => {
    assertHeadings([
      { level: 1, name: "Learn with MIT" },
      { level: 2, name: "Featured Courses" },
      // Featured course order is randomized on frontend, so just check for presence
      ...featured.results.map(() => ({ level: 3, name: expect.any(String) })),
      { level: 2, name: "Continue Your Journey" },
      { level: 2, name: "Media" },
      ...media.results.map((result) => ({ level: 3, name: result.title })),
      { level: 2, name: "Browse by Topic" },
      { level: 2, name: "From Our Community" },
      { level: 2, name: "MIT News & Events" },
      { level: 3, name: "News" },
      { level: 3, name: "Events" },
      { level: 3, name: "News" },
      { level: 3, name: "Events" },
    ])
  })
})
