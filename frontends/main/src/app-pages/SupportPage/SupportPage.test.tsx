import React from "react"
import { renderWithProviders, screen, within } from "@/test-utils"
import SupportPage from "./SupportPage"
import { TESTIMONIAL } from "./TestimonialSection"
import {
  FREESIA_STORY_URL,
  IMPACT_REPORT_URLS,
  ONE_PAGER_URLS,
  OPEN_LEARNING_GIVE_URL,
} from "./links"

const SHARE_STORY_URL = "https://forms.example.com/share-your-story"

const expectNewTab = (link: HTMLElement) => {
  expect(link).toHaveAttribute("target", "_blank")
  expect(link).toHaveAttribute("rel", "noopener noreferrer")
}

describe("SupportPage", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPPORT_SHARE_STORY_URL
  })

  test("renders the page heading and section headings", () => {
    renderWithProviders(<SupportPage />)
    screen.getByRole("heading", { level: 1, name: "Support free education." })
    for (const name of [
      "Learn more about how you can support MIT Open Learning’s transformative initiatives",
      "A little support can open a world of possibility.",
      "The impact of open education",
      "Opening education to the world.",
      "Explore Open Learning's impact reports",
    ]) {
      screen.getByRole("heading", { level: 2, name })
    }
  })

  test("both donation buttons link to the Open Learning giving fund", () => {
    renderWithProviders(<SupportPage />)
    const links = screen.getAllByRole("link", { name: "Make a donation" })
    expect(links).toHaveLength(2)
    links.forEach((link) =>
      expect(link).toHaveAttribute("href", OPEN_LEARNING_GIVE_URL),
    )
  })

  test.each([
    ["Reaching one billion learners", ONE_PAGER_URLS.oneBillionLearners],
    ["Breaking down barriers to access", ONE_PAGER_URLS.barriersToAccess],
    ["Advancing AI and climate education", ONE_PAGER_URLS.aiAndClimate],
    [
      "Strengthening equity & collaborations",
      ONE_PAGER_URLS.equityAndCollaborations,
    ],
  ])("“%s” links to its one-pager in a new tab", (title, href) => {
    renderWithProviders(<SupportPage />)
    const link = screen.getByRole("link", { name: `Learn more about ${title}` })
    expect(link).toHaveAttribute("href", href)
    expectNewTab(link)
  })

  test("impact reports link to the newest reports, newest first", () => {
    renderWithProviders(<SupportPage />)
    const section = screen
      .getByRole("heading", { name: "Explore Open Learning's impact reports" })
      .closest("section")!
    const links = within(section).getAllByRole("link")
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      IMPACT_REPORT_URLS[2026],
      IMPACT_REPORT_URLS[2025],
      IMPACT_REPORT_URLS[2024],
    ])
    expect(
      links.map((link) => within(link).getByRole("heading").textContent),
    ).toEqual([
      "MIT Open Learning Impact Report - 2026",
      "MIT Open Learning Impact Report - 2025",
      "MIT Open Learning Impact Report - 2024",
    ])
    links.forEach(expectNewTab)
  })

  test("shows the testimonial and links to the full story", () => {
    renderWithProviders(<SupportPage />)
    screen.getByText(`“${TESTIMONIAL.quote}”`)
    screen.getByText(TESTIMONIAL.name)
    const link = screen.getByRole("link", { name: "Read Freesia’s story" })
    expect(link).toHaveAttribute("href", FREESIA_STORY_URL)
    expectNewTab(link)
  })

  test("shows the impact metrics", () => {
    renderWithProviders(<SupportPage />)
    const terms = screen.getAllByRole("term").map((el) => el.textContent)
    const values = screen.getAllByRole("definition").map((el) => el.textContent)
    expect(terms).toEqual([
      "Free MIT learning resources",
      "Learners using Open resources",
    ])
    expect(values).toEqual(["12,000+", "9.3M+"])
  })

  describe("Share your story", () => {
    test("every CTA links to the configured form in a new tab", () => {
      process.env.NEXT_PUBLIC_SUPPORT_SHARE_STORY_URL = SHARE_STORY_URL
      renderWithProviders(<SupportPage />)
      screen.getByRole("heading", { name: "Share your story" })
      const links = screen.getAllByRole("link", { name: "Share your story" })
      // Hero option, testimonial header, and the "Has MIT helped you learn?" prompt.
      expect(links).toHaveLength(3)
      links.forEach((link) => {
        expect(link).toHaveAttribute("href", SHARE_STORY_URL)
        expectNewTab(link)
      })
    })

    test("is not rendered when the form URL is unset", () => {
      renderWithProviders(<SupportPage />)
      expect(
        screen.queryByRole("heading", { name: "Share your story" }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("link", { name: "Share your story" }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText("Has MIT helped you learn?"),
      ).not.toBeInTheDocument()
    })
  })
})
