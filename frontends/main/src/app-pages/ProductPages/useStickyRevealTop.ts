import { useEffect, useRef } from "react"

/**
 * Positions a `position: sticky` element so that, when it's taller than the
 * viewport, it scrolls up with the page until its bottom edge reaches the
 * viewport bottom and then sticks there - keeping its lower content (e.g. a
 * CTA) reachable without an internal scrollbar or a scroll listener.
 *
 * The browser's native sticky positioning does all the scroll-time work; this
 * only sets the sticky `top` offset, recomputing on resize and when the
 * element's own content changes size:
 *
 *   top = min(defaultOffset, viewportHeight - elementHeight)
 *
 * - Fits in viewport at `defaultOffset` -> `defaultOffset` (unchanged from before).
 * - Otherwise -> a (possibly negative) offset that lands the element's bottom at the
 *   viewport bottom once stuck.
 */
export const useStickyRevealTop = (defaultOffset: number) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      const top = Math.min(defaultOffset, window.innerHeight - el.offsetHeight)
      el.style.top = `${top}px`
    }

    update()
    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(el)
    window.addEventListener("resize", update)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [defaultOffset])

  return ref
}
