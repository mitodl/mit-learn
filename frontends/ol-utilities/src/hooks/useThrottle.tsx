import { useCallback, useRef } from "react"

export const useThrottle = (callback: Function, delay: number) => {
  const lastRun = useRef(Date.now())

  return useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (...args: any[]) => {
      if (Date.now() - lastRun.current >= delay) {
        callback(...args)
        lastRun.current = Date.now()
      }
    },
    [callback, delay],
  )
}
