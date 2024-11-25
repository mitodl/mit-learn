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
  LearningPathRelationshipRequest,
  MicroLearningPathRelationship,
  LearningPathResource,
} from "../../generated/v1"
import { learningPathsApi } from "../../clients"
import learningPaths from "./keyFactory"
import { invalidateResourceQueries } from "../learningResources/invalidation"

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
    onSettled: (_data, _err, vars) => {
      invalidateResourceQueries(queryClient, vars.id)
    },
  })
}

const useLearningPathDestroy = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: DestroyRequest) =>
      learningPathsApi.learningpathsDestroy(params),
    onSettled: (_data, _err, vars) => {
      invalidateResourceQueries(queryClient, vars.id)
    },
  })
}

interface ListItemMoveRequest {
  parent: number
  id: number
  position?: number
}
const useLearningPathRelationshipMove = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ parent, id, position }: ListItemMoveRequest) =>
      learningPathsApi.learningpathsItemsPartialUpdate({
        learning_resource_id: parent,
        id,
        PatchedLearningPathRelationshipRequest: { position },
      }),
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries(
        learningPaths.detail(vars.parent)._ctx.infiniteItems._def,
      )
    },
  })
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

const useLearningPathRelationshipCreate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: LearningPathRelationshipRequest) =>
      learningPathsApi.learningpathsItemsCreate({
        learning_resource_id: params.parent,
        LearningPathRelationshipRequest: params,
      }),
    onSettled: (_response, _err, vars) => {
      invalidateResourceQueries(
        queryClient,
        vars.child,
        // do NOT skip invalidating the /featured/ lists,
        // Changing a learning path might change the members of the featured
        // lists.
        { skipFeatured: false },
      )
      invalidateResourceQueries(queryClient, vars.parent)
    },
  })
}

const useLearningPathRelationshipDestroy = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: MicroLearningPathRelationship) =>
      learningPathsApi.learningpathsItemsDestroy({
        id: params.id,
        learning_resource_id: params.parent,
      }),
    onSettled: (_response, _err, vars) => {
      invalidateResourceQueries(
        queryClient,
        vars.child,
        // do NOT skip invalidating the /featured/ lists,
        // Changing a learning path might change the members of the featured
        // lists.
        { skipFeatured: false },
      )
      invalidateResourceQueries(queryClient, vars.parent)
    },
  })
}

export {
  useLearningPathsList,
  useInfiniteLearningPathItems,
  useLearningPathsDetail,
  useLearningPathCreate,
  useLearningPathUpdate,
  useLearningPathDestroy,
  useLearningPathRelationshipMove,
  useLearningPathListItemMove,
  useLearningPathRelationshipCreate,
  useLearningPathRelationshipDestroy,
}