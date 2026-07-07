import React from "react"
import ResourceCarousel from "./ResourceCarousel"
import type { ResourceCarouselProps } from "./ResourceCarousel"
import { act, renderWithProviders, screen } from "@/test-utils"
import { factories, setMockResponse, urls } from "api/test-utils"

/**
 * The Prev/Next buttons page by a full viewport via Embla, which leaves DOM
 * focus on the button. When the scroll settles, ResourceCarousel moves its
 * single roving tab stop onto the first now-visible card and announces the new
 * position for screen reader users. Embla can't compute slides-in-view in the
 * zero-size fake DOM, so CarouselV2 is mocked here to drive `onSettle`
 * directly (the real CarouselV2 -> onSettle contract is covered in
 * ol-components/.../CarouselV2.test.tsx).
 */
const mockCarousel: { onSettle?: (slidesInView: number[]) => void } = {}

jest.mock("ol-components/CarouselV2", () => ({
  __esModule: true,
  CarouselV2: ({
    children,
    onSettle,
  }: {
    children: React.ReactNode
    onSettle?: (slidesInView: number[]) => void
  }) => {
    mockCarousel.onSettle = onSettle
    return <div data-testid="mock-carousel">{children}</div>
  },
}))

const setupApis = (count: number) => {
  const resources = factories.learningResources.resources({ count })
  setMockResponse.get(urls.userMe.get(), { is_authenticated: true })
  setMockResponse.get(urls.userLists.membershipList(), [])
  setMockResponse.get(urls.learningPaths.membershipList(), [])
  setMockResponse.get(
    expect.stringContaining(urls.learningResources.list()),
    resources,
  )
  return resources
}

const renderCarousel = async (count: number) => {
  const config: ResourceCarouselProps["config"] = [
    {
      label: "Resources",
      data: { type: "resources", params: { resource_type: ["course"] } },
    },
  ]
  const resources = setupApis(count)
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
  await screen.findByText(resources.results[0].title)
  const getSlides = () => screen.getAllByRole("group", { name: /^\d+ of \d+:/ })
  return { resources, getSlides }
}

describe("ResourceCarousel button paging (onSettle sync + announcement)", () => {
  beforeEach(() => {
    mockCarousel.onSettle = undefined
  })

  it("moves the single roving tab stop onto the first visible card when the scroll settles", async () => {
    const { getSlides } = await renderCarousel(8)
    const slides = getSlides()

    expect(slides[0]).toHaveAttribute("tabindex", "0")

    // Simulate a full-viewport page settling with cards 5-8 (indices 4-7) now
    // in view.
    act(() => mockCarousel.onSettle?.([4, 5, 6, 7]))

    expect(slides[0]).toHaveAttribute("tabindex", "-1")
    expect(slides[4]).toHaveAttribute("tabindex", "0")
    slides.forEach((slide, index) => {
      expect(slide).toHaveAttribute("tabindex", index === 4 ? "0" : "-1")
    })
  })

  it("announces the new position via a polite live region when the scroll settles", async () => {
    const { resources, getSlides } = await renderCarousel(8)
    getSlides()

    const liveRegion = document.querySelector("[aria-live='polite']")
    expect(liveRegion).toBeInTheDocument()

    act(() => mockCarousel.onSettle?.([4, 5, 6, 7]))

    expect(liveRegion).toHaveTextContent(
      `5 of 8: ${resources.results[4].title}`,
    )
  })

  it("does not move the tab stop when the active card is still in view (e.g. arrow-key navigation, small drags)", async () => {
    const { getSlides } = await renderCarousel(8)
    const slides = getSlides()

    // Active card (index 0) remains among the visible slides, so a settle must
    // not yank the tab stop off it.
    act(() => mockCarousel.onSettle?.([0, 1, 2, 3]))

    expect(slides[0]).toHaveAttribute("tabindex", "0")
    expect(slides[1]).toHaveAttribute("tabindex", "-1")
  })

  it("ignores a settle that reports no slides in view", async () => {
    const { getSlides } = await renderCarousel(8)
    const slides = getSlides()

    act(() => mockCarousel.onSettle?.([]))

    expect(slides[0]).toHaveAttribute("tabindex", "0")
  })
})
