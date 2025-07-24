import { useCallback, useRef } from "react"

export const useThrottle = (
  callback: (...args: unknown[]) => void,
  delay: number,
) => {
  const lastRun = useRef(Date.now())

  return useCallback(
    (...args: unknown[]) => {
      if (Date.now() - lastRun.current >= delay) {
        callback(...args)
        lastRun.current = Date.now()
      }
    },
    [callback, delay],
  )
}
