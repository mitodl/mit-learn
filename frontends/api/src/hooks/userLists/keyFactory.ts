import { createQueryKeys } from "@lukemorales/query-key-factory"
import axiosInstance from "../../axios"
import type {
  UserlistsApiUserlistsItemsListRequest as ItemsListRequest,
  UserlistsApiUserlistsListRequest as ListRequest,
  PaginatedUserListRelationshipList,
} from "../../generated/v1"
import { userListsApi } from "../../clients"
import { clearListMemberships } from "../learningResources/queries"

const userLists = createQueryKeys("userLists", {
  detail: (id: number) => ({
    queryKey: [id],
    queryFn: async () => {
      const { data } = await userListsApi.userlistsRetrieve({ id })
      return data
    },
    contextQueries: {
      infiniteItems: (itemsP: ItemsListRequest) => ({
        queryKey: [itemsP],
        queryFn: async ({ pageParam }: { pageParam?: string } = {}) => {
          const request = pageParam
            ? axiosInstance.request<PaginatedUserListRelationshipList>({
                method: "get",
                url: pageParam,
              })
            : userListsApi.userlistsItemsList(itemsP)
          const { data } = await request
          return {
            ...data,
            results: data.results.map((relation) => ({
              ...relation,
              resource: clearListMemberships(relation.resource),
            })),
          }
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
