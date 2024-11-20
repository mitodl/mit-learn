// import { renderHook, waitFor } from "@testing-library/react"
// import { setupReactQueryTest } from "../test-utils"
// import { useFeaturedLearningResourcesList } from "../learningResources"
import {} from // useUserListRelationshipCreate,
// useUserListRelationshipDestroy,
"./index"
// import { setMockResponse, urls, makeRequest } from "../../test-utils"
// import * as factories from "../../test-utils/factories"
// import { LearningResource } from "../../generated/v1"
// import { invalidateResourceQueries } from "../learningResources/invalidation"
// import { invalidateUserListQueries } from "./invalidation"
// import learningResources from "../learningResources/keyFactory"
// import userLists from "./keyFactory"

// const factory = factories.learningResources

jest.mock("../learningResources/invalidation", () => {
  const actual = jest.requireActual("../learningResources/invalidation")
  return {
    __esModule: true,
    ...actual,
    invalidateResourceQueries: jest.fn(),
  }
})

jest.mock("./invalidation", () => {
  const actual = jest.requireActual("./invalidation")
  return {
    __esModule: true,
    ...actual,
    invalidateUserListQueries: jest.fn(),
  }
})

describe("userLists CRUD", () => {
  // const makeData = () => {
  //   const list = factories.userLists.userList()
  //   const relationship = factories.userLists.userListRelationship({
  //     parent: list.id,
  //   })
  //   const keys = {
  //     learningResources: learningResources._def,
  //     relationshipListing: userLists.detail(list.id)._ctx.infiniteItems._def,
  //   }
  //   const listUrls = {
  //     list: urls.userLists.list(),
  //     details: urls.userLists.details({ id: list.id }),
  //     relationshipList: urls.userLists.resources({
  //       userlist_id: list.id,
  //     }),
  //     relationshipDetails: urls.userLists.resourceDetails({
  //       id: relationship.id,
  //       userlist_id: list.id,
  //     }),
  //   }
  //   const resourceWithoutList: LearningResource = {
  //     ...relationship.resource,
  //     user_list_parents:
  //       relationship.resource.user_list_parents?.filter(
  //         (m) => m.id !== relationship.id,
  //       ) ?? null,
  //   }
  //   return { path: list, relationship, listUrls, keys, resourceWithoutList }
  // }
  // test.each([{ isChildFeatured: false }, { isChildFeatured: true }])(
  //   "useUserListRelationshipCreate calls correct API and patches featured resources",
  //   async ({ isChildFeatured }) => {
  //     const { relationship, listUrls, resourceWithoutList } = makeData()
  //     const featured = factory.resources({ count: 3 })
  //     if (isChildFeatured) {
  //       featured.results[0] = resourceWithoutList
  //     }
  //     setMockResponse.get(urls.learningResources.featured(), featured)
  //     const url = listUrls.relationshipList
  //     const requestData = {
  //       child: relationship.child,
  //       parent: relationship.parent,
  //       position: relationship.position,
  //     }
  //     setMockResponse.post(url, relationship)
  //     const { wrapper, queryClient } = setupReactQueryTest()
  //     const { result } = renderHook(useUserListRelationshipCreate, {
  //       wrapper,
  //     })
  //     const { result: featuredResult } = renderHook(
  //       useFeaturedLearningResourcesList,
  //       { wrapper },
  //     )
  //     await waitFor(() => expect(featuredResult.current.data).toBe(featured))
  //     result.current.mutate(requestData)
  //     await waitFor(() => expect(result.current.isSuccess).toBe(true))
  //     expect(makeRequest).toHaveBeenCalledWith("post", url, requestData)
  //     expect(invalidateResourceQueries).toHaveBeenCalledWith(
  //       queryClient,
  //       relationship.child,
  //       { skipFeatured: true },
  //     )
  //     expect(invalidateUserListQueries).toHaveBeenCalledWith(
  //       queryClient,
  //       relationship.parent,
  //     )
  //     // Assert featured API called only once and that the result has been
  //     // patched correctly. When the child is featured, we do NOT want to make
  //     // a new API call to /featured, because the results of that API are randomly
  //     // ordered.
  //     expect(
  //       makeRequest.mock.calls.filter((call) => call[0] === "get").length,
  //     ).toEqual(1)
  //     if (isChildFeatured) {
  //       const firstId = featuredResult.current.data?.results.sort()[0].id
  //       const filtered = featured.results.filter((item) => item.id === firstId)
  //       expect(filtered[0]).not.toBeNull()
  //     } else {
  //       expect(featuredResult.current.data).toEqual(featured)
  //     }
  //   },
  // )
  // test.each([{ isChildFeatured: false }, { isChildFeatured: true }])(
  //   "useUserListRelationshipDestroy calls correct API and patches child resource cache (isChildFeatured=$isChildFeatured)",
  //   async ({ isChildFeatured }) => {
  //     const { relationship, listUrls } = makeData()
  //     const url = listUrls.relationshipDetails
  //     const featured = factory.resources({ count: 3 })
  //     if (isChildFeatured) {
  //       featured.results[0] = relationship.resource
  //     }
  //     setMockResponse.get(urls.learningResources.featured(), featured)
  //     setMockResponse.delete(url, null)
  //     const { wrapper, queryClient } = setupReactQueryTest()
  //     const { result } = renderHook(useUserListRelationshipDestroy, {
  //       wrapper,
  //     })
  //     const { result: featuredResult } = renderHook(
  //       useFeaturedLearningResourcesList,
  //       { wrapper },
  //     )
  //     await waitFor(() => expect(featuredResult.current.data).toBe(featured))
  //     result.current.mutate(relationship)
  //     await waitFor(() => expect(result.current.isSuccess).toBe(true))
  //     expect(makeRequest).toHaveBeenCalledWith("delete", url, undefined)
  //     expect(invalidateResourceQueries).toHaveBeenCalledWith(
  //       queryClient,
  //       relationship.child,
  //       { skipFeatured: true },
  //     )
  //     expect(invalidateUserListQueries).toHaveBeenCalledWith(
  //       queryClient,
  //       relationship.parent,
  //     )
  //     // Assert featured API called only once and that the result has been
  //     // patched correctly. When the child is featured, we do NOT want to make
  //     // a new API call to /featured, because the results of that API are randomly
  //     // ordered.
  //     expect(
  //       makeRequest.mock.calls.filter((call) => call[0] === "get").length,
  //     ).toEqual(1)
  //     if (isChildFeatured) {
  //       const firstId = featuredResult.current.data?.results.sort()[0].id
  //       const filtered = featured.results.filter((item) => item.id === firstId)
  //       expect(filtered[0]).not.toBeNull()
  //     } else {
  //       expect(featuredResult.current.data).toEqual(featured)
  //     }
  //   },
  // )
})
