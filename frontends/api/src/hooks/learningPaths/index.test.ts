import { renderHook, waitFor } from "@testing-library/react"
import { faker } from "@faker-js/faker/locale/en"
import { UseQueryResult } from "@tanstack/react-query"
import { LearningResource } from "../../generated/v1"
import * as factories from "../../test-utils/factories"
import { setupReactQueryTest } from "../test-utils"
import { setMockResponse, urls, makeRequest } from "../../test-utils"
import { useFeaturedLearningResourcesList } from "../learningResources"
import { invalidateResourceQueries } from "../learningResources/invalidation"
import keyFactory from "../learningResources/keyFactory"
import {
  useLearningPathsDetail,
  useLearningPathsList,
  useInfiniteLearningPathItems,
  useLearningPathCreate,
  useLearningPathDestroy,
  useLearningPathUpdate,
  useLearningPathRelationshipMove,
  useLearningPathRelationshipCreate,
  useLearningPathRelationshipDestroy,
} from "./index"
import learningPathKeyFactory from "./keyFactory"

const factory = factories.learningResources

jest.mock("../learningResources/invalidation", () => {
  const actual = jest.requireActual("../learningResources/invalidation")
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

describe("useLearningPathsList", () => {
  it.each([undefined, { limit: 5 }, { limit: 5, offset: 10 }])(
    "Calls the correct API",
    async (params) => {
      const data = factory.learningPaths({ count: 3 })
      const url = urls.learningPaths.list(params)

      const { wrapper } = setupReactQueryTest()
      setMockResponse.get(url, data)
      const useTestHook = () => useLearningPathsList(params)
      const { result } = renderHook(useTestHook, { wrapper })

      await assertApiCalled(result, url, "GET", data)
    },
  )
})

describe("useInfiniteLearningPathItems", () => {
  it("Calls the correct API and can fetch next page", async () => {
    const parentId = faker.number.int()
    const url1 = urls.learningPaths.resources({
      learning_resource_id: parentId,
    })
    const url2 = urls.learningPaths.resources({
      learning_resource_id: parentId,
      offset: 5,
    })
    const response1 = factory.learningPathRelationships({
      count: 7,
      parent: parentId,
      next: url2,
      pageSize: 5,
    })
    const response2 = factory.learningPathRelationships({
      count: 7,
      pageSize: 2,
      parent: parentId,
    })
    setMockResponse.get(url1, response1)
    setMockResponse.get(url2, response2)
    const useTestHook = () =>
      useInfiniteLearningPathItems({ learning_resource_id: parentId })

    const { wrapper } = setupReactQueryTest()

    // First page
    const { result } = renderHook(useTestHook, { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(makeRequest).toHaveBeenCalledWith("get", url1, undefined)

    // Second page
    result.current.fetchNextPage()
    await waitFor(() => expect(result.current.isFetching).toBe(false))
    expect(makeRequest).toHaveBeenCalledWith("get", url2, undefined)
  })
})

describe("useLearningPathsRetrieve", () => {
  it("Calls the correct API", async () => {
    const data = factory.learningPath()
    const params = { id: data.id }
    const url = urls.learningPaths.details(params)

    const { wrapper } = setupReactQueryTest()
    setMockResponse.get(url, data)
    const useTestHook = () => useLearningPathsDetail(params.id)
    const { result } = renderHook(useTestHook, { wrapper })

    await assertApiCalled(result, url, "GET", data)
  })
})

describe("LearningPath CRUD", () => {
  const makeData = () => {
    const path = factory.learningPath()
    const relationship = factory.learningPathRelationship({ parent: path.id })
    const keys = {
      learningResources: keyFactory._def,
      relationshipListing: learningPathKeyFactory.detail(path.id)._ctx
        .infiniteItems._def,
    }
    const pathUrls = {
      list: urls.learningPaths.list(),
      details: urls.learningPaths.details({ id: path.id }),
      relationshipList: urls.learningPaths.resources({
        learning_resource_id: path.id,
      }),
      relationshipDetails: urls.learningPaths.resourceDetails({
        id: relationship.id,
        learning_resource_id: path.id,
      }),
    }

    const resourceWithoutList: LearningResource = {
      ...relationship.resource,
      learning_path_parents:
        relationship.resource.learning_path_parents?.filter(
          (m) => m.id !== relationship.id,
        ) ?? null,
    }
    return { path, relationship, pathUrls, keys, resourceWithoutList }
  }

  test("useLearningPathCreate calls correct API", async () => {
    const { path, pathUrls } = makeData()
    const url = pathUrls.list

    const requestData = { title: path.title }
    setMockResponse.post(pathUrls.list, path)

    const { wrapper, queryClient } = setupReactQueryTest()
    jest.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(useLearningPathCreate, {
      wrapper,
    })
    result.current.mutate(requestData)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(makeRequest).toHaveBeenCalledWith("post", url, requestData)
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith([
      "learningPaths",
      "list",
    ])
  })

  test("useLearningPathDestroy calls correct API", async () => {
    const { path, pathUrls } = makeData()
    const url = pathUrls.details
    setMockResponse.delete(url, null)

    const { wrapper, queryClient } = setupReactQueryTest()
    const { result } = renderHook(useLearningPathDestroy, {
      wrapper,
    })
    result.current.mutate({ id: path.id })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(makeRequest).toHaveBeenCalledWith("delete", url, undefined)
    expect(invalidateResourceQueries).toHaveBeenCalledWith(queryClient, path.id)
  })

  test("useLearningPathUpdate calls correct API", async () => {
    const { path, pathUrls } = makeData()
    const url = pathUrls.details
    const patch = { id: path.id, title: path.title }
    setMockResponse.patch(url, path)

    const { wrapper, queryClient } = setupReactQueryTest()
    const { result } = renderHook(useLearningPathUpdate, { wrapper })
    result.current.mutate(patch)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(makeRequest).toHaveBeenCalledWith("patch", url, patch)

    expect(invalidateResourceQueries).toHaveBeenCalledWith(queryClient, path.id)
  })

  test("useLearningPathRelationshipMove calls correct API", async () => {
    const { relationship, pathUrls, keys } = makeData()
    const url = pathUrls.relationshipDetails
    setMockResponse.patch(url, null)

    const { wrapper, queryClient } = setupReactQueryTest()
    jest.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(useLearningPathRelationshipMove, { wrapper })
    result.current.mutate(relationship)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(makeRequest).toHaveBeenCalledWith(
      "patch",
      url,
      expect.objectContaining({ position: relationship.position }),
    )

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith(
      keys.relationshipListing,
    )
  })

  test.each([{ isChildFeatured: false }, { isChildFeatured: true }])(
    "useLearningPathRelationshipCreate calls correct API and patches featured resources",
    async ({ isChildFeatured }) => {
      const { relationship, pathUrls, resourceWithoutList } = makeData()

      const featured = factory.resources({ count: 3 })
      if (isChildFeatured) {
        featured.results[0] = resourceWithoutList
      }
      setMockResponse.get(urls.learningResources.featured(), featured)

      const url = pathUrls.relationshipList
      const requestData = {
        child: relationship.child,
        parent: relationship.parent,
        position: relationship.position,
      }
      setMockResponse.post(url, relationship)

      const { wrapper, queryClient } = setupReactQueryTest()
      const { result } = renderHook(useLearningPathRelationshipCreate, {
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
        { skipFeatured: false },
      )
      expect(invalidateResourceQueries).toHaveBeenCalledWith(
        queryClient,
        relationship.parent,
      )
    },
  )

  test.each([{ isChildFeatured: false }, { isChildFeatured: true }])(
    "useLearningPathRelationshipDestroy calls correct API and patches child resource cache (isChildFeatured=$isChildFeatured)",
    async ({ isChildFeatured }) => {
      const { relationship, pathUrls } = makeData()
      const url = pathUrls.relationshipDetails

      const featured = factory.resources({ count: 3 })
      if (isChildFeatured) {
        featured.results[0] = relationship.resource
      }
      setMockResponse.get(urls.learningResources.featured(), featured)

      setMockResponse.delete(url, null)
      const { wrapper, queryClient } = setupReactQueryTest()

      const { result } = renderHook(useLearningPathRelationshipDestroy, {
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
        { skipFeatured: false },
      )
      expect(invalidateResourceQueries).toHaveBeenCalledWith(
        queryClient,
        relationship.parent,
      )
    },
  )
})
