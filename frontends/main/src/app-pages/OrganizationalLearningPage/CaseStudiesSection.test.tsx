import React from "react"
import { act, renderWithProviders, screen, user } from "@/test-utils"
import CaseStudiesSection, { CaseStudyCarousel } from "./CaseStudiesSection"
import { caseStudies } from "./copy"
import type { CaseStudyItem } from "./copy"

/**
 * Embla derives slide positions from real element widths via
 * getBoundingClientRect, which jsdom always reports as zero, so paging and the
 * arrows' disabled state cannot be exercised for real here. Embla is faked so
 * the carousel's own wiring — arrow labels, counter, live region — is testable.
 */
const mockScrollTo = jest.fn()
const mockScrollPrev = jest.fn()
const mockScrollNext = jest.fn()
const mockCanScrollPrev = jest.fn(() => true)
const mockCanScrollNext = jest.fn(() => true)
const mockSlidesInView = jest.fn(() => [0])
const mockOn = jest.fn()
const mockOff = jest.fn()

const fakeEmblaApi = {
  scrollTo: mockScrollTo,
  scrollPrev: mockScrollPrev,
  scrollNext: mockScrollNext,
  canScrollPrev: mockCanScrollPrev,
  canScrollNext: mockCanScrollNext,
  slidesInView: mockSlidesInView,
  on: mockOn,
  off: mockOff,
}

jest.mock("embla-carousel-react", () => ({
  __esModule: true,
  default: jest.fn(() => [jest.fn(), fakeEmblaApi]),
}))

jest.mock("embla-carousel-wheel-gestures", () => ({
  WheelGesturesPlugin: jest.fn(() => ({})),
}))

/** Land on `index` the way a real page, drag, or wheel scroll would. */
const settleOn = (index: number) => {
  mockSlidesInView.mockReturnValue([index])
  const settle = mockOn.mock.calls.find(([event]) => event === "settle")?.[1]
  act(() => settle())
}

const makeStudy = (org: string): CaseStudyItem => ({
  eyebrow: "INSTITUTIONAL SOLUTIONS",
  org,
  tagline: `${org} works with MIT`,
  stats: [{ value: "10+", label: `${org} participants` }],
  pillars: [
    {
      title: `${org} pillar`,
      body: "What this phase covers.",
      bullets: ["First step", "Second step"],
    },
  ],
})

const THREE_STUDIES = ["Study A", "Study B", "Study C"].map(makeStudy)

beforeEach(() => {
  jest.clearAllMocks()
  mockCanScrollPrev.mockReturnValue(true)
  mockCanScrollNext.mockReturnValue(true)
  mockSlidesInView.mockReturnValue([0])
})

