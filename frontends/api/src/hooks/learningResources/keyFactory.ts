import {
  learningResourcesApi,
  learningResourcesSearchApi,
  topicsApi,
  userListsApi,
  offerorsApi,
  platformsApi,
  schoolsApi,
  featuredApi,
} from "../../clients"
import axiosInstance from "../../axios"
import type {
  LearningResourcesApiLearningResourcesListRequest as LRListRequest,
  TopicsApiTopicsListRequest as TopicsListRequest,
  PaginatedLearningResourceList,
  LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as LRSearchRequest,
  UserlistsApiUserlistsItemsListRequest as ULResourcesListRequest,
  UserlistsApiUserlistsListRequest as ULListRequest,
  PaginatedUserListRelationshipList,
  OfferorsApiOfferorsListRequest,
  PlatformsApiPlatformsListRequest,
  FeaturedApiFeaturedListRequest as FeaturedListParams,
  UserListRelationship,
  MicroUserListRelationship,
} from "../../generated/v1"

import { createQueryKeys } from "@lukemorales/query-key-factory"

/* TODO we can add this back in once resource user list membership is implemented in the front end
 * Currently we fetch on the server for public resources and then refetch on the client for the
 * user lists parents. Randomizing therefore causes a content flicker as the client loaded
 * sequence replaces the server rendered sequence.

const shuffle = ([...arr]) => {
  let m = arr.length
  while (m) {
    const i = Math.floor(Math.random() * m--)
    ;[arr[m], arr[i]] = [arr[i], arr[m]]
  }
  return arr
}

const randomizeResults = ([...results]) => {
  const resultsByPosition: {
    [position: string]: (LearningResource & { position?: string })[] | undefined
  } = {}
  const randomizedResults: LearningResource[] = []
  results.forEach((result) => {
    if (!resultsByPosition[result?.position]) {
      resultsByPosition[result?.position] = []
    }
    resultsByPosition[result?.position ?? ""]?.push(result)
  })
  Object.keys(resultsByPosition)
    .sort()
    .forEach((position) => {
      const shuffled = shuffle(resultsByPosition[position] ?? [])
      randomizedResults.push(...shuffled)
    })
  return randomizedResults
}
*/

const learningResources = createQueryKeys("learningResources", {
  detail: (id: number) => ({
    queryKey: [id],
    queryFn: () =>
      learningResourcesApi
        .learningResourcesRetrieve({ id })
        .then((res) => res.data),
  }),
  list: (params: LRListRequest) => ({
    queryKey: [params],
    queryFn: () =>
      learningResourcesApi
        .learningResourcesList(params)
        .then((res) => res.data),
  }),
  featured: (params: FeaturedListParams = {}) => ({
    queryKey: [params],
    queryFn: () => {
      return featuredApi.featuredList(params).then((res) => {
        // res.data.results = randomizeResults(res.data?.results)
        return res.data
      })
    },
  }),
  topic: (id: number | undefined) => ({
    queryKey: [id],
    queryFn: () =>
      id ? topicsApi.topicsRetrieve({ id }).then((res) => res.data) : null,
  }),
  topics: (params: TopicsListRequest) => ({
    queryKey: [params],
    queryFn: () => topicsApi.topicsList(params).then((res) => res.data),
  }),
  search: (params: LRSearchRequest) => {
    return {
      queryKey: [params],
      queryFn: () =>
        learningResourcesSearchApi
          .learningResourcesSearchRetrieve(params)
          .then((res) => res.data),
    }
  },
  userlists: {
    queryKey: ["user_lists"],
    contextQueries: {
      detail: (id: number) => ({
        queryKey: [id],
        queryFn: () =>
          userListsApi.userlistsRetrieve({ id }).then((res) => res.data),
        contextQueries: {
          infiniteItems: (itemsP: ULResourcesListRequest) => ({
            queryKey: [itemsP],
            queryFn: ({ pageParam }: { pageParam?: string } = {}) => {
              const request = pageParam
                ? axiosInstance.request<PaginatedUserListRelationshipList>({
                    method: "get",
                    url: pageParam,
                  })
                : userListsApi.userlistsItemsList(itemsP)
              return request.then((res) => res.data)
            },
          }),
        },
      }),
      list: (params: ULListRequest) => ({
        queryKey: [params],
        queryFn: () =>
          userListsApi.userlistsList(params).then((res) => res.data),
      }),
    },
  },
  offerors: (params: OfferorsApiOfferorsListRequest) => {
    return {
      queryKey: [params],
      queryFn: () => offerorsApi.offerorsList(params).then((res) => res.data),
    }
  },
  platforms: (params: PlatformsApiPlatformsListRequest) => {
    return {
      queryKey: [params],
      queryFn: () => platformsApi.platformsList(params).then((res) => res.data),
    }
  },
  schools: () => {
    return {
      queryKey: ["schools"],
      queryFn: () => schoolsApi.schoolsList().then((res) => res.data),
    }
  },
  memberships: () => {
    return {
      queryKey: ["memberships"],
    }
  },
})

