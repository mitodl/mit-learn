"use client"

import { useState, useEffect, useCallback } from "react"

const useImageWithFallback = (
  src: string | null | undefined,
  fallback: string,
) => {
  const [resolvedSrc, setResolvedSrc] = useState(src ?? fallback)

  useEffect(() => {
    setResolvedSrc(src ?? fallback)
  }, [src, fallback])

  const onError = useCallback(() => {
    setResolvedSrc((current) => (current === fallback ? current : fallback))
  }, [fallback])

  return { src: resolvedSrc, onError }
}

export { useImageWithFallback }
