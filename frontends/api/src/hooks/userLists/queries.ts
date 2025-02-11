import axiosInstance from "../../axios"
import type {
  UserlistsApiUserlistsItemsListRequest as ItemsListRequest,
  UserlistsApiUserlistsListRequest as ListRequest,
  PaginatedUserListRelationshipList,
} from "../../generated/v1"
import { userListsApi } from "../../clients"
import { clearListMemberships } from "../learningResources/queries"
import { QueryOptions } from "@tanstack/react-query"

const userlistKeys = {
  root: ["userLists"],
  listRoot: () => [...userlistKeys.root, "list"],
  list: (params: ListRequest) => [...userlistKeys.listRoot(), params],
  detailRoot: () => [...userlistKeys.root, "detail"],
  detail: (id: number) => [...userlistKeys.detailRoot(), id],
  infiniteItemsRoot: (id: number) => [...userlistKeys.detail(id), "items"],
  infiniteItems: (id: number, listingParams: ItemsListRequest) => [
    ...userlistKeys.infiniteItemsRoot(id),
    listingParams,
  ],
  membershipList: () => [...userlistKeys.root, "membershipList"],
}

const userlistQueries = {
  list: (params: ListRequest) =>
    ({
      queryKey: userlistKeys.list(params),
      queryFn: () => userListsApi.userlistsList(params).then((res) => res.data),
    }) satisfies QueryOptions,
  detail: (id: number) =>
    ({
      queryKey: userlistKeys.detail(id),
      queryFn: () =>
        userListsApi.userlistsRetrieve({ id }).then((res) => res.data),
    }) satisfies QueryOptions,
  infiniteItems: (id: number, listingParams: ItemsListRequest) => ({
    queryKey: userlistKeys.infiniteItems(id, listingParams),
    queryFn: async ({ pageParam }: { pageParam?: string } = {}) => {
      // Use generated API for first request, then use next parameter
      const request = pageParam
        ? axiosInstance.request<PaginatedUserListRelationshipList>({
            method: "get",
            url: pageParam,
          })
        : userListsApi.userlistsItemsList(listingParams)
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
  membershipList: () =>
    ({
      queryKey: userlistKeys.membershipList(),
      queryFn: () =>
        userListsApi.userlistsMembershipList().then((res) => res.data),
    }) satisfies QueryOptions,
}

export { userlistQueries, userlistKeys }
