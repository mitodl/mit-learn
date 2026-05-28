import { renderHook, waitFor } from "@testing-library/react"
import { setupReactQueryTest } from "../test-utils"
import {
  useLearningResourcesDetail,
  useInfiniteLearningResourceItems,
  useLearningResourcesList,
  useLearningResourceTopics,
} from "./index"
import { setMockResponse, urls, makeRequest } from "../../test-utils"
import * as factories from "../../test-utils/factories"
import { UseQueryResult } from "@tanstack/react-query"

const factory = factories.learningResources

/**
 * Assert that `hook` queries the API with the correct `url`, `method`, and
 * exposes the API's data.
 */
const assertApiCalled = async (
  result: { current: UseQueryResult },
  url: string,
  method: string,
  data: unknown,
) => {
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(makeRequest).toHaveBeenCalledWith(
    expect.objectContaining({ method: method.toLowerCase(), url }),
  )
  expect(result.current.data).toEqual(data)
}

describe("useLearningResourcesList", () => {
  it.each([undefined, { limit: 5 }, { limit: 5, offset: 10 }])(
    "Calls the correct API",
    async (params) => {
      const data = factory.resources({ count: 3 })
      const url = urls.learningResources.list(params)
      const { wrapper } = setupReactQueryTest()
      setMockResponse.get(url, data)
      const useTestHook = () => useLearningResourcesList(params)
      const { result } = renderHook(useTestHook, { wrapper })
      await assertApiCalled(result, url, "GET", data)
    },
  )
})

describe("useLearningResourcesRetrieve", () => {
  it("Calls the correct API", async () => {
    const data = factory.resource()
    const params = { id: data.id }
    const url = urls.learningResources.details(params)

    const { wrapper } = setupReactQueryTest()
    setMockResponse.get(url, data)
    const useTestHook = () => useLearningResourcesDetail(params.id)
    const { result } = renderHook(useTestHook, { wrapper })

    await assertApiCalled(result, url, "GET", data)
  })
})

describe("useInfiniteLearningResourceItems", () => {
  it("normalizes absolute next URLs to relative API requests", async () => {
    const parentId = 99
    const firstUrl = urls.learningResources.items({ id: parentId })
    const secondPath = `/api/v1/learning_resources/${parentId}/items/?offset=5`
    const secondUrl = new URL(secondPath, firstUrl).toString()
    const firstPage = {
      count: 0,
      next: `https://learn.example.edu${secondPath}`,
      previous: null,
      results: [],
    }
    const secondPage = {
      count: 0,
      next: null,
      previous: null,
      results: [],
    }

    const { wrapper } = setupReactQueryTest()
    setMockResponse.get(firstUrl, firstPage)
    setMockResponse.get(secondUrl, secondPage)
    const { result } = renderHook(
      () =>
        useInfiniteLearningResourceItems(parentId, {
          learning_resource_id: parentId,
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    result.current.fetchNextPage()
    await waitFor(() => expect(result.current.isFetching).toBe(false))

    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "get", url: secondUrl }),
    )
  })
})

describe("useLearningResourceTopics", () => {
  it.each([undefined, { limit: 5 }, { limit: 5, offset: 10 }])(
    "Calls the correct API",
    async (params) => {
      const data = factory.topics({ count: 3 })
      const url = urls.topics.list(params)

      const { wrapper } = setupReactQueryTest()
      setMockResponse.get(url, data)
      const useTestHook = () => useLearningResourceTopics(params)
      const { result } = renderHook(useTestHook, { wrapper })

      await assertApiCalled(result, url, "GET", data)
    },
  )
})
