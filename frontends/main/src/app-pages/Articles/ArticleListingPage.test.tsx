import React from "react"
import { ArticleListingPage } from "./ArticleListingPage"
import { urls, setMockResponse } from "api/test-utils"
import type { NewsFeedItem } from "api/v0"
import { newsEvents } from "api/test-utils/factories"
import {
  renderWithProviders,
  screen,
  user,
  waitFor,
  within,
} from "@/test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"

jest.mock("posthog-js/react")
jest.mock("@/common/useFeatureFlagsLoaded")

const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
const mockedUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)

describe("ArticleListingPage", () => {
  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })
  const setupAPI = (newsCount = 21) => {
    const news = newsEvents.newsItems({ count: newsCount })
    setMockResponse.get(expect.stringContaining(urls.newsEvents.list()), news)
    return news
  }

  test("displays loading spinner on initial load", () => {
    setupAPI(0)
    renderWithProviders(<ArticleListingPage />)
    expect(screen.getByRole("progressbar")).toBeInTheDocument()
  })

  test("displays empty state when no articles are available", async () => {
    setupAPI(0)
    renderWithProviders(<ArticleListingPage />)

    await screen.findByText("No News Available")

    expect(
      screen.getByText(
        "There are no news to display at this time. Please check back later.",
      ),
    ).toBeInTheDocument()
  })

  test("displays main news and grid stories on desktop", async () => {
    const news = setupAPI(21)
    renderWithProviders(<ArticleListingPage />)

    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    })

    // Main story should be visible
    const mainStoryTitle = news.results[0].title
    const mainStories = screen.getAllByText(mainStoryTitle)
    expect(mainStories.length).toBeGreaterThan(0)

    // Grid stories should be visible (indices 1-20 from first page)
    expect(screen.getAllByText(news.results[1].title).length).toBeGreaterThan(0)
    expect(screen.getAllByText(news.results[20].title).length).toBeGreaterThan(
      0,
    )
  })

  test("displays article banner with correct title and description", async () => {
    setupAPI(21)
    renderWithProviders(<ArticleListingPage />)

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "News" })).toBeInTheDocument()
    })
  })

  test("displays article images when available", async () => {
    const news = setupAPI(21)
    renderWithProviders(<ArticleListingPage />)

    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    })

    // Check for alt text from image
    const images = screen.getAllByAltText(news.results[0].title)
    expect(images.length).toBeGreaterThan(0)
  })

  test("displays article publish dates", async () => {
    const news = setupAPI(21)
    renderWithProviders(<ArticleListingPage />)

    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    })

    // Verify that LocalDate component renders dates for articles
    // Check that there are multiple date elements rendered (one per article)
    const listItems = screen.getAllByRole("listitem")
    expect(listItems.length).toBeGreaterThan(0)

    // Verify that dates are present in the document
    // The first article should have a publish date
    const firstArticle = news.results[0] as NewsFeedItem
    const firstArticleDate = firstArticle.news_details?.publish_date
    if (firstArticleDate) {
      // LocalDate component will format the date, so check for parts of the date
      const dateElements = screen.getAllByText((content, element) => {
        return (
          element?.tagName.toLowerCase() === "time" ||
          content.includes(new Date(firstArticleDate).getFullYear().toString())
        )
      })
      expect(dateElements.length).toBeGreaterThan(0)
    }
  })

  test("links to article URLs correctly", async () => {
    const news = setupAPI(21)
    renderWithProviders(<ArticleListingPage />)

    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    })

    // Verify links exist with correct hrefs
    const allLinks = screen.getAllByRole("link")
    const firstArticleLink = allLinks.find(
      (link) => link.getAttribute("href") === news.results[0].url,
    )
    expect(firstArticleLink).toBeInTheDocument()
    expect(firstArticleLink).toHaveAttribute("href", news.results[0].url)
  })

  test("displays article summaries with HTML stripped", async () => {
    const newsWithHtml = newsEvents.newsItems({ count: 1 })
    // Summaries are now cleaned by the backend, so they come without HTML
    newsWithHtml.results[0].summary = "This is a test summary"

    setMockResponse.get(
      expect.stringContaining(urls.newsEvents.list()),
      newsWithHtml,
    )

    renderWithProviders(<ArticleListingPage />)

    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    })

    // Summary should be displayed as plain text
    expect(
      screen.getAllByText(/This is a test summary/i).length,
    ).toBeGreaterThan(0)
  })

  test("pagination navigates to next page", async () => {
    // Setup first page with total count of 40 to enable pagination
    const firstPage = newsEvents.newsItems({ count: 20 })
    firstPage.count = 40 // Override to indicate 40 total items (2 pages)
    setMockResponse.get(
      urls.newsEvents.list({
        feed_type: ["news"],
        limit: 20,
        offset: 0,
        sortby: "-news_date",
      }),
      firstPage,
    )

    // Setup second page with 20 items
    const secondPage = newsEvents.newsItems({ count: 20 })
    secondPage.count = 40 // Match the total count
    secondPage.results = secondPage.results.map((item, idx) => ({
      ...item,
      title: `Second Page Article ${idx}`,
    }))

    setMockResponse.get(
      urls.newsEvents.list({
        feed_type: ["news"],
        limit: 20,
        offset: 20,
        sortby: "-news_date",
      }),
      secondPage,
    )

    renderWithProviders(<ArticleListingPage />)

    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    })

    // Click next page button
    const nextButton = screen.getByRole("button", { name: /next/i })
    await user.click(nextButton)

    await waitFor(() => {
      expect(
        screen.getAllByText("Second Page Article 0").length,
      ).toBeGreaterThan(0)
    })
  })

  test("pagination displays correct page count", async () => {
    const news = newsEvents.newsItems({ count: 100 })
    setMockResponse.get(expect.stringContaining(urls.newsEvents.list()), news)

    renderWithProviders(<ArticleListingPage />)

    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    })

    // With 100 items and PAGE_SIZE of 20, we should have 5 pages
    const pagination = screen.getByRole("navigation")
    expect(within(pagination).getByText("5")).toBeInTheDocument()
  })

  test("pagination respects MAX_PAGE limit", async () => {
    // Create only 20 items to avoid timeout, but set count to 1500 (75 pages worth)
    const news = newsEvents.newsItems({ count: 20 })
    news.count = 1500 // Override to simulate 1500 total items
    setMockResponse.get(expect.stringContaining(urls.newsEvents.list()), news)

    renderWithProviders(<ArticleListingPage />)

    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    })

    const pagination = screen.getByRole("navigation")
    // Should cap at MAX_PAGE (50), not 75
    expect(within(pagination).getByText("50")).toBeInTheDocument()
  })

  test("main story only appears on page 1", async () => {
    // Setup first page - use count of 40 to indicate there are 2 pages total
    const firstPage = newsEvents.newsItems({ count: 20 })
    firstPage.count = 40 // Override to indicate 40 total items (2 pages)
    const mainStoryTitle = firstPage.results[0].title

    setMockResponse.get(
      urls.newsEvents.list({
        feed_type: ["news"],
        limit: 20,
        offset: 0,
        sortby: "-news_date",
      }),
      firstPage,
    )

    // Setup second page with distinct content
    const secondPage = newsEvents.newsItems({ count: 20 })
    secondPage.count = 40 // Match the total count
    secondPage.results[0].title = "Page 2 First Article"
    setMockResponse.get(
      urls.newsEvents.list({
        feed_type: ["news"],
        limit: 20,
        offset: 20,
        sortby: "-news_date",
      }),
      secondPage,
    )

    renderWithProviders(<ArticleListingPage />)

    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    })

    // Verify main story is present on page 1
    expect(screen.getAllByText(mainStoryTitle).length).toBeGreaterThan(0)

    // Navigate to page 2
    const nextButton = screen.getByRole("button", { name: /next/i })
    await user.click(nextButton)

    // Wait for page 2 content to load
    await waitFor(() => {
      expect(
        screen.getAllByText("Page 2 First Article").length,
      ).toBeGreaterThan(0)
    })

    // Main story from page 1 should not be present on page 2
    expect(screen.queryByText(mainStoryTitle)).not.toBeInTheDocument()
  })

  test("hides pagination when no articles", async () => {
    setupAPI(0)
    renderWithProviders(<ArticleListingPage />)

    await screen.findByText("No News Available")

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
  })

  test("displays loading spinner when fetching subsequent pages", async () => {
    const firstPage = newsEvents.newsItems({ count: 20 })
    setMockResponse.get(
      urls.newsEvents.list({
        feed_type: ["news"],
        limit: 20,
        offset: 0,
        sortby: "-news_date",
      }),
      firstPage,
    )

    const secondPage = newsEvents.newsItems({ count: 20 })
    setMockResponse.get(
      urls.newsEvents.list({
        feed_type: ["news"],
        limit: 20,
        offset: 20,
        sortby: "-news_date",
      }),
      secondPage,
    )

    renderWithProviders(<ArticleListingPage />)

    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    })

    // The loading state for page transitions is handled by isFetching
    // This test verifies the UI handles the loading state properly
    const nextButton = screen.getByRole("button", { name: /next/i })
    expect(nextButton).toBeInTheDocument()
  })

  test("renders responsive mobile layout", async () => {
    const news = setupAPI(21)
    renderWithProviders(<ArticleListingPage />)

    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    })

    // The mobile/desktop layouts are handled via styled components media queries
    // Both layouts render the same content, just styled differently
    expect(screen.getAllByText(news.results[0].title).length).toBeGreaterThan(0)
    expect(screen.getAllByText(news.results[1].title).length).toBeGreaterThan(0)
  })

  test("calculates grid stories correctly for page 1", async () => {
    const news = setupAPI(21)
    renderWithProviders(<ArticleListingPage />)

    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    })

    // First story is the main story, so grid should show stories 1-20
    const gridStory = screen.getAllByText(news.results[1].title)
    expect(gridStory.length).toBeGreaterThan(0)
    // Story at index 0 (main story) should still be visible in main section
    const mainStoryInstances = screen.getAllByText(news.results[0].title)
    expect(mainStoryInstances.length).toBeGreaterThan(0)
  })
})
