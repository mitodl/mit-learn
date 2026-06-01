import React from "react"
import { waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { setMockResponse, makeRequest } from "../test-utils"

const setupReactQueryTest = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return { wrapper, queryClient }
}

type InfiniteHookResult = {
  isSuccess: boolean
  isFetching: boolean
  fetchNextPage: () => unknown
}

const paginatedPage = (next: string | null) => ({
  count: 0,
  next,
  previous: null,
  results: [],
})

/**
 * Assert that an infinite hook normalizes a paginated `next` URL to a relative
 * request against the configured axios baseURL.
 *
 * The API has been observed to return `next` with the wrong origin/port for
 * RC/PROD (https://github.com/mitodl/hq/issues/10999); the hooks pass `next`
 * through `toRelativeApiUrl` to drop that origin. Here page 1's `next` carries
 * a foreign origin, but the page-2 request must hit `secondUrl` (the
 * configured-base URL) — not the foreign one.
 */
const assertNormalizesPaginationNext = async ({
  firstUrl,
  secondUrl,
  renderInfiniteHook,
}: {
  firstUrl: string
  secondUrl: string
  renderInfiniteHook: (
    wrapper: React.ComponentType<{ children: React.ReactNode }>,
  ) => { result: { current: InfiniteHookResult } }
}) => {
  const { pathname, search } = new URL(secondUrl)
  setMockResponse.get(
    firstUrl,
    paginatedPage(`https://learn.example.edu${pathname}${search}`),
  )
  setMockResponse.get(secondUrl, paginatedPage(null))

  const { wrapper } = setupReactQueryTest()
  const { result } = renderInfiniteHook(wrapper)

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  result.current.fetchNextPage()
  await waitFor(() => expect(result.current.isFetching).toBe(false))

  expect(makeRequest).toHaveBeenCalledWith(
    expect.objectContaining({ method: "get", url: secondUrl }),
  )
}

export { setupReactQueryTest, assertNormalizesPaginationNext }
