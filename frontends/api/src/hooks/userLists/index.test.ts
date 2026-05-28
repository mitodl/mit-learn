import { renderHook, waitFor } from "@testing-library/react"
import { setupReactQueryTest } from "../test-utils"
import { setMockResponse, urls, makeRequest } from "../../test-utils"
import { useInfiniteUserListItems } from "./index"

describe("useInfiniteUserListItems", () => {
  test("normalizes absolute next URLs to relative API requests", async () => {
    const userlistId = 12
    const firstUrl = urls.userLists.resources({ userlist_id: userlistId })
    const secondUrl = urls.userLists.resources({
      userlist_id: userlistId,
      offset: 5,
    })
    const parsedNextUrl = new URL(secondUrl)
    const nextPath = `${parsedNextUrl.pathname}${parsedNextUrl.search}`
    const firstPage = {
      count: 0,
      next: `https://learn.example.edu${nextPath}`,
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
      () => useInfiniteUserListItems({ userlist_id: userlistId }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    result.current.fetchNextPage()
    await waitFor(() => expect(result.current.isFetching).toBe(false))

    expect(makeRequest).toHaveBeenCalledWith("get", secondUrl, undefined)
  })
})
