import { useEffect, useState } from "react"
import type { Query, QueryClient, QueryKey } from "@tanstack/react-query"
import { useMounted } from "./useMounted"

const logQueries = (...args: [...string[], Query[]]) => {
  const queries = args.pop() as Query[]
  console.info(...args)
  console.table(
    queries.map((query) => ({
      key: query.queryKey,
      hash: query.queryHash,
      disabled: query.isDisabled(),
      initialStatus: query.initialState.status,
      status: query.state.status,
      observerCount: query.getObserversCount(),
    })),
    ["hash", "initialStatus", "status", "observerCount", "disabled"],
  )
}

const PREFETCH_EXEMPT_QUERIES = [
  ["userMe"],
  ["userLists", "membershipList", "membershipList"],
  ["learningPaths", "membershipList", "membershipList"],
]

const RETRIES = process.env.JEST_WORKER_ID ? 1 : 10

/**
 * Call this as high as possible in render tree to detect query usage on
 * first render.
 */
export const usePrefetchWarnings = ({
  queryClient,
  exemptions = [],
}: {
  queryClient: QueryClient
  /**
   * A list of query keys that should be exempted.
   *
   * NOTE: This uses react-query's hierarchical key matching, so exempting
   * ["a", { x: 1 }] will exempt
   *  - ["a", { x: 1 }]
   *  - ["a", { x: 1, y: 2 }]
   *  - ["a", { x: 1, y: 2 }, ...any_other_entries]
   */
  exemptions?: QueryKey[]
}) => {
  const mounted = useMounted()
  const [count, setCount] = useState(0)
  const [potentialWarnings, setPotentialWarnings] = useState(true)

  useEffect(() => {
    if ((potentialWarnings && count < RETRIES) || count === RETRIES - 1) {
      setTimeout(() => setCount(count + 1), 250)
    }
  }, [count, potentialWarnings])

  /**
   * NOTE: React renders components top-down, but effects run bottom-up, so
   * this effect will run after all child effects.
   */
  useEffect(
    () => {
      if (process.env.NODE_ENV === "production" || !mounted) {
        return
      }

      const cache = queryClient.getQueryCache()
      const queries = cache.getAll()

      const exempted = [...exemptions, ...PREFETCH_EXEMPT_QUERIES].map((key) =>
        cache.find(key),
      )

      const potentialPrefetches = queries.filter(
        (query) =>
          !exempted.includes(query) &&
          query.initialState.status !== "success" &&
          !query.isDisabled(),
      )

      if (potentialPrefetches.length > 0 && count === RETRIES) {
        logQueries(
          "The following queries were requested in first render but not prefetched.",
          "If these queries are user-specific, they cannot be prefetched - responses are cached on public CDN.",
          "Otherwise, consider fetching on the server with prefetch:",
          potentialPrefetches,
        )
      }

      const unusedPrefetches = queries.filter(
        (query) =>
          !exempted.includes(query) &&
          query.initialState.status === "success" &&
          query.getObserversCount() === 0 &&
          !query.isDisabled(),
      )

      if (unusedPrefetches.length > 0 && count === RETRIES) {
        logQueries(
          "The following queries were prefetched on the server but not accessed during initial render.",
          "If these queries are no longer in use they should removed from prefetch:",
          unusedPrefetches,
        )
      }

      setPotentialWarnings(
        potentialPrefetches.length > 0 || unusedPrefetches.length > 0,
      )
    },
    // We only want to run this on initial render.
    // (Aside: queryClient should be a singleton anyway)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, count],
  )
}
