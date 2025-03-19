import { useEffect } from "react"

/**
 * Returns the distance between visible content and the bottom of the element.
 */
const distanceFromBottom = (el: HTMLElement) => {
  return el.scrollHeight - el.clientHeight - el.scrollTop
}

/**
 * Scrolls to the bottom of the element.
 */
const scrollToBottom = (el: HTMLElement) => {
  el.scrollTop = el.scrollHeight
}

const useScrollSnap = ({
  scrollElement,
  contentElement,
  threshold = 2,
}: {
  scrollElement: HTMLElement | null
  contentElement?: HTMLElement | null
  threshold?: number
}) => {
  useEffect(() => {
    const onGrow = () => {
      if (!scrollElement) return
      if (distanceFromBottom(scrollElement) < threshold) {
        scrollToBottom(scrollElement)
      }
    }
    onGrow()
    const resizeObserver = new ResizeObserver(onGrow)

    if (contentElement) {
      resizeObserver.observe(contentElement)
    }
    return () => {
      resizeObserver.disconnect()
    }
  }, [scrollElement, contentElement, threshold])
}

export { useScrollSnap }
