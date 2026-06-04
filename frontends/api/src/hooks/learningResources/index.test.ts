import { renderHook, waitFor } from "@testing-library/react"
import {
  setupReactQueryTest,
  assertNormalizesPaginationNext,
} from "../test-utils"
import {
  useLearningResourceByReadableId,
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

describe("useLearningResourceByReadableId", () => {
  it("returns the first matching learning resource", async () => {
    const data = factory.course({ readable_id: "course-v1:MITx+TEST" })
    const url = urls.learningResources.list({
      readable_id: [data.readable_id],
      limit: 1,
    })
    const listData = {
      count: 1,
      next: null,
      previous: null,
      results: [data],
    }

    const { wrapper } = setupReactQueryTest()
    setMockResponse.get(url, listData)
    const { result } = renderHook(
      () => useLearningResourceByReadableId(data.readable_id),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "get",
        url: expect.stringContaining("readable_id=course-v1%3AMITx%2BTEST"),
      }),
    )
    expect(result.current.data).toEqual(data)
  })

  it("does not fetch when disabled", () => {
    const { wrapper } = setupReactQueryTest()
    const { result } = renderHook(
      () =>
        useLearningResourceByReadableId("course-v1:MITx+TEST", {
          enabled: false,
        }),
      { wrapper },
    )

    expect(makeRequest).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe("idle")
    expect(result.current.isPending).toBe(true)
  })
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
    const id = 99
    await assertNormalizesPaginationNext({
      firstUrl: urls.learningResources.items({ id }),
      secondUrl: `${urls.learningResources.items({ id })}?offset=5`,
      renderInfiniteHook: (wrapper) =>
        renderHook(
          () =>
            useInfiniteLearningResourceItems(id, { learning_resource_id: id }),
          { wrapper },
        ),
    })
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
