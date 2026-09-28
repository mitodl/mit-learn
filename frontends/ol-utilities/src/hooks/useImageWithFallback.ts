"use client"

import { useState, useEffect, useCallback } from "react"

/**
 * - "optimized": `src` through the Next.js image optimizer
 * - "original": `src` loaded directly by the browser (`unoptimized`)
 * - "fallback": the fallback image
 */
type Stage = "optimized" | "original" | "fallback"

/**
 * Returns image `src`, `unoptimized` and `onError` for a Next.js `<Image>`,
 * falling back first to the original image and then to `fallback`.
 *
 * The optimizer fetches remote images server-side, which some hosts block
 * (e.g. bot protection returning 403) even though browsers can load them. So
 * when the optimized image fails, retry `src` unoptimized before giving up.
 * Pass all three values to the image.
 */
const useImageWithFallback = (
  src: string | null | undefined,
  fallback: string,
) => {
  const [stage, setStage] = useState<Stage>(src ? "optimized" : "fallback")

  useEffect(() => {
    setStage(src ? "optimized" : "fallback")
  }, [src])

  const onError = useCallback(() => {
    setStage((current) => (current === "optimized" ? "original" : "fallback"))
  }, [])

  return {
    src: stage === "fallback" || !src ? fallback : src,
    unoptimized: stage === "original",
    onError,
  }
}

export { useImageWithFallback }
