import {
  UseQueryOptions,
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query"
import type {
  LearningpathsApiLearningpathsListRequest as ListRequest,
  LearningpathsApiLearningpathsItemsListRequest as ItemsListRequest,
  LearningpathsApiLearningpathsCreateRequest as CreateRequest,
  LearningpathsApiLearningpathsDestroyRequest as DestroyRequest,
  LearningPathResource,
} from "../../generated/v1"
import { learningPathsApi } from "../../clients"
import learningPaths from "./keyFactory"
import { useUserHasPermission, Permission } from "api/hooks/user"

const useLearningPathsList = (
  params: ListRequest = {},
  opts: Pick<UseQueryOptions, "enabled"> = {},
) => {
  return useQuery({
    ...learningPaths.list(params),
    ...opts,
  })
}

const useInfiniteLearningPathItems = (
  params: ItemsListRequest,
  options: Pick<UseQueryOptions, "enabled"> = {},
) => {
  return useInfiniteQuery({
    ...learningPaths
      .detail(params.learning_resource_id)
      ._ctx.infiniteItems(params),
    getNextPageParam: (lastPage) => {
      return lastPage.next ?? undefined
    },
    ...options,
  })
}

const useLearningPathsDetail = (id: number) => {
  return useQuery(learningPaths.detail(id))
}

type LearningPathCreateRequest = Omit<
  CreateRequest["LearningPathResourceRequest"],
  "readable_id" | "resource_type"
>
const useLearningPathCreate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: LearningPathCreateRequest) =>
      learningPathsApi.learningpathsCreate({
        LearningPathResourceRequest: params,
      }),
    onSettled: () => {
      queryClient.invalidateQueries(learningPaths.list._def)
    },
  })
}

const useLearningPathUpdate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      params: Pick<LearningPathResource, "id"> & Partial<LearningPathResource>,
    ) =>
      learningPathsApi.learningpathsPartialUpdate({
        id: params.id,
        PatchedLearningPathResourceRequest: params,
      }),
    onSettled: (data, err, vars) => {
      queryClient.invalidateQueries(learningPaths.list._def)
      queryClient.invalidateQueries(learningPaths.detail(vars.id).queryKey)
    },
  })
}

const useLearningPathDestroy = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: DestroyRequest) =>
      learningPathsApi.learningpathsDestroy(params),
    onSettled: () => {
      queryClient.invalidateQueries(learningPaths.list._def)
      queryClient.invalidateQueries(learningPaths.membershipList._def)
    },
  })
}

interface ListItemMoveRequest {
  parent: number
  id: number
  position?: number
}

const useLearningPathListItemMove = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ parent, id, position }: ListItemMoveRequest) => {
      await learningPathsApi.learningpathsItemsPartialUpdate({
        learning_resource_id: parent,
        id,
        PatchedLearningPathRelationshipRequest: { position },
      })
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries(
        learningPaths.detail(vars.parent)._ctx.infiniteItems._def,
      )
    },
  })
}

const useIsLearningPathMember = (resourceId?: number) => {
  return useQuery({
    ...learningPaths.membershipList(),
    select: (data) => {
      return !!data.find((relationship) => relationship.child === resourceId)
    },
    enabled:
      useUserHasPermission(Permission.LearningPathEditor) && !!resourceId,
  })
}

const useLearningPathMemberList = (resourceId?: number) => {
  return useQuery({
    ...learningPaths.membershipList(),

    select: (data) => {
      return data
        .filter((relationship) => relationship.child === resourceId)
        .map((relationship) => relationship.parent.toString())
    },
    enabled:
      useUserHasPermission(Permission.LearningPathEditor) && !!resourceId,
  })
}

export {
  useLearningPathsList,
  useInfiniteLearningPathItems,
  useLearningPathsDetail,
  useLearningPathCreate,
  useLearningPathUpdate,
  useLearningPathDestroy,
  useLearningPathListItemMove,
  useIsLearningPathMember,
  useLearningPathMemberList,
}
