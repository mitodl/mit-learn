import {
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
import { learningPathQueries, learningPathKeys } from "./queries"
import { useUserHasPermission, Permission } from "api/hooks/user"

const useLearningPathsList = (
  params: ListRequest = {},
  opts?: { enabled?: boolean },
) => {
  return useQuery({
    ...learningPathQueries.list(params),
    ...opts,
  })
}

const useInfiniteLearningPathItems = (
  params: ItemsListRequest,
  opts?: { enabled?: boolean },
) => {
  return useInfiniteQuery({
    ...learningPathQueries.infiniteItems(params.learning_resource_id, params),
    ...opts,
  })
}

const useLearningPathsDetail = (id: number) => {
  return useQuery(learningPathQueries.detail(id))
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
      queryClient.invalidateQueries({ queryKey: learningPathKeys.listRoot() })
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
      queryClient.invalidateQueries({ queryKey: learningPathKeys.listRoot() })
      queryClient.invalidateQueries({
        queryKey: learningPathKeys.detail(vars.id),
      })
    },
  })
}

const useLearningPathDestroy = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: DestroyRequest) =>
      learningPathsApi.learningpathsDestroy(params),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: learningPathKeys.listRoot() })
      queryClient.invalidateQueries({
        queryKey: learningPathKeys.membershipList(),
      })
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
      queryClient.invalidateQueries({
        queryKey: learningPathKeys.infiniteItemsRoot(vars.parent),
      })
    },
  })
}

const useIsLearningPathMember = (resourceId?: number) => {
  return useQuery({
    ...learningPathQueries.membershipList(),
    select: (data) => {
      return !!data.find((relationship) => relationship.child === resourceId)
    },
    enabled:
      useUserHasPermission(Permission.LearningPathEditor) && !!resourceId,
  })
}

const useLearningPathMemberList = (resourceId?: number) => {
  return useQuery({
    ...learningPathQueries.membershipList(),
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
