/**
 * Detects if the user has asked the OS to reduce motion.
 *
 * Read at call time rather than via a hook: callers here act imperatively from
 * an event handler, so there is nothing to re-render when the setting changes.
 * Guards `matchMedia` because jsdom did not implement it until recently and
 * some test environments still stub `window` without it.
 */
export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * Scrolls an element into view and moves keyboard focus to it.
 *
 * This function calls the browser's native `Element.scrollIntoView()` method
 * internally, but adds two behaviors that the native method doesn't provide:
 *
 * 1. Reduced motion. Smooth scrolling can trigger vestibular disorders, so if
 *    the OS requests reduced motion, this function jumps instantly instead of
 *    scrolling smoothly.
 * 2. Focus. The native `scrollIntoView()` moves the viewport but leaves focus
 *    behind. If focus doesn't move too, a keyboard or screen reader user who
 *    activates a "jump to the form" control stays where they were while the
 *    page moves under them. This function moves focus to the target element
 *    using `preventScroll` so the focus call doesn't trigger its own scroll
 *    and fight the one this function performs. If the target isn't already
 *    focusable, this function adds `tabindex="-1"` to make it focusable
 *    without adding it to the tab order — the standard skip-link technique.
 *
 * If no element matches `elementId`, this function does nothing. This lets
 * callers link to a section that a feature flag or conditional branch hasn't
 * rendered.
 */
export const scrollToElement = (elementId: string): void => {
  if (typeof document === "undefined") return

  const target = document.getElementById(elementId)
  if (!target) return

  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1")
  }
  target.focus({ preventScroll: true })

  target.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  })
}
