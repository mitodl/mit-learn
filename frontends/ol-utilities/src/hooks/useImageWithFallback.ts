"use client"

import { useState, useCallback } from "react"
import type { SyntheticEvent } from "react"

/**
 * - "optimized": `src` through the Next.js image optimizer
 * - "original": `src` loaded directly by the browser (`unoptimized`)
 * - "fallback": the fallback image
 */
type Stage = "optimized" | "original" | "fallback"

const isSameUrl = (src: string, loaded: string) => {
  try {
    return new URL(src, loaded).href === loaded
  } catch {
    return false
  }
}

/**
 * Returns image `src`, `unoptimized` and `onError` for a Next.js `<Image>`,
 * falling back first to the original image and then to `fallback`.
 *
 * The optimizer fetches remote images server-side, which some hosts block
 * (e.g. bot protection returning 403) even though browsers can load them. So
 * when the optimized image fails, retry `src` unoptimized before giving up.
 * Pass all three values to the image.
 */
const initialStage = (src: string | null | undefined): Stage =>
  src ? "optimized" : "fallback"

const useImageWithFallback = (
  src: string | null | undefined,
  fallback: string,
) => {
  // The stage reached by the `src` that last failed. A different `src` starts
  // over, derived during render so a new `src` never renders with the old
  // `src`'s stage.
  const [failure, setFailure] = useState<{ src: typeof src; stage: Stage }>()
  const stage =
    failure && failure.src === src ? failure.stage : initialStage(src)

  const onError = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      // Next.js serves some images unoptimized regardless (e.g. SVGs and data:
      // URLs). If the image that failed was already the original, retrying it
      // would render the same <img> and never error again, so skip ahead.
      const wasOriginal = !!src && isSameUrl(src, event.currentTarget.src)
      setFailure((cur) => {
        const current = cur && cur.src === src ? cur.stage : initialStage(src)
        return {
          src,
          stage:
            current === "optimized" && !wasOriginal ? "original" : "fallback",
        }
      })
    },
    [src],
  )

  return {
    src: stage === "fallback" || !src ? fallback : src,
    unoptimized: stage === "original",
    onError,
  }
}

export { useImageWithFallback }
