import React from "react"
import invariant from "tiny-invariant"
import { setMockResponse, urls } from "api/test-utils"
import { learningResources as factories } from "api/test-utils/factories"
import { renderWithProviders, screen, user, within } from "@/test-utils"
import { analytics } from "@/common/analytics"
import EducatorPage from "./EducatorPage"
import {
  SELECTED_COURSES_PARAMS,
  TEACHING_PODCAST_EPISODES_PARAMS,
  TEACHING_VIDEOS_PARAMS,
} from "./queryParams"
import { OCW_GIVE_URL, OCW_NEWSLETTER_URL, OCW_SOCIAL } from "./links"

jest.mock("@/common/analytics/posthog", () => ({
  capturePostHog: jest.fn(),
  initPostHog: jest.fn(),
}))
jest.mock("ol-components/CarouselV2", () => ({
  CarouselV2: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

const assertLinksTo = (
  el: HTMLElement,
  {
    pathname,
    search = {},
  }: { pathname: string; search?: Record<string, string | string[]> },
) => {
  invariant(el instanceof HTMLAnchorElement, "Expected an anchor element")
  const url = new URL(el.href, window.location.href)
  const params: Record<string, string | string[]> = {}
  url.searchParams.forEach((value, key) => {
    const existing = params[key]
    params[key] = existing === undefined ? value : [existing, value].flat()
  })
  expect(url.pathname).toBe(pathname)
  expect(params).toEqual(search)
}

const emptyPage = { count: 0, next: null, previous: null, results: [] }

const setupApis = ({
  courses = factories.courses({ count: 3 }),
  videos = factories.videos({ count: 2 }),
  episodes = factories.podcastEpisodes({ count: 1 }),
}: {
  courses?: ReturnType<typeof factories.courses> | typeof emptyPage
  videos?: ReturnType<typeof factories.videos> | typeof emptyPage
  episodes?: ReturnType<typeof factories.podcastEpisodes> | typeof emptyPage
} = {}) => {
  setMockResponse.get(urls.userMe.get(), { is_authenticated: false })
  setMockResponse.get(urls.courses.list(SELECTED_COURSES_PARAMS), courses)
  setMockResponse.get(urls.videos.list(TEACHING_VIDEOS_PARAMS), videos)
  setMockResponse.get(
    urls.podcastEpisodes.list(TEACHING_PODCAST_EPISODES_PARAMS),
    episodes,
  )
  return { courses, videos, episodes }
}

describe("EducatorPage hero", () => {
  test("renders the heading and breadcrumbs", () => {
    setupApis()
    renderWithProviders(<EducatorPage />)
    screen.getByRole("heading", {
      level: 1,
      name: "Bring MIT into your teaching",
    })
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    )
    screen.getByText("Educator")
  })

  test("submitting the search goes to an OCW-scoped search", async () => {
    setupApis()
    const { location } = renderWithProviders(<EducatorPage />)
    const searchbox = screen.getByRole("textbox", { name: /search for/i })
    await user.click(searchbox)
    await user.paste("linear algebra")
    await user.type(searchbox, "[Enter]")
    expect(location.current).toEqual(
      expect.objectContaining({
        pathname: "/search",
        search: "?q=linear+algebra&offered_by=ocw",
      }),
    )
  })

  test("the Search button runs an OCW-scoped search and records it", async () => {
    setupApis()
    const siteSearched = jest.spyOn(analytics, "siteSearched")
    const { location } = renderWithProviders(<EducatorPage />)
    await user.click(screen.getByRole("textbox", { name: /search for/i }))
    await user.paste("climate")
    // The input has its own icon button labelled "Search"; this is the text one.
    const button = screen
      .getAllByRole("button", { name: "Search" })
      .find((el) => el.textContent === "Search")
    invariant(button, "Expected the Search text button")
    await user.click(button)
    expect(location.current).toEqual(
      expect.objectContaining({
        pathname: "/search",
        search: "?q=climate&offered_by=ocw",
      }),
    )
    expect(siteSearched).toHaveBeenCalledWith({
      query: "climate",
      isEnter: false,
    })
  })

  test.each<{ name: RegExp; search: Record<string, string> }>([
    {
      name: /Browse Open licensed courses/,
      search: { offered_by: "ocw", resource_type_group: "course" },
    },
    {
      name: /lecture videos/,
      search: {
        offered_by: "ocw",
        resource_type: "video",
        resource_category: "Lecture Video",
      },
    },
    { name: /open textbooks/, search: { course_feature: "Open Textbooks" } },
  ])("shortcut $name links to a search", ({ name, search }) => {
    setupApis()
    renderWithProviders(<EducatorPage />)
    assertLinksTo(screen.getByRole("link", { name }), {
      pathname: "/search",
      search,
    })
  })
})

describe("EducatorPage selected courses", () => {
  test("shows a card per course and links to all free OCW courses", async () => {
    const courses = factories.courses({ count: 3 })
    courses.count = 2540
    setupApis({ courses })
    renderWithProviders(<EducatorPage />)

    await screen.findByRole("heading", { name: "Selected for teaching" })
    for (const course of courses.results) {
      await screen.findByRole("heading", { name: course.title })
    }
    const browse = screen.getByRole("link", {
      name: "Browse all 2,540 free courses on MIT Learn",
    })
    assertLinksTo(browse, {
      pathname: "/search",
      search: {
        offered_by: "ocw",
        free: "true",
        resource_type_group: "course",
      },
    })
  })

  test("is hidden when there are no courses", async () => {
    const { videos } = setupApis({ courses: emptyPage })
    renderWithProviders(<EducatorPage />)
    // Wait for the other queries to settle so the courses query has too.
    await screen.findByRole("heading", { name: videos.results[0].title })
    expect(
      screen.queryByRole("heading", { name: "Selected for teaching" }),
    ).not.toBeInTheDocument()
  })
})

describe("EducatorPage teaching practices", () => {
  test("features the newest video and lists a second video and a podcast episode", async () => {
    const {
      videos: {
        results: [featured, side],
      },
      episodes: {
        results: [episode],
      },
    } = setupApis()
    renderWithProviders(<EducatorPage />)

    // The section heading shows while the cards load; wait for the cards.
    await screen.findByRole("heading", { name: featured.title })
    screen.getByRole("heading", { name: "Learn from MIT teaching practices" })
    expect(screen.getByRole("link", { name: featured.title })).toHaveAttribute(
      "href",
      featured.learn_url,
    )
    screen.getByRole("heading", { name: side.title })
    expect(
      screen.getByRole("link", { name: "Watch on MIT Learn" }),
    ).toHaveAttribute("href", side.learn_url)
    screen.getByRole("heading", { name: episode.title })
    expect(
      screen.getByRole("link", { name: "Listen on MIT Learn" }),
    ).toHaveAttribute("href", episode.learn_url)
    assertLinksTo(
      screen.getByRole("link", { name: "Explore More Videos and Podcasts" }),
      {
        pathname: "/search",
        search: {
          offered_by: "ocw",
          resource_type: ["video", "podcast_episode"],
        },
      },
    )
  })

  test("renders descriptions as sanitized HTML", async () => {
    const featured = factories.video({
      description:
        '<p>Taught with <strong>active learning</strong>.</p><script>window.pwned = true</script><img src="x" onerror="window.pwned = true"> See <a href="https://example.com/syllabus">the syllabus</a>.',
    })
    setupApis({
      videos: {
        count: 1,
        next: null,
        previous: null,
        results: [featured],
      },
    })
    const { view } = renderWithProviders(<EducatorPage />)

    const strong = await screen.findByText("active learning")
    expect(strong.tagName).toBe("STRONG")
    expect(strong.closest("p")).toHaveTextContent(
      "Taught with active learning.",
    )
    expect(view.container.querySelector("script")).toBeNull()
    expect(view.container.querySelector("[onerror]")).toBeNull()
    // The whole card is a link, so links in the description are unwrapped.
    const linkText = screen.getByText(/the syllabus/)
    expect(linkText.closest("a")).toBeNull()
  })

  test("is hidden when there are no videos or podcast episodes", async () => {
    const { courses } = setupApis({ videos: emptyPage, episodes: emptyPage })
    renderWithProviders(<EducatorPage />)
    await screen.findByRole("heading", { name: courses.results[0].title })
    expect(
      screen.queryByRole("heading", {
        name: "Learn from MIT teaching practices",
      }),
    ).not.toBeInTheDocument()
  })
})

describe("EducatorPage static sections", () => {
  test("links to the licensing and giving pages", () => {
    setupApis()
    renderWithProviders(<EducatorPage />)
    expect(
      screen.getByRole("link", {
        name: "Learn more about reuse and licensing",
      }),
    ).toHaveAttribute("href", expect.stringMatching(/^\/terms#/))
    expect(screen.getByRole("link", { name: "Give now" })).toHaveAttribute(
      "href",
      OCW_GIVE_URL,
    )
  })

  describe("Share your story", () => {
    const SHARE_STORY_URL = "https://forms.example.com/share-your-story"
    afterEach(() => {
      delete process.env.NEXT_PUBLIC_EDUCATOR_SHARE_STORY_URL
    })

    test("links to the configured form in a new tab", () => {
      process.env.NEXT_PUBLIC_EDUCATOR_SHARE_STORY_URL = SHARE_STORY_URL
      setupApis()
      renderWithProviders(<EducatorPage />)
      const link = screen.getByRole("link", { name: "Share your story" })
      expect(link).toHaveAttribute("href", SHARE_STORY_URL)
      expect(link).toHaveAttribute("target", "_blank")
    })

    test("is not rendered when the form URL is unset", () => {
      setupApis()
      renderWithProviders(<EducatorPage />)
      screen.getByRole("link", { name: "Give now" })
      expect(
        screen.queryByRole("heading", { name: "Share your story" }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("link", { name: "Share your story" }),
      ).not.toBeInTheDocument()
    })
  })

  test.each([
    ["Facebook", OCW_SOCIAL.facebook],
    ["Instagram", OCW_SOCIAL.instagram],
    ["X", OCW_SOCIAL.x],
    ["YouTube", OCW_SOCIAL.youtube],
    ["LinkedIn", OCW_SOCIAL.linkedin],
  ])("links to OCW on %s in a new tab", (label, href) => {
    setupApis()
    renderWithProviders(<EducatorPage />)
    const link = screen.getByRole("link", {
      name: `MIT OpenCourseWare on ${label}`,
    })
    expect(link).toHaveAttribute("href", href)
    expect(link).toHaveAttribute("target", "_blank")
  })

  test("the newsletter form submits the email to the newsletter page", () => {
    setupApis()
    renderWithProviders(<EducatorPage />)
    const form = screen.getByRole("form", {
      name: "Subscribe to the Newsletter",
    })
    expect(form).toHaveAttribute("action", OCW_NEWSLETTER_URL)
    expect(
      within(form).getByRole("textbox", { name: "Email address" }),
    ).toHaveAttribute("name", "EMAIL")
    within(form).getByRole("button", { name: "Sign Me Up" })
  })
})
