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
  // UserListRelationshipRequest,
  // MicroUserListRelationship,
  // PaginatedLearningResourceList,
} from "../../generated/v1"
// import learningResources from "../learningResources/keyFactory"
import userLists from "./keyFactory"
// import {
//   updateListParentsOnAdd,
//   updateListParentsOnDestroy,
// } from "./keyFactory"
import {
  invalidateResourceWithUserListQueries,
  // invalidateResourceQueries,
} from "../learningResources/invalidation"
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

// interface ListMoveRequest {
//   parent: number
//   id: number
//   position?: number
// }
// const useUserListRelationshipMove = () => {
//   const queryClient = useQueryClient()
//   return useMutation({
//     mutationFn: ({ parent, id, position }: ListMoveRequest) =>
//       userListsApi.userlistsItemsPartialUpdate({
//         userlist_id: parent,
//         id,
//         PatchedUserListRelationshipRequest: { position },
//       }),
//     onSettled: (_data, _err, vars) => {
//       queryClient.invalidateQueries(
//         userLists.detail(vars.parent)._ctx.infiniteItems._def,
//       )
//     },
//   })
// }

// const useUserListRelationshipCreate = () => {
//   const queryClient = useQueryClient()
//   return useMutation({
//     mutationFn: (params: UserListRelationshipRequest) =>
//       userListsApi.userlistsItemsCreate({
//         userlist_id: params.parent,
//         UserListRelationshipRequest: params,
//       }),
//     onSuccess: (response, _vars) => {
//       queryClient.setQueriesData<PaginatedLearningResourceList>(
//         learningResources.featured({}).queryKey,
//         (old) => updateListParentsOnAdd(response.data, old),
//       )
//     },
//     onSettled: (_response, _err, vars) => {
//       invalidateResourceQueries(
//         queryClient,
//         vars.child,
//         // Do NOT invalidate the featured lists. Re-fetching the featured list
//         // data will cause the order to change, since the /featured API returns
//         // at random order.
//         // Instead, `onSuccess` hook will manually update the data.
//         { skipFeatured: true },
//       )
//       invalidateUserListQueries(queryClient, vars.parent)
//     },
//   })
// }

// const useUserListRelationshipDestroy = () => {
//   const queryClient = useQueryClient()
//   return useMutation({
//     mutationFn: (params: MicroUserListRelationship) =>
//       userListsApi.userlistsItemsDestroy({
//         id: params.id,
//         userlist_id: params.parent,
//       }),
//     onSuccess: (_response, vars) => {
//       queryClient.setQueriesData<PaginatedLearningResourceList>(
//         learningResources.featured({}).queryKey,
//         (old) => updateListParentsOnDestroy(vars, old),
//       )
//     },
//     onSettled: (_response, _err, vars) => {
//       invalidateResourceQueries(
//         queryClient,
//         vars.child,
//         // Do NOT invalidate the featured lists. Re-fetching the featured list
//         // data will cause the order to change, since the /featured API returns
//         // at random order.
//         // Instead, `onSuccess` hook will manually update the data.
//         { skipFeatured: true },
//       )
//       invalidateUserListQueries(queryClient, vars.parent)
//     },
//   })
// }

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
  // useUserListRelationshipMove,
  // useUserListRelationshipCreate,
  // useUserListRelationshipDestroy,
  useInfiniteUserListItems,
  useUserListListItemMove,
}
