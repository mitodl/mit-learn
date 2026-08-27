import React from "react"
import { setMockResponse, urls } from "api/test-utils"
import { assertHeadings } from "ol-test-utilities"
import { scrollToElement } from "ol-utilities"
import { renderWithProviders, screen, user, waitFor } from "@/test-utils"
import OrganizationalLearningPage from "./OrganizationalLearningPage"
import {
  hero,
  featuredProgram,
  offerings,
  deliveryFormats,
  continuum,
  faq,
  getInTouch,
} from "./copy"

jest.mock("ol-utilities", () => ({
  ...jest.requireActual("ol-utilities"),
  scrollToElement: jest.fn(),
}))

const mockScrollToElement = jest.mocked(scrollToElement)

const setupApis = () => {
  setMockResponse.get(urls.userMe.get(), {})
}

describe("OrganizationalLearningPage", () => {
  beforeEach(() => {
    setupApis()
    mockScrollToElement.mockClear()
  })

  test("renders every in-scope section", () => {
    renderWithProviders(<OrganizationalLearningPage />)

    // Asserted by heading rather than by copy string so a marketing rewrite
    // does not break the test — what matters is that no section went missing.
    const sectionHeadings = [
      hero.title,
      featuredProgram.title,
      offerings.title,
      deliveryFormats.title,
      continuum.title,
      faq.title,
      getInTouch.title,
    ]
    sectionHeadings.forEach((heading) => {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument()
    })
  })

  test("omits the Clients section, whose content is not approved to ship", () => {
    renderWithProviders(<OrganizationalLearningPage />)
    expect(
      screen.queryByText(/See how organizations turn learning into impact/i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/TRUSTED BY LEADING ORGANIZATIONS/i),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/SUCCESS STORIES/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/International Monetary Fund/i),
    ).not.toBeInTheDocument()
  })

  test("has one h1 and no skipped heading levels", () => {
    renderWithProviders(<OrganizationalLearningPage />)

    assertHeadings([
      { level: 1, name: hero.title },
      { level: 2, name: featuredProgram.title },
      { level: 2, name: offerings.title },
      ...offerings.cards.map((card) => ({ level: 3, name: card.title })),
      { level: 3, name: offerings.flexibleSolutions.title },
      { level: 2, name: deliveryFormats.title },
      ...deliveryFormats.items.map((item) => ({ level: 3, name: item.title })),
      { level: 2, name: continuum.title },
      ...continuum.steps.map((step) => ({ level: 3, name: step.title })),
      { level: 2, name: faq.title },
      // MUI renders each AccordionSummary inside an h3, which is the
      // recommended shape for an FAQ: every question is a heading.
      ...faq.items.map((item) => ({ level: 3, name: item.question })),
      { level: 2, name: getInTouch.title },
    ])
  })

  test("every section CTA scrolls to the form", async () => {
    renderWithProviders(<OrganizationalLearningPage />)

    const ctas = screen.getAllByRole("button", {
      name: new RegExp(`${hero.ctaLabel}|${offerings.ctaLabel}`, "i"),
    })
    // Hero, featured program, offerings, delivery formats.
    expect(ctas).toHaveLength(4)

    for (const cta of ctas) {
      await user.click(cta)
    }

    await waitFor(() =>
      expect(mockScrollToElement).toHaveBeenCalledTimes(ctas.length),
    )
    // All of them land on the same anchor — the form is the single destination.
    mockScrollToElement.mock.calls.forEach(([id]) => {
      expect(id).toBe("get-in-touch")
    })
  })

  test("renders every FAQ question, collapsed", () => {
    renderWithProviders(<OrganizationalLearningPage />)

    faq.items.forEach((item) => {
      expect(
        screen.getByRole("button", { name: item.question }),
      ).toHaveAttribute("aria-expanded", "false")
    })
  })

  test("opening one FAQ answer leaves the others closed", async () => {
    renderWithProviders(<OrganizationalLearningPage />)

    const [first, second] = faq.items
    await user.click(screen.getByRole("button", { name: first.question }))

    expect(
      screen.getByRole("button", { name: first.question }),
    ).toHaveAttribute("aria-expanded", "true")
    // Independent rows: comparing two answers should not close the first.
    expect(
      screen.getByRole("button", { name: second.question }),
    ).toHaveAttribute("aria-expanded", "false")
  })
})
