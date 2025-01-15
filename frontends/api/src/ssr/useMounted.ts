import { useEffect, useState } from "react"

/*
 * Intended for cases where the client content would otherwise be different
 * from the server content on the first render pass in the browser and therefore
 * cause a hydration mismatch error. We've seen this for example when lazy loading
 * components with next/dynamic, whuch produces a race condition with client only /
 * session based API responses.
 *
 * https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content
 */
export const useMounted = () => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    return () => {
      setMounted(false)
    }
  }, [])

  return mounted
}
