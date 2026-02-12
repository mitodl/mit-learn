import axiosInstance from "../../axios"
import type {
  UserlistsApiUserlistsItemsListRequest as ItemsListRequest,
  UserlistsApiUserlistsListRequest as ListRequest,
  PaginatedUserListRelationshipList,
} from "../../generated/v1"
import { userListsApi } from "../../clients"
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"

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
    queryOptions({
      queryKey: userlistKeys.list(params),
      queryFn: () => userListsApi.userlistsList(params).then((res) => res.data),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: userlistKeys.detail(id),
      queryFn: () =>
        userListsApi.userlistsRetrieve({ id }).then((res) => res.data),
    }),
  infiniteItems: (id: number, listingParams: ItemsListRequest) =>
    infiniteQueryOptions({
      queryKey: userlistKeys.infiniteItems(id, listingParams),
      queryFn: async ({
        pageParam,
      }): Promise<PaginatedUserListRelationshipList> => {
        // Use generated API for first request, then use next parameter
        const request = pageParam
          ? axiosInstance.request<PaginatedUserListRelationshipList>({
              method: "get",
              url: pageParam,
            })
          : userListsApi.userlistsItemsList(listingParams)
        const { data } = await request
        return data
      },
      // Casting is so infiniteQueryOptions can infer the correct type for initialPageParam
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage) => {
        return lastPage.next ?? undefined
      },
    }),
  membershipList: () => ({
    queryKey: userlistKeys.membershipList(),
    queryFn: () =>
      userListsApi.userlistsMembershipList().then((res) => res.data),
  }),
}

export { userlistQueries, userlistKeys }
