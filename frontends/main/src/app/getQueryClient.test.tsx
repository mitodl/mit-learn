import React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { allowConsoleErrors } from "ol-test-utilities"
import { QueryClientProvider, useQuery } from "@tanstack/react-query"
import { makeBrowserQueryClient, getServerQueryClient } from "./getQueryClient"
import { nextNavigationMocks } from "ol-test-utilities/mocks/nextNavigation"
import type { AxiosError, AxiosResponse } from "axios"

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query")
  return {
    ...actual,
    isServer: true,
  }
})

const getWrapper = () => {
  const queryClient = makeBrowserQueryClient()
  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return wrapper
}

test.each([
  { status: 0, retries: 3 },
  { status: 404, retries: 0 },
  { status: 405, retries: 0 },
  { status: 408, retries: 3 },
  { status: 409, retries: 0 },
  { status: 422, retries: 0 },
  { status: 429, retries: 3 },
  { status: 502, retries: 3 },
  { status: 503, retries: 3 },
  { status: 504, retries: 3 },
])(
  "should retry $status failures $retries times",
  async ({ status, retries }) => {
    allowConsoleErrors()
    const wrapper = getWrapper()
    const queryFn = jest.fn().mockRejectedValue({ response: { status } })

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ["test"],
          queryFn,
          retryDelay: 0,
        }),
      { wrapper },
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(queryFn).toHaveBeenCalledTimes(retries + 1)
  },
)

describe("refetching stale queries on visibilitychange and focus", () => {
  let visibilityStateMock: jest.SpyInstance, documentHasFocus: jest.SpyInstance
  beforeAll(() => {
    visibilityStateMock = jest.spyOn(document, "visibilityState", "get")
    documentHasFocus = jest.spyOn(document, "hasFocus")
  })
  afterAll(() => {
    visibilityStateMock.mockRestore()
    documentHasFocus.mockRestore()
  })

  const fireVisibilityChange = (state: "visible" | "hidden") => {
    return act(() => {
      visibilityStateMock.mockReturnValue(state)
      window.dispatchEvent(new Event("visibilitychange"))
      return new Promise((res) => setTimeout(res, 0))
    })
  }
  const fireWindow = {
    blur: () => {
      return act(() => {
        documentHasFocus.mockReturnValue(false)
        window.dispatchEvent(new Event("blur"))
        return new Promise((res) => setTimeout(res, 0))
      })
    },
    focus: () => {
      return act(() => {
        documentHasFocus.mockReturnValue(true)
        window.dispatchEvent(new Event("focus"))
        return new Promise((res) => setTimeout(res, 0))
      })
    },
  }

  test("should refetch stale queries on window focus", async () => {
    const wrapper = getWrapper()
    const queryFn = jest.fn().mockResolvedValue({ message: "hi" })

    renderHook(() => useQuery({ queryKey: ["test"], queryFn, staleTime: 0 }), {
      wrapper,
    })

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalledTimes(1)
    })

    await fireWindow.blur()
    expect(queryFn).toHaveBeenCalledTimes(1)
    await fireWindow.focus()
    expect(queryFn).toHaveBeenCalledTimes(2)
    await fireWindow.focus()
    expect(queryFn).toHaveBeenCalledTimes(2)
  })

  test("should refetch stale queries on visibilitychange", async () => {
    const wrapper = getWrapper()
    const queryFn = jest.fn().mockResolvedValue({ message: "hi" })

    renderHook(() => useQuery({ queryKey: ["test"], queryFn, staleTime: 0 }), {
      wrapper,
    })

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalledTimes(1)
    })

    await fireVisibilityChange("hidden")
    expect(queryFn).toHaveBeenCalledTimes(1)
    await fireVisibilityChange("visible")
    expect(queryFn).toHaveBeenCalledTimes(2)
    await fireVisibilityChange("visible")
    expect(queryFn).toHaveBeenCalledTimes(2)
  })
})

describe("fetchQueryOr404", () => {
  beforeEach(() => {
    nextNavigationMocks.notFound.mockClear()
  })

  test("should return data on successful fetch", async () => {
    const queryClient = getServerQueryClient()
    const testData = { id: 1, name: "Test" }
    const queryFn = jest.fn().mockResolvedValue(testData)

    const result = await queryClient.fetchQueryOr404({
      queryKey: ["test"],
      queryFn,
    })

    expect(result).toEqual(testData)
    expect(queryFn).toHaveBeenCalledTimes(1)
    expect(nextNavigationMocks.notFound).not.toHaveBeenCalled()
  })

  test("should call notFound() on 404 error", async () => {
    allowConsoleErrors()
    const queryClient = getServerQueryClient()
    const error: Partial<AxiosError> = {
      response: { status: 404 } as AxiosResponse,
      message: "Not Found",
    }
    const queryFn = jest.fn().mockRejectedValue(error)

    await expect(
      queryClient.fetchQueryOr404({
        queryKey: ["test"],
        queryFn,
      }),
    ).rejects.toEqual(error)

    expect(queryFn).toHaveBeenCalledTimes(1)
    expect(nextNavigationMocks.notFound).toHaveBeenCalled()
  })

  test("should throw on non-404 errors", async () => {
    allowConsoleErrors()
    const queryClient = getServerQueryClient()
    const error: Partial<AxiosError> = {
      response: { status: 500 } as AxiosResponse,
      message: "Internal Server Error",
    }
    const queryFn = jest.fn().mockRejectedValue(error)

    await expect(
      queryClient.fetchQueryOr404({
        queryKey: ["test"],
        queryFn,
        retry: false,
      }),
    ).rejects.toEqual(error)

    expect(queryFn).toHaveBeenCalledTimes(1)
    expect(nextNavigationMocks.notFound).not.toHaveBeenCalled()
  })
})
