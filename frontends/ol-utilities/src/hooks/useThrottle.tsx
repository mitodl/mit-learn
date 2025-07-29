import { useCallback, useRef } from "react"

export const useThrottle = <T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number,
) => {
  const lastRun = useRef(Date.now())

  return useCallback(
    (...args: Parameters<T>) => {
      if (Date.now() - lastRun.current >= delay) {
        callback(...args)
        lastRun.current = Date.now()
      }
    },
    [callback, delay],
  ) as T
}
