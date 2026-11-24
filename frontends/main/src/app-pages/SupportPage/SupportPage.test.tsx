import React from "react"
import { renderWithProviders, screen, waitFor, within } from "@/test-utils"
import { makeRequest, setMockResponse, urls } from "api/test-utils"
import { testimonials as factories } from "api/test-utils/factories"
import type { Attestation } from "api/v0"
import SupportPage from "./SupportPage"
import { TESTIMONIAL_EXTRAS } from "./TestimonialSection"
import { FEATURED_TESTIMONIAL_PARAMS } from "./queryParams"
import {
  FREESIA_STORY_URL,
  IMPACT_REPORT_URLS,
  ONE_PAGER_URLS,
  OPEN_LEARNING_GIVE_URL,
} from "./links"

const SHARE_STORY_URL = "https://forms.example.com/share-your-story"

const FREESIA = factories.testimonial({
  attestant_name: "Freesia Gaul",
  quote: "The free courses gave me a solid foundation.",
  cover: "/media/testimonial/freesia-cover.jpg",
})
const FREESIA_EXTRAS = TESTIMONIAL_EXTRAS["Freesia Gaul"]

const mockTestimonials = (results: Attestation[]) =>
  setMockResponse.get(urls.testimonials.list(FEATURED_TESTIMONIAL_PARAMS), {
    count: results.length,
    next: null,
    previous: null,
    results,
  })

/** Waits for the testimonial card, which renders once the API responds. */
const findQuote = (quote = FREESIA.quote) => screen.findByText(`“${quote}”`)

const expectNewTab = (link: HTMLElement) => {
  expect(link).toHaveAttribute("target", "_blank")
  expect(link).toHaveAttribute("rel", "noopener noreferrer")
}

const expectSameTab = (link: HTMLElement) => {
  expect(link).not.toHaveAttribute("target")
}

/** The <section> that a heading titles. */
const sectionOf = (name: string) =>
  screen.getByRole("heading", { level: 2, name }).closest("section")!

/** In page order. */
const SECTION_TITLES = {
  letter: "A little support can open a world of possibility.",
  testimonial: "The impact of open education",
  metrics: "Opening education to the world.",
  reports: "Explore Open Learning's impact reports",
  initiatives:
    "Learn more about how you can support MIT Open Learning’s transformative initiatives",
}

const INITIATIVES = [
  ["Reaching one billion learners", ONE_PAGER_URLS.oneBillionLearners],
  ["Breaking down barriers to access", ONE_PAGER_URLS.barriersToAccess],
  ["Advancing AI and climate education", ONE_PAGER_URLS.aiAndClimate],
  [
    "Strengthening equity & collaborations",
    ONE_PAGER_URLS.equityAndCollaborations,
  ],
] as const

