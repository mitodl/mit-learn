"use client"

import { useCallback, useRef } from "react"

export const useThrottle = <T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number,
) => {
  const lastRun = useRef<number | null>(null)

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      if (lastRun.current === null || now - lastRun.current >= delay) {
        callback(...args)
        lastRun.current = now
      }
    },
    [callback, delay],
  ) as T
}