describe("CaseStudiesSection", () => {
  test("renders the section heading and every study from copy", () => {
    renderWithProviders(<CaseStudiesSection />)

    expect(
      screen.getByRole("heading", { name: caseStudies.title }),
    ).toBeInTheDocument()
    expect(screen.getByText(caseStudies.body)).toBeInTheDocument()
    caseStudies.items.forEach((study) => {
      expect(
        screen.getByRole("heading", { name: study.org }),
      ).toBeInTheDocument()
    })
  })

  // Scoped to a single study: every study now shares the track, so copy that
  // repeats across studies (a "50+" stat, a shared pillar title) is ambiguous
  // at the section level.
  test("renders a study's tagline, stats, and pillars", () => {
    const [study] = caseStudies.items
    renderWithProviders(
      <CaseStudyCarousel items={[study]} label={caseStudies.navLabel} />,
    )

    expect(screen.getByRole("heading", { name: study.org })).toBeInTheDocument()
    expect(screen.getByText(study.tagline)).toBeInTheDocument()

    study.stats.forEach((stat) => {
      expect(screen.getByText(stat.value)).toBeInTheDocument()
      expect(screen.getByText(stat.label)).toBeInTheDocument()
    })
    study.pillars.forEach((pillar) => {
      expect(
        screen.getByRole("heading", { name: pillar.title }),
      ).toBeInTheDocument()
      pillar.bullets.forEach((bullet) => {
        expect(screen.getByText(bullet)).toBeInTheDocument()
      })
    })
  })

  test("ships anonymized: a descriptor rather than a named client, and no logo", () => {
    renderWithProviders(<CaseStudiesSection />)

    expect(
      screen.queryByText(/International Monetary Fund/i),
    ).not.toBeInTheDocument()
    const items: CaseStudyItem[] = caseStudies.items
    expect(items.every((study) => !study.logo)).toBe(true)
  })

  test("omits the logo frame for a study with no logo", () => {
    renderWithProviders(
      <CaseStudyCarousel
        items={[makeStudy("Anonymous Co")]}
        label="Case studies"
      />,
    )
    expect(document.querySelector("img")).toBeNull()
  })

  test("renders a decorative logo for a study that has one", () => {
    renderWithProviders(
      <CaseStudyCarousel
        items={[
          {
            ...makeStudy("Attributable Co"),
            logo: { src: "/images/test-logo.png", width: 100, height: 100 },
          },
        ]}
        label="Case studies"
      />,
    )
    // Decorative: the org name beside it already carries the identity.
    expect(document.querySelector("img")).toHaveAttribute("alt", "")
  })

  test("omits the navigation while there is only one study", () => {
    renderWithProviders(
      <CaseStudyCarousel items={[makeStudy("Solo")]} label="Case studies" />,
    )

    expect(
      screen.queryByRole("button", { name: /case study/i }),
    ).not.toBeInTheDocument()
    // No dead "1 / 1" counter, and nothing claims to be a carousel or a slide.
    expect(screen.queryByText("1 / 1")).not.toBeInTheDocument()
    expect(screen.queryByRole("group")).not.toBeInTheDocument()
  })
})

describe("CaseStudyCarousel with several studies", () => {
  const renderCarousel = () =>
    renderWithProviders(
      <CaseStudyCarousel items={THREE_STUDIES} label="Case studies" />,
    )

  const prevButton = () =>
    screen.getByRole("button", { name: "Previous case study" })
  const nextButton = () =>
    screen.getByRole("button", { name: "Next case study" })

  test("holds every study in one track and pages it with Embla", async () => {
    renderCarousel()

    THREE_STUDIES.forEach((study) => {
      expect(
        screen.getByRole("heading", { name: study.org }),
      ).toBeInTheDocument()
    })
    expect(screen.getByText("1 / 3")).toBeInTheDocument()

    await user.click(nextButton())
    expect(mockScrollNext).toHaveBeenCalledTimes(1)

    await user.click(prevButton())
    expect(mockScrollPrev).toHaveBeenCalledTimes(1)
  })

  test("counts up once the slide settles rather than on the click", async () => {
    renderCarousel()

    await user.click(nextButton())
    expect(screen.getByText("1 / 3")).toBeInTheDocument()

    settleOn(1)
    expect(screen.getByText("2 / 3")).toBeInTheDocument()
  })

  test("clamps at both ends rather than looping", () => {
    mockCanScrollPrev.mockReturnValue(false)
    renderCarousel()

    expect(prevButton()).toBeDisabled()
    expect(nextButton()).toBeEnabled()
  })

  test("announces the new position without moving focus off the control", async () => {
    renderCarousel()

    await user.click(nextButton())
    settleOn(1)

    expect(screen.getByText("2 of 3: Study B")).toBeInTheDocument()
    // Focus stays put so repeated paging does not require re-Tabbing.
    expect(nextButton()).toHaveFocus()
  })

  test("labels the carousel and its slides for assistive tech", () => {
    renderCarousel()

    expect(screen.getByRole("group", { name: "Case studies" })).toHaveAttribute(
      "aria-roledescription",
      "carousel",
    )
    THREE_STUDIES.forEach((study) => {
      expect(screen.getByRole("group", { name: study.org })).toHaveAttribute(
        "aria-roledescription",
        "slide",
      )
    })
  })
})