describe("SupportPage", () => {
  beforeEach(() => {
    mockTestimonials([FREESIA])
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPPORT_SHARE_STORY_URL
  })

  describe("page structure", () => {
    test("has one h1, the page title", () => {
      renderWithProviders(<SupportPage />)
      const h1s = screen.getAllByRole("heading", { level: 1 })
      expect(h1s).toHaveLength(1)
      expect(h1s[0]).toHaveTextContent("Support open education.")
    })

    test("renders the sections in the design's order", () => {
      renderWithProviders(<SupportPage />)
      const h2s = screen
        .getAllByRole("heading", { level: 2 })
        .map((el) => el.textContent)
      // "Give" is the hero's option card; the rest title the sections.
      expect(h2s).toEqual(["Give", ...Object.values(SECTION_TITLES)])
    })

    test("every image has alt text, or an empty alt when decorative", () => {
      renderWithProviders(<SupportPage />)
      const images = document.querySelectorAll("img")
      expect(images.length).toBeGreaterThan(0)
      images.forEach((img) => expect(img).toHaveAttribute("alt"))
    })

    test("every link has a destination, and new-tab links set rel", () => {
      process.env.NEXT_PUBLIC_SUPPORT_SHARE_STORY_URL = SHARE_STORY_URL
      renderWithProviders(<SupportPage />)
      screen.getAllByRole("link").forEach((link) => {
        expect(link.getAttribute("href")).toMatch(/^https:\/\//)
        if (link.getAttribute("target") === "_blank") {
          expect(link).toHaveAttribute("rel", "noopener noreferrer")
        }
      })
    })
  })

  describe("hero", () => {
    test("shows the subtitle and the captioned photo", () => {
      renderWithProviders(<SupportPage />)
      screen.getByText(/Help keep MIT’s high-quality educational resources/)
      const photo = screen.getByRole("img", {
        name: "MIT learners working together at a whiteboard",
      })
      const figure = photo.closest("figure")!
      within(figure).getByText("From the OCW 20-year book of impact")
    })

    test("the Donate option links to the giving fund in the same tab", () => {
      renderWithProviders(<SupportPage />)
      const option = screen
        .getByRole("heading", { level: 2, name: "Give" })
        .closest("li")!
      within(option).getByText(
        "Support the continued availability of free and open MIT education.",
      )
      const link = within(option).getByRole("link", { name: "Make a donation" })
      expect(link).toHaveAttribute("href", OPEN_LEARNING_GIVE_URL)
      expectSameTab(link)
    })

    test("the Share option follows Donate when the form URL is set", () => {
      process.env.NEXT_PUBLIC_SUPPORT_SHARE_STORY_URL = SHARE_STORY_URL
      renderWithProviders(<SupportPage />)
      const donate = screen
        .getByRole("heading", { level: 2, name: "Give" })
        .closest("li")!
      const options = within(donate.parentElement!).getAllByRole("listitem")
      expect(options).toHaveLength(2)
      expect(options[0]).toBe(donate)
      const share = options[1]
      within(share).getByRole("heading", { name: "Share your story" })
      within(share).getByText(
        "Tell us how open learning has made a difference for you.",
      )
      const link = within(share).getByRole("link", { name: "Share your story" })
      expect(link).toHaveAttribute("href", SHARE_STORY_URL)
      expectNewTab(link)
    })
  })

  describe("initiatives", () => {
    test("shows the tagline and the mission statement", () => {
      renderWithProviders(<SupportPage />)
      const section = sectionOf(SECTION_TITLES.initiatives)
      within(section).getByText("Together, we open learning.")
      within(section).getByText("MIT Open Learning is expanding access")
      within(section).getByText("Our vision is bold:")
      within(section).getByText("With your support")
    })

    test("shows the four initiative cards in order", () => {
      renderWithProviders(<SupportPage />)
      const section = sectionOf(SECTION_TITLES.initiatives)
      expect(
        within(section)
          .getAllByRole("heading", { level: 3 })
          .map((el) => el.textContent),
      ).toEqual(INITIATIVES.map(([title]) => title))
    })

    test.each(INITIATIVES)(
      "“%s” links to its one-pager in a new tab",
      (title, href) => {
        renderWithProviders(<SupportPage />)
        const card = screen
          .getByRole("heading", { level: 3, name: title })
          .closest("li")!
        const link = within(card).getByRole("link", {
          name: `Learn more about ${title}`,
        })
        expect(link).toHaveTextContent("Learn more")
        expect(link).toHaveAttribute("href", href)
        expectNewTab(link)
      },
    )

    test("the donation button links to the giving fund in the same tab", () => {
      renderWithProviders(<SupportPage />)
      const section = sectionOf(SECTION_TITLES.initiatives)
      const link = within(section).getByRole("link", {
        name: "Make a donation",
      })
      expect(link).toHaveAttribute("href", OPEN_LEARNING_GIVE_URL)
      expectSameTab(link)
    })
  })

  test("both donation buttons link to the Open Learning giving fund", () => {
    renderWithProviders(<SupportPage />)
    const links = screen.getAllByRole("link", { name: "Make a donation" })
    expect(links).toHaveLength(2)
    links.forEach((link) =>
      expect(link).toHaveAttribute("href", OPEN_LEARNING_GIVE_URL),
    )
  })

  describe("letter", () => {
    test("shows the salutation, the body and the closing line", () => {
      renderWithProviders(<SupportPage />)
      const section = sectionOf(SECTION_TITLES.letter)
      within(section).getByText("Dear friends of open learning,")
      within(section).getByText(/knowledge should be a public good/)
      within(section).getByText(/Your support makes this possible/)
      within(section).getByText(/open learning can change lives/)
      within(section).getByText(
        "Thank you for being part of this important work.",
      )
    })

    test("is signed by the Annual Giving officer", () => {
      renderWithProviders(<SupportPage />)
      const section = sectionOf(SECTION_TITLES.letter)
      within(section).getByText("With gratitude,")
      within(section).getByText("Yvonne Ng")
      within(section).getByText("Annual Giving and Donor Relations Officer")
      within(section).getByText("MIT Open Learning")
    })

    test("the signer's portrait is decorative", () => {
      renderWithProviders(<SupportPage />)
      const section = sectionOf(SECTION_TITLES.letter)
      const images = section.querySelectorAll("img")
      expect(images).toHaveLength(1)
      expect(images[0]).toHaveAttribute("alt", "")
    })
  })

  describe("testimonial", () => {
    test("fetches the testimonial at the featured position", async () => {
      renderWithProviders(<SupportPage />)
      await findQuote()
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "get",
          url: urls.testimonials.list(FEATURED_TESTIMONIAL_PARAMS),
        }),
      )
    })

    test("shows a placeholder while the testimonial loads", async () => {
      renderWithProviders(<SupportPage />)
      const section = sectionOf(SECTION_TITLES.testimonial)
      expect(
        within(section).getByTestId("testimonial-skeleton"),
      ).toHaveAttribute("aria-busy", "true")
      await findQuote()
      expect(
        within(section).queryByTestId("testimonial-skeleton"),
      ).not.toBeInTheDocument()
    })

    test("shows the quote and name from the API", async () => {
      renderWithProviders(<SupportPage />)
      const quote = await findQuote()
      expect(quote.tagName).toBe("BLOCKQUOTE")
      within(sectionOf(SECTION_TITLES.testimonial)).getByText(
        FREESIA.attestant_name,
      )
    })

    test("features the first testimonial the API returns", async () => {
      const other = factories.testimonial({ quote: "Another quote." })
      mockTestimonials([FREESIA, other])
      renderWithProviders(<SupportPage />)
      await findQuote()
      expect(screen.queryByText("“Another quote.”")).not.toBeInTheDocument()
    })

    test("shows the hardcoded details for a known attestant", async () => {
      renderWithProviders(<SupportPage />)
      await findQuote()
      const section = sectionOf(SECTION_TITLES.testimonial)
      within(section).getByText(new RegExp(`· ${FREESIA_EXTRAS.location}`))
      within(section).getByText(FREESIA_EXTRAS.summary)
      const link = within(section).getByRole("link", {
        name: FREESIA_EXTRAS.storyLabel,
      })
      expect(link).toHaveAttribute("href", FREESIA_STORY_URL)
      expectNewTab(link)
    })

    test("shows the cover photo, resolved against the API, with alt text", async () => {
      renderWithProviders(<SupportPage />)
      await findQuote()
      const photo = within(sectionOf(SECTION_TITLES.testimonial)).getByRole(
        "img",
        { name: FREESIA_EXTRAS.imageAlt },
      )
      const apiBase = process.env.NEXT_PUBLIC_MITOL_API_BASE_URL!
      expect(decodeURIComponent(photo.getAttribute("src")!)).toContain(
        new URL(FREESIA.cover!, apiBase).toString(),
      )
    })

    test("leaves out the hardcoded details for any other attestant", async () => {
      const other = factories.testimonial({
        attestant_name: "Someone Else",
        quote: "Someone else's quote.",
      })
      mockTestimonials([other])
      renderWithProviders(<SupportPage />)
      await findQuote(other.quote)
      const section = sectionOf(SECTION_TITLES.testimonial)
      within(section).getByText("Someone Else")
      expect(within(section).queryByText(/·/)).not.toBeInTheDocument()
      expect(
        within(section).queryByText(FREESIA_EXTRAS.summary),
      ).not.toBeInTheDocument()
      expect(
        within(section).queryByRole("link", {
          name: FREESIA_EXTRAS.storyLabel,
        }),
      ).not.toBeInTheDocument()
      // Without a known description, the photo is decorative.
      expect(section.querySelector("img")).toHaveAttribute("alt", "")
    })

    test("leaves out the photo when the testimonial has no cover", async () => {
      mockTestimonials([{ ...FREESIA, cover: null }])
      renderWithProviders(<SupportPage />)
      await findQuote()
      expect(
        sectionOf(SECTION_TITLES.testimonial).querySelector("img"),
      ).toBeNull()
    })

    test("leaves out the section when there is no testimonial", async () => {
      mockTestimonials([])
      renderWithProviders(<SupportPage />)
      await waitFor(() =>
        expect(
          screen.queryByRole("heading", { name: SECTION_TITLES.testimonial }),
        ).not.toBeInTheDocument(),
      )
      // The sections around it still render.
      sectionOf(SECTION_TITLES.letter)
      sectionOf(SECTION_TITLES.metrics)
    })
  })

  describe("impact metrics", () => {
    test("shows the description", () => {
      renderWithProviders(<SupportPage />)
      within(sectionOf(SECTION_TITLES.metrics)).getByText(
        /See the reach of MIT Open Learning/,
      )
    })

    test("pairs each label with its value", () => {
      renderWithProviders(<SupportPage />)
      const pairs = screen.getAllByRole("term").map((term) => [
        term.textContent,
        // A <dd> describes the <dt> before it.
        term.nextElementSibling?.tagName === "DD"
          ? term.nextElementSibling.textContent
          : null,
      ])
      expect(pairs).toEqual([
        ["Free MIT learning resources", "12,000+"],
        ["Learners using Open resources", "9.3M+"],
      ])
    })
  })

  describe("impact reports", () => {
    test("shows the description", () => {
      renderWithProviders(<SupportPage />)
      within(sectionOf(SECTION_TITLES.reports)).getByText(
        /Selected recent editions/,
      )
    })

    test("links to the newest reports, newest first", () => {
      renderWithProviders(<SupportPage />)
      const links = within(sectionOf(SECTION_TITLES.reports)).getAllByRole(
        "link",
      )
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

    test("each card shows its year's cover and a View Impact Report label", () => {
      renderWithProviders(<SupportPage />)
      const links = within(sectionOf(SECTION_TITLES.reports)).getAllByRole(
        "link",
      )
      links.forEach((link, i) => {
        const year = [2026, 2025, 2024][i]
        within(link).getByText("View Impact Report")
        const cover = link.querySelector("img")!
        // Decorative: the card's heading already names the report.
        expect(cover).toHaveAttribute("alt", "")
        expect(decodeURIComponent(cover.getAttribute("src")!)).toContain(
          `/images/support/report-${year}.jpg`,
        )
      })
    })
  })

  describe("Share your story", () => {
    test("every CTA links to the configured form in a new tab", async () => {
      process.env.NEXT_PUBLIC_SUPPORT_SHARE_STORY_URL = SHARE_STORY_URL
      renderWithProviders(<SupportPage />)
      await findQuote()
      screen.getByRole("heading", { name: "Share your story" })
      const links = screen.getAllByRole("link", { name: "Share your story" })
      // Hero option, testimonial header, and the "Has MIT helped you learn?" prompt.
      expect(links).toHaveLength(3)
      links.forEach((link) => {
        expect(link).toHaveAttribute("href", SHARE_STORY_URL)
        expectNewTab(link)
      })
    })

    test("the testimonial shows the header button and the prompt", async () => {
      process.env.NEXT_PUBLIC_SUPPORT_SHARE_STORY_URL = SHARE_STORY_URL
      renderWithProviders(<SupportPage />)
      await findQuote()
      const section = sectionOf(SECTION_TITLES.testimonial)
      expect(
        within(section).getAllByRole("link", { name: "Share your story" }),
      ).toHaveLength(2)
      within(section).getByText("Has MIT helped you learn?")
    })

    test("uses the configured URL with surrounding whitespace trimmed", async () => {
      process.env.NEXT_PUBLIC_SUPPORT_SHARE_STORY_URL = `  ${SHARE_STORY_URL}\n`
      renderWithProviders(<SupportPage />)
      await findQuote()
      screen
        .getAllByRole("link", { name: "Share your story" })
        .forEach((link) =>
          expect(link).toHaveAttribute("href", SHARE_STORY_URL),
        )
    })

    test.each([
      ["unset", undefined],
      ["empty", ""],
      ["whitespace", "   "],
    ])("is not rendered when the form URL is %s", async (_label, value) => {
      if (value !== undefined) {
        process.env.NEXT_PUBLIC_SUPPORT_SHARE_STORY_URL = value
      }
      renderWithProviders(<SupportPage />)
      await findQuote()
      expect(
        screen.queryByRole("heading", { name: "Share your story" }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("link", { name: "Share your story" }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText("Has MIT helped you learn?"),
      ).not.toBeInTheDocument()
      // The rest of the page still renders.
      screen.getByRole("heading", { level: 2, name: "Give" })
      screen.getByRole("link", { name: FREESIA_EXTRAS.storyLabel })
    })
  })
})
