import { createQueryKeys } from "@lukemorales/query-key-factory"
import axiosInstance from "../../axios"
import type {
  PaginatedLearningResourceList,
  UserlistsApiUserlistsItemsListRequest as ItemsListRequest,
  UserlistsApiUserlistsListRequest as ListRequest,
  PaginatedUserListRelationshipList,
  UserListRelationship,
  MicroUserListRelationship,
} from "../../generated/v1"
import { userListsApi } from "../../clients"

const userLists = createQueryKeys("userLists", {
  detail: (id: number) => ({
    queryKey: [id],
    queryFn: () =>
      userListsApi.userlistsRetrieve({ id }).then((res) => res.data),
    contextQueries: {
      infiniteItems: (itemsP: ItemsListRequest) => ({
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
  list: (params: ListRequest) => ({
    queryKey: [params],
    queryFn: () => userListsApi.userlistsList(params).then((res) => res.data),
  }),
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

export default userLists
export { updateListParentsOnAdd, updateListParentsOnDestroy }
