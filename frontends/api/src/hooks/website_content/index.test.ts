import { renderHook, waitFor } from "@testing-library/react"

import { setupReactQueryTest } from "../test-utils"
import { websiteContentKeys } from "./queries"
import { setMockResponse, urls, makeRequest } from "../../test-utils"
import { UseQueryResult } from "@tanstack/react-query"
import { websiteContent as factory } from "../../test-utils/factories"
import {
  useWebsiteContentList,
  useWebsiteContentDetail,
  useWebsiteContentCreate,
  useWebsiteContentPartialUpdate,
  useWebsiteContentDestroy,
} from "./index"

/**
 * Assert that a react-query hook queries the API with the correct `url`,
 * `method`, and exposes the API's data.
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

describe("useWebsiteContentList", () => {
  it.each([undefined, { limit: 5 }, { limit: 5, offset: 10 }])(
    "Calls the correct API",
    async (params) => {
      const data = factory.websiteContents({ count: 3 })
      const url = urls.websiteContent.list(params)
      const { wrapper } = setupReactQueryTest()
      setMockResponse.get(url, data)
      const useTestHook = () => useWebsiteContentList(params)
      const { result } = renderHook(useTestHook, { wrapper })
      await assertApiCalled(result, url, "GET", data)
    },
  )
})

describe("useWebsiteContentDetail", () => {
  it("Calls the correct API", async () => {
    const data = factory.websiteContent()
    const url = urls.websiteContent.details(data.id)

    const { wrapper } = setupReactQueryTest()
    setMockResponse.get(url, data)
    const useTestHook = () => useWebsiteContentDetail(data.id)
    const { result } = renderHook(useTestHook, { wrapper })

    await assertApiCalled(result, url, "GET", data)
  })
})

describe("Website Content CRUD", () => {
  test("useWebsiteContentCreate calls correct API", async () => {
    const url = urls.websiteContent.list()
    const data = factory.websiteContent()
    const { id, ...requestData } = factory.websiteContent()
    setMockResponse.post(url, data)

    const { wrapper, queryClient } = setupReactQueryTest()
    jest.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(useWebsiteContentCreate, { wrapper })
    result.current.mutate(requestData)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(makeRequest).toHaveBeenCalledWith({
      method: "post",
      url,
      body: requestData,
    })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: websiteContentKeys.listRoot(),
    })
  })

  test("useWebsiteContentPartialUpdate calls correct API", async () => {
    const article = factory.websiteContent()
    const url = urls.websiteContent.details(article.id)
    setMockResponse.patch(url, article)

    const { wrapper, queryClient } = setupReactQueryTest()
    jest.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(useWebsiteContentPartialUpdate, { wrapper })
    result.current.mutate(article)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const { id, ...patchData } = article
    expect(makeRequest).toHaveBeenCalledWith({
      method: "patch",
      url,
      body: patchData,
    })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: websiteContentKeys.detail(article.id),
    })
  })

  test("useWebsiteContentDestroy calls correct API", async () => {
    const { id } = factory.websiteContent()
    const url = urls.websiteContent.details(id)
    setMockResponse.delete(url, null)

    const { wrapper, queryClient } = setupReactQueryTest()
    jest.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(useWebsiteContentDestroy, { wrapper })
    result.current.mutate(id)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "delete", url }),
    )
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: websiteContentKeys.listRoot(),
    })
  })
})
