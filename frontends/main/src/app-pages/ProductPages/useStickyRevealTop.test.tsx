import React from "react"
import { render, screen, act } from "@testing-library/react"
import { useStickyRevealTop } from "./useStickyRevealTop"

const setInnerHeight = (height: number) => {
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: height,
  })
}

const setOffsetHeight = (el: HTMLElement, height: number) => {
  Object.defineProperty(el, "offsetHeight", {
    configurable: true,
    value: height,
  })
}

class FakeVisualViewport extends EventTarget {
  height: number
  constructor(height: number) {
    super()
    this.height = height
  }
}

const TestComponent: React.FC<{ defaultOffset: number }> = ({
  defaultOffset,
}) => {
  const ref = useStickyRevealTop(defaultOffset)
  return <div ref={ref} data-testid="sticky-el" />
}

describe("useStickyRevealTop", () => {
  afterEach(() => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: undefined,
    })
  })

  it("uses defaultOffset when the element fits within the viewport", () => {
    setInnerHeight(800)
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      value: 300,
    })
    render(<TestComponent defaultOffset={100} />)
    expect(screen.getByTestId("sticky-el").style.top).toBe("100px")
  })

  it("uses a negative offset when the element is taller than the viewport", () => {
    setInnerHeight(400)
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      value: 500,
    })
    render(<TestComponent defaultOffset={100} />)
    // min(100, 400 - 500) = -100
    expect(screen.getByTestId("sticky-el").style.top).toBe("-100px")
  })

  it("recomputes top on window resize", () => {
    setInnerHeight(800)
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      value: 300,
    })
    render(<TestComponent defaultOffset={100} />)
    const el = screen.getByTestId("sticky-el")
    expect(el.style.top).toBe("100px")

    setInnerHeight(350)
    setOffsetHeight(el, 500)
    act(() => {
      window.dispatchEvent(new Event("resize"))
    })
    // min(100, 350 - 500) = -150
    expect(el.style.top).toBe("-150px")
  })

  it("uses visualViewport height, not window.innerHeight, when available", () => {
    setInnerHeight(800)
    const visualViewport = new FakeVisualViewport(300)
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: visualViewport,
    })
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      value: 500,
    })
    render(<TestComponent defaultOffset={100} />)
    // min(100, 300 - 500) = -200; if window.innerHeight (800) were used
    // instead this would be 100.
    expect(screen.getByTestId("sticky-el").style.top).toBe("-200px")
  })

  it("recomputes top when visualViewport fires resize (e.g. mobile URL bar show/hide)", () => {
    setInnerHeight(800)
    const visualViewport = new FakeVisualViewport(300)
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: visualViewport,
    })
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      value: 500,
    })
    render(<TestComponent defaultOffset={100} />)
    expect(screen.getByTestId("sticky-el").style.top).toBe("-200px")

    visualViewport.height = 450
    act(() => {
      visualViewport.dispatchEvent(new Event("resize"))
    })
    // min(100, 450 - 500) = -50
    expect(screen.getByTestId("sticky-el").style.top).toBe("-50px")
  })
})
