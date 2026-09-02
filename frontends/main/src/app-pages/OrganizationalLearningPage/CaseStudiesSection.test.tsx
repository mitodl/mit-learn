import React from "react"
import { renderWithProviders, screen, user } from "@/test-utils"
import CaseStudiesSection, { CaseStudyCarousel } from "./CaseStudiesSection"
import { caseStudies } from "./copy"
import type { CaseStudyItem } from "./copy"

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

describe("CaseStudiesSection", () => {
  test("renders the study from copy", () => {
    renderWithProviders(<CaseStudiesSection />)
    const [study] = caseStudies.items

    expect(
      screen.getByRole("heading", { name: caseStudies.title }),
    ).toBeInTheDocument()
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

  test("shows one study at a time and pages forward", async () => {
    renderCarousel()

    expect(screen.getByRole("heading", { name: "Study A" })).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Study B" }),
    ).not.toBeInTheDocument()
    expect(screen.getByText("1 / 3")).toBeInTheDocument()

    await user.click(nextButton())

    expect(screen.getByRole("heading", { name: "Study B" })).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Study A" }),
    ).not.toBeInTheDocument()
    expect(screen.getByText("2 / 3")).toBeInTheDocument()
  })

  test("clamps at both ends rather than looping", async () => {
    renderCarousel()

    expect(prevButton()).toBeDisabled()
    expect(nextButton()).toBeEnabled()

    await user.click(nextButton())
    await user.click(nextButton())

    expect(screen.getByRole("heading", { name: "Study C" })).toBeInTheDocument()
    expect(nextButton()).toBeDisabled()
    expect(prevButton()).toBeEnabled()

    await user.click(prevButton())

    expect(screen.getByRole("heading", { name: "Study B" })).toBeInTheDocument()
    expect(nextButton()).toBeEnabled()
  })

  test("announces the new position without moving focus off the control", async () => {
    renderCarousel()

    await user.click(nextButton())

    expect(screen.getByText("2 of 3: Study B")).toBeInTheDocument()
    // Focus stays put so repeated paging does not require re-Tabbing.
    expect(nextButton()).toHaveFocus()
  })

  test("labels the carousel and its slides for assistive tech", async () => {
    renderCarousel()

    expect(screen.getByRole("group", { name: "Case studies" })).toHaveAttribute(
      "aria-roledescription",
      "carousel",
    )
    expect(screen.getByRole("group", { name: "Study A" })).toHaveAttribute(
      "aria-roledescription",
      "slide",
    )

    await user.click(nextButton())

    expect(screen.getByRole("group", { name: "Study B" })).toBeInTheDocument()
  })
})
