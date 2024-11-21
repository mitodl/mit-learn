import {
  UseQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { userListsApi } from "../../clients"
import type {
  UserlistsApiUserlistsListRequest as ListRequest,
  UserlistsApiUserlistsCreateRequest as CreateRequest,
  UserlistsApiUserlistsDestroyRequest as DestroyRequest,
  UserlistsApiUserlistsItemsListRequest as ItemsListRequest,
  UserList,
} from "../../generated/v1"
import userLists from "./keyFactory"
import { invalidateResourceWithUserListQueries } from "../learningResources/invalidation"
import { invalidateUserListQueries } from "./invalidation"

const useUserListList = (
  params: ListRequest = {},
  opts: Pick<UseQueryOptions, "enabled"> = {},
) => {
  return useQuery({
    ...userLists.list(params),
    ...opts,
  })
}

const useUserListsDetail = (id: number) => {
  return useQuery(userLists.detail(id))
}

const useUserListCreate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: CreateRequest["UserListRequest"]) =>
      userListsApi.userlistsCreate({
        UserListRequest: params,
      }),
    onSettled: () => {
      queryClient.invalidateQueries(userLists.list._def)
    },
  })
}
const useUserListUpdate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: Pick<UserList, "id"> & Partial<UserList>) =>
      userListsApi.userlistsPartialUpdate({
        id: params.id,
        PatchedUserListRequest: params,
      }),
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries(userLists.list._def)
      queryClient.invalidateQueries(userLists.detail(vars.id).queryKey)
    },
  })
}

const useUserListDestroy = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: DestroyRequest) =>
      userListsApi.userlistsDestroy(params),
    onSettled: (_data, _err, vars) => {
      invalidateUserListQueries(queryClient, vars.id)
      invalidateResourceWithUserListQueries(queryClient, vars.id)
    },
  })
}

const useInfiniteUserListItems = (
  params: ItemsListRequest,
  options: Pick<UseQueryOptions, "enabled"> = {},
) => {
  return useInfiniteQuery({
    ...userLists.detail(params.userlist_id)._ctx.infiniteItems(params),
    getNextPageParam: (lastPage) => {
      return lastPage.next ?? undefined
    },
    ...options,
  })
}

interface ListItemMoveRequest {
  parent: number
  id: number
  position?: number
}
const useUserListListItemMove = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ parent, id, position }: ListItemMoveRequest) => {
      await userListsApi.userlistsItemsPartialUpdate({
        userlist_id: parent,
        id,
        PatchedUserListRelationshipRequest: { position },
      })
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries(
        userLists.detail(vars.parent)._ctx.infiniteItems._def,
      )
    },
  })
}

export {
  useUserListList,
  useUserListsDetail,
  useUserListCreate,
  useUserListUpdate,
  useUserListDestroy,
  useInfiniteUserListItems,
  useUserListListItemMove,
}