/**
 * Given
 *  - a list of learning resources L
 *  - a new relationship between learningpath/userlist and a resource R
 * Update the list L so that it includes the updated resource R. (If the list
 * did not contain R to begin with, no change is made)
 */
const updateListParentsOnAdd = (
  relationship: UserListRelationship,
  oldList?: PaginatedLearningResourceList,
) => {
  if (!oldList) return oldList
  const matchIndex = oldList.results.findIndex(
    (res) => res.id === relationship.child,
  )
  if (matchIndex === -1) return oldList
  const updatesResults = [...oldList.results]
  updatesResults[matchIndex] = relationship.resource
  return {
    ...oldList,
    results: updatesResults,
  }
}

/**
 * Given
 *  - a list of learning resources L
 *  - a destroyed relationship between learningpath/userlist and a resource R
 * Update the list L so that it includes the updated resource R. (If the list
 * did not contain R to begin with, no change is made)
 */
const updateListParentsOnDestroy = (
  relationship: MicroUserListRelationship,
  list?: PaginatedLearningResourceList,
) => {
  if (!list) return list
  if (!relationship) return list
  const matchIndex = list.results.findIndex(
    (res) => res.id === relationship.child,
  )
  if (matchIndex === -1) return list
  const updatedResults = [...list.results]
  const newResource = { ...updatedResults[matchIndex] }
  newResource.user_list_parents =
    newResource.user_list_parents?.filter((m) => m.id !== relationship.id) ??
    null
  updatedResults[matchIndex] = newResource
  return {
    ...list,
    results: updatedResults,
  }
}

/**
 * Given
 *  - a LearningResource ID
 *  - a paginated list of current resources
 *  - a list of new relationships
 *  - the type of list
 * Update the resources' user_list_parents field to include the new relationships
 */
const updateListParents = (
  resourceId: number,
  staleResources?: PaginatedLearningResourceList,
  newRelationships?: MicroUserListRelationship[],
  listType?: "userlist" | "learningpath",
) => {
  if (!resourceId || !staleResources || !newRelationships || !listType)
    return staleResources
  const matchIndex = staleResources.results.findIndex(
    (res) => res.id === resourceId,
  )
  if (matchIndex === -1) return staleResources
  const updatedResults = [...staleResources.results]
  const newResource = { ...updatedResults[matchIndex] }
  if (listType === "userlist") {
    newResource.user_list_parents = newRelationships
  }
  if (listType === "learningpath") {
    newResource.learning_path_parents = newRelationships
  }
  updatedResults[matchIndex] = newResource
  return {
    ...staleResources,
    results: updatedResults,
  }
}

export default learningResources
export { updateListParentsOnAdd, updateListParentsOnDestroy, updateListParents }
