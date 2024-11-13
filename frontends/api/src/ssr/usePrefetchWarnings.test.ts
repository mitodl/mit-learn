import { renderHook } from "@testing-library/react"
import { useQuery } from "@tanstack/react-query"
import { usePrefetchWarnings } from "./usePrefetchWarnings"
import { setupReactQueryTest } from "../hooks/test-utils"
import { urls, factories, setMockResponse } from "../test-utils"
import {
  learningResourcesKeyFactory,
  useLearningResourcesDetail,
} from "../hooks/learningResources"

jest.mock("./usePrefetchWarnings", () => {
  const originalModule = jest.requireActual("./usePrefetchWarnings")
  return {
    ...originalModule,
    logQueries: jest.fn(),
  }
})

describe("SSR prefetch warnings", () => {
  beforeEach(() => {
    jest.spyOn(console, "info").mockImplementation(() => {})
    jest.spyOn(console, "table").mockImplementation(() => {})
  })

  it("Warns if a query is requested on the client that has not been prefetched", async () => {
    const { wrapper, queryClient } = setupReactQueryTest()

    const data = factories.learningResources.resource()
    setMockResponse.get(urls.learningResources.details({ id: 1 }), data)

    renderHook(() => useLearningResourcesDetail(1), { wrapper })

    renderHook(usePrefetchWarnings, {
      wrapper,
      initialProps: { queryClient },
    })

    expect(console.info).toHaveBeenCalledWith(
      "The following queries were requested in first render but not prefetched.",
      "If these queries are user-specific, they cannot be prefetched - responses are cached on public CDN.",
      "Otherwise, consider fetching on the server with prefetch:",
    )
    expect(console.table).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          disabled: false,
          initialStatus: "loading",
          key: learningResourcesKeyFactory.detail(1),
          observerCount: 1,
        }),
      ],
      ["hash", "initialStatus", "status", "observerCount", "disabled"],
    )
  })

  it("Ignores exempted queries requested on the client that have not been prefetched", async () => {
    const { wrapper, queryClient } = setupReactQueryTest()

    const data = factories.learningResources.resource()
    setMockResponse.get(urls.learningResources.details({ id: 1 }), data)

    renderHook(() => useLearningResourcesDetail(1), { wrapper })

    renderHook(usePrefetchWarnings, {
      wrapper,
      initialProps: {
        queryClient,
        exemptions: [["learningResources", "detail", 1]],
      },
    })

    expect(console.info).not.toHaveBeenCalled()
    expect(console.table).not.toHaveBeenCalled()
  })

  it("Warns for queries prefetched on the server but not requested on the client", async () => {
    const { wrapper, queryClient } = setupReactQueryTest()

    const data = factories.learningResources.resource()
    setMockResponse.get(urls.learningResources.details({ id: 1 }), data)

    // Emulate server prefetch
    const { unmount } = renderHook(
      () =>
        useQuery({
          ...learningResourcesKeyFactory.detail(1),
          initialData: data,
        }),
      { wrapper },
    )

    // Removes observer
    unmount()

    renderHook(usePrefetchWarnings, {
      wrapper,
      initialProps: { queryClient },
    })

    expect(console.info).toHaveBeenCalledWith(
      "The following queries were prefetched on the server but not accessed during initial render.",
      "If these queries are no longer in use they should removed from prefetch:",
    )
    expect(console.table).toHaveBeenCalledWith(
      [
        {
          disabled: false,
          hash: '["learningResources","detail",1]',
          initialStatus: "success",
          key: ["learningResources", "detail", 1],
          observerCount: 0,
          status: "success",
        },
      ],
      ["hash", "initialStatus", "status", "observerCount", "disabled"],
    )
  })
})
