import React from "react"
import { screen } from "@testing-library/react"
import user from "@testing-library/user-event"
import { renderWithTheme } from "../../test-utils"
import { CarouselV2 } from "./CarouselV2"

/**
 * Embla determines slide positions/overflow from real element widths via
 * getBoundingClientRect, which jsdom/happy-dom always report as zero. That
 * makes canScrollPrev/canScrollNext (and therefore the Previous/Next
 * buttons' disabled state) unreliable in tests, so Embla is mocked here to
 * exercise CarouselV2's own logic directly.
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

describe("CarouselV2", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCanScrollPrev.mockReturnValue(true)
    mockCanScrollNext.mockReturnValue(true)
    mockSlidesInView.mockReturnValue([0])
  })

  it("scrolls by a full page via Embla when the Previous/Next buttons are clicked", async () => {
    renderWithTheme(
      <CarouselV2>
        <div>slide</div>
      </CarouselV2>,
    )

    await user.click(screen.getByRole("button", { name: "Show next slides" }))
    expect(mockScrollNext).toHaveBeenCalledTimes(1)

    await user.click(
      screen.getByRole("button", { name: "Show previous slides" }),
    )
    expect(mockScrollPrev).toHaveBeenCalledTimes(1)
  })

  it("calls onSettle with the slides currently in view when the carousel settles", () => {
    const onSettle = jest.fn()
    renderWithTheme(
      <CarouselV2 onSettle={onSettle}>
        <div>slide</div>
      </CarouselV2>,
    )

    // CarouselV2 subscribes to Embla's "settle" event; grab that listener and
    // fire it to simulate a scroll (button page, drag, or wheel) settling.
    const settleListener = mockOn.mock.calls.find(
      ([event]) => event === "settle",
    )?.[1]
    expect(settleListener).toBeDefined()

    onSettle.mockClear()
    mockSlidesInView.mockReturnValue([4, 5, 6, 7])
    settleListener()

    expect(onSettle).toHaveBeenCalledWith([4, 5, 6, 7])
  })

  it("scrolls to the active index via Embla when it changes and is not already in view", () => {
    mockSlidesInView.mockReturnValue([0])
    const { rerender } = renderWithTheme(
      <CarouselV2 activeIndex={0}>
        <div>slide</div>
      </CarouselV2>,
    )
    mockScrollTo.mockClear()

    rerender(
      <CarouselV2 activeIndex={3}>
        <div>slide</div>
      </CarouselV2>,
    )
    expect(mockScrollTo).toHaveBeenCalledWith(3)
  })
})
