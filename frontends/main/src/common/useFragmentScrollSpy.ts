import { useEffect, useMemo, useState } from "react"

type UseFragmentScrollSpy = {
  /** Percentage of element that must be visible to be considered active */
  threshold?: number
  /** Alters the portion of viewport (or root element) used for intersecting  */
  rootMargin?: string
}

const DEFAULT_OPTS: UseFragmentScrollSpy = {
  threshold: 0,
}

/**
 * Custom hook that tracks which fragment (URL hash target) is currently visible
 * in the viewport using IntersectionObserver. Returns the ID of the active fragment.
 *
 * If multiple fragments are intersecting, the topmost one is considered active.
 *
 * NOTE: Assumes target elements are stable and not re-mounted on the DOM
 * after initial render.
 *
 * @param fragmentIds - Array of element IDs to observe (without the # prefix)
 * @param options - Optional configuration for the intersection observer
 * @returns The ID of the currently active fragment, or null if none are active
 *
 * @example
 * const activeFragment = useFragmentScrollSpy(['about', 'features', 'pricing'])
 * // Returns 'features' when the element with id="features" is in view
 */
export const useFragmentScrollSpy = (
  fragmentIds: string[],
  options: UseFragmentScrollSpy = DEFAULT_OPTS,
): string | null => {
  const opts = { ...DEFAULT_OPTS, ...options }
  const [activeFragment, setActiveFragment] = useState<string | null>(null)

  const stableIds = useMemo(
    () => fragmentIds,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fragmentIds.join(",")],
  )

  useEffect(() => {
    if (stableIds.length === 0 || !window.IntersectionObserver) {
      return
    }

    const observerOptions: IntersectionObserverInit = {
      threshold: opts.threshold,
      rootMargin: opts.rootMargin,
    }

    // Track which fragments are currently intersecting
    const intersectingEntries = new Map<string, IntersectionObserverEntry>()

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const fragmentId = entry.target.id

        if (entry.isIntersecting) {
          intersectingEntries.set(fragmentId, entry)
        } else {
          intersectingEntries.delete(fragmentId)
        }
      })

      // Find the topmost intersecting fragment
      if (intersectingEntries.size > 0) {
        const sorted = Array.from(intersectingEntries.values()).sort((a, b) => {
          return a.boundingClientRect.top - b.boundingClientRect.top
        })
        setActiveFragment(sorted[0].target.id)
      }
      // Keep the previous active fragment if nothing is currently intersecting
    }, observerOptions)

    const elements: Element[] = []
    stableIds.forEach((id) => {
      const element = document.getElementById(id)
      if (element) {
        observer.observe(element)
        elements.push(element)
      }
    })

    return () => {
      elements.forEach((element) => observer.unobserve(element))
    }
  }, [stableIds, opts.threshold, opts.rootMargin])

  return activeFragment
}
