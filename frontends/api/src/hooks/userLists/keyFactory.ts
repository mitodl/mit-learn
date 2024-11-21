import { createQueryKeys } from "@lukemorales/query-key-factory"
import axiosInstance from "../../axios"
import type {
  UserlistsApiUserlistsItemsListRequest as ItemsListRequest,
  UserlistsApiUserlistsListRequest as ListRequest,
  PaginatedUserListRelationshipList,
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
  membershipList: () => ({
    queryKey: ["membershipList"],
    queryFn: async () => {
      const { data } = await userListsApi.userlistsMembershipList()
      return data
    },
  }),
})

export default userLists
