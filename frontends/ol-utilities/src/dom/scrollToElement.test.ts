import { scrollToElement, prefersReducedMotion } from "./scrollToElement"

/**
 * jsdom implements neither matchMedia nor scrollIntoView, so both are stubbed.
 * `setReducedMotion` mirrors the shape scrollToElement reads: a matchMedia that
 * reports `matches` for the reduced-motion query only.
 */
const setReducedMotion = (reduced: boolean) => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: reduced && query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })) as unknown as typeof window.matchMedia
}

const mountTarget = (id = "target", attrs = "") => {
  document.body.innerHTML = `<div id="${id}" ${attrs}>Form</div>`
  const target = document.getElementById(id) as HTMLElement
  target.scrollIntoView = jest.fn()
  return target
}

describe("prefersReducedMotion", () => {
  test.each([
    { reduced: true, expected: true },
    { reduced: false, expected: false },
  ])("returns $expected when reduce is $reduced", ({ reduced, expected }) => {
    setReducedMotion(reduced)
    expect(prefersReducedMotion()).toBe(expected)
  })

  test("returns false when matchMedia is unavailable", () => {
    // @ts-expect-error deliberately removing the API to assert the guard
    delete window.matchMedia
    expect(prefersReducedMotion()).toBe(false)
  })
})

describe("scrollToElement", () => {
  test("scrolls smoothly by default", () => {
    setReducedMotion(false)
    const target = mountTarget()

    scrollToElement("target")

    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    })
  })

  test("jumps instantly when the user prefers reduced motion", () => {
    setReducedMotion(true)
    const target = mountTarget()

    scrollToElement("target")

    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    })
  })

  test("moves focus to the target without a second scroll", () => {
    setReducedMotion(false)
    const target = mountTarget()
    const focus = jest.spyOn(target, "focus")

    scrollToElement("target")
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(document.activeElement).toBe(target)
  })

  test("makes a non-focusable target programmatically focusable", () => {
    setReducedMotion(false)
    const target = mountTarget()

    scrollToElement("target")

    // -1 keeps it reachable by script but out of the tab order.
    expect(target.getAttribute("tabindex")).toBe("-1")
  })

  test("leaves an existing tabindex alone", () => {
    setReducedMotion(false)
    const target = mountTarget("target", 'tabindex="0"')

    scrollToElement("target")

    expect(target.getAttribute("tabindex")).toBe("0")
  })

  test("leaves a naturally focusable target in the tab order", () => {
    setReducedMotion(false)
    document.body.innerHTML = '<button id="target">Go</button>'
    const target = document.getElementById("target") as HTMLElement
    target.scrollIntoView = jest.fn()

    scrollToElement("target")

    expect(target.hasAttribute("tabindex")).toBe(false)
    expect(document.activeElement).toBe(target)
  })

  test("does nothing when the id matches no element", () => {
    setReducedMotion(false)
    mountTarget()

    expect(() => scrollToElement("does-not-exist")).not.toThrow()
  })
})
