import { renderHook, waitFor } from "@testing-library/react"
import keyFactory from "./keyFactory"
import { setupReactQueryTest } from "../test-utils"
import {
  useLearningResourcesDetail,
  useLearningResourcesList,
  useLearningResourceTopics,
  useFeaturedLearningResourcesList,
  useUserListRelationshipCreate,
  useUserListRelationshipDestroy,
} from "./index"
import { setMockResponse, urls, makeRequest } from "../../test-utils"
import * as factories from "../../test-utils/factories"
import { UseQueryResult } from "@tanstack/react-query"
import { LearningResource } from "../../generated/v1"
import {
  invalidateResourceQueries,
  invalidateUserListQueries,
} from "./invalidation"

const factory = factories.learningResources

jest.mock("./invalidation", () => {
  const actual = jest.requireActual("./invalidation")
  return {
    __esModule: true,
    ...actual,
    invalidateResourceQueries: jest.fn(),
    invalidateUserListQueries: jest.fn(),
  }
})

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
  expect(
    makeRequest.mock.calls.some((args) => {
      // Don't use toHaveBeenCalledWith. It doesn't handle undefined 3rd arg.
      return args[0].toUpperCase() === method && args[1] === url
    }),
  ).toBe(true)
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

describe("userlist CRUD", () => {
  const makeData = () => {
    const list = factories.userLists.userList()
    const relationship = factories.userLists.userListRelationship({
      parent: list.id,
    })
    const keys = {
      learningResources: keyFactory._def,
      relationshipListing: keyFactory.userlists._ctx.detail(list.id)._ctx
        .infiniteItems._def,
    }
    const listUrls = {
      list: urls.userLists.list(),
      details: urls.userLists.details({ id: list.id }),
      relationshipList: urls.userLists.resources({
        userlist_id: list.id,
      }),
      relationshipDetails: urls.userLists.resourceDetails({
        id: relationship.id,
        userlist_id: list.id,
      }),
    }

    const resourceWithoutList: LearningResource = {
      ...relationship.resource,
      user_list_parents:
        relationship.resource.user_list_parents?.filter(
          (m) => m.id !== relationship.id,
        ) ?? null,
    }
    return { path: list, relationship, listUrls, keys, resourceWithoutList }
  }

  test.each([{ isChildFeatured: false }, { isChildFeatured: true }])(
    "useUserListRelationshipCreate calls correct API and patches featured resources",
    async ({ isChildFeatured }) => {
      const { relationship, listUrls, resourceWithoutList } = makeData()

      const featured = factory.resources({ count: 3 })
      if (isChildFeatured) {
        featured.results[0] = resourceWithoutList
      }
      setMockResponse.get(urls.learningResources.featured(), featured)

      const url = listUrls.relationshipList
      const requestData = {
        child: relationship.child,
        parent: relationship.parent,
        position: relationship.position,
      }
      setMockResponse.post(url, relationship)

      const { wrapper, queryClient } = setupReactQueryTest()
      const { result } = renderHook(useUserListRelationshipCreate, {
        wrapper,
      })
      const { result: featuredResult } = renderHook(
        useFeaturedLearningResourcesList,
        { wrapper },
      )
      await waitFor(() => expect(featuredResult.current.data).toBe(featured))

      result.current.mutate(requestData)

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(makeRequest).toHaveBeenCalledWith("post", url, requestData)

      expect(invalidateResourceQueries).toHaveBeenCalledWith(
        queryClient,
        relationship.child,
        { skipFeatured: true },
      )
      expect(invalidateUserListQueries).toHaveBeenCalledWith(
        queryClient,
        relationship.parent,
      )

      // Assert featured API called only once and that the result has been
      // patched correctly. When the child is featured, we do NOT want to make
      // a new API call to /featured, because the results of that API are randomly
      // ordered.
      expect(
        makeRequest.mock.calls.filter((call) => call[0] === "get").length,
      ).toEqual(1)
      if (isChildFeatured) {
        const firstId = featuredResult.current.data?.results.sort()[0].id
        const filtered = featured.results.filter((item) => item.id === firstId)

        expect(filtered[0]).not.toBeNull()
      } else {
        expect(featuredResult.current.data).toEqual(featured)
      }
    },
  )

  test.each([{ isChildFeatured: false }, { isChildFeatured: true }])(
    "useUserListRelationshipDestroy calls correct API and patches child resource cache (isChildFeatured=$isChildFeatured)",
    async ({ isChildFeatured }) => {
      const { relationship, listUrls } = makeData()
      const url = listUrls.relationshipDetails

      const featured = factory.resources({ count: 3 })
      if (isChildFeatured) {
        featured.results[0] = relationship.resource
      }
      setMockResponse.get(urls.learningResources.featured(), featured)

      setMockResponse.delete(url, null)
      const { wrapper, queryClient } = setupReactQueryTest()

      const { result } = renderHook(useUserListRelationshipDestroy, {
        wrapper,
      })
      const { result: featuredResult } = renderHook(
        useFeaturedLearningResourcesList,
        { wrapper },
      )

      await waitFor(() => expect(featuredResult.current.data).toBe(featured))
      result.current.mutate(relationship)
      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(makeRequest).toHaveBeenCalledWith("delete", url, undefined)
      expect(invalidateResourceQueries).toHaveBeenCalledWith(
        queryClient,
        relationship.child,
        { skipFeatured: true },
      )
      expect(invalidateUserListQueries).toHaveBeenCalledWith(
        queryClient,
        relationship.parent,
      )

      // Assert featured API called only once and that the result has been
      // patched correctly. When the child is featured, we do NOT want to make
      // a new API call to /featured, because the results of that API are randomly
      // ordered.
      expect(
        makeRequest.mock.calls.filter((call) => call[0] === "get").length,
      ).toEqual(1)
      if (isChildFeatured) {
        const firstId = featuredResult.current.data?.results.sort()[0].id
        const filtered = featured.results.filter((item) => item.id === firstId)

        expect(filtered[0]).not.toBeNull()
      } else {
        expect(featuredResult.current.data).toEqual(featured)
      }
    },
  )
})
