import {
  UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { learningResourcesApi } from "../../clients"
import type {
  LearningResourcesApiLearningResourcesListRequest as LRListRequest,
  TopicsApiTopicsListRequest as TopicsListRequest,
  LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as LRSearchRequest,
  OfferorsApiOfferorsListRequest,
  PlatformsApiPlatformsListRequest,
  FeaturedApiFeaturedListRequest as FeaturedListParams,
  LearningResourcesApiLearningResourcesUserlistsPartialUpdateRequest,
  LearningResourcesApiLearningResourcesLearningPathsPartialUpdateRequest,
  LearningResource,
} from "../../generated/v1"
import learningResources from "./keyFactory"
import userLists from "../userLists/keyFactory"
import learningPaths from "../learningPaths/keyFactory"
import { useCallback } from "react"

const useLearningResourcesList = (
  params: LRListRequest = {},
  opts: Pick<UseQueryOptions, "enabled"> = {},
) => {
  return useQuery({
    ...learningResources.list(params),
    ...opts,
  })
}

const useLearningResourceDetailSetCache = (
  resource: LearningResource | null | undefined,
) => {
  const queryClient = useQueryClient()
  const onClick = useCallback(() => {
    if (resource) {
      queryClient.setQueryData(
        learningResources.detail(resource.id).queryKey,
        resource,
      )
    }
  }, [resource, queryClient])
  return onClick
}

const useLearningResourcesDetail = (id: number) => {
  return useQuery(learningResources.detail(id))
}

const useFeaturedLearningResourcesList = (params: FeaturedListParams = {}) => {
  return useQuery(learningResources.featured(params))
}

const useLearningResourceTopic = (
  id: number,
  opts: Pick<UseQueryOptions, "enabled"> = {},
) => {
  return useQuery({
    ...learningResources.topic(id),
    ...opts,
  })
}

const useLearningResourceTopics = (
  params: TopicsListRequest = {},
  opts: Pick<UseQueryOptions, "enabled"> = {},
) => {
  return useQuery({
    ...learningResources.topics(params),
    ...opts,
  })
}

const useLearningResourcesSearch = (
  params: LRSearchRequest,
  opts?: Pick<UseQueryOptions, "keepPreviousData">,
) => {
  return useQuery({
    ...learningResources.search(params),
    ...opts,
  })
}

const useLearningResourceSetUserListRelationships = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      params: LearningResourcesApiLearningResourcesUserlistsPartialUpdateRequest,
    ) => learningResourcesApi.learningResourcesUserlistsPartialUpdate(params),
    onSettled: () => {
      queryClient.invalidateQueries(userLists.membershipList().queryKey)
    },
  })
}

const useLearningResourceSetLearningPathRelationships = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      params: LearningResourcesApiLearningResourcesLearningPathsPartialUpdateRequest,
    ) =>
      learningResourcesApi.learningResourcesLearningPathsPartialUpdate(params),
    onSettled: () => {
      queryClient.invalidateQueries(learningPaths.membershipList().queryKey)
    },
  })
}

const useOfferorsList = (
  params: OfferorsApiOfferorsListRequest = {},
  opts: Pick<UseQueryOptions, "enabled"> = {},
) => {
  return useQuery({
    ...learningResources.offerors(params),
    ...opts,
  })
}

const usePlatformsList = (
  params: PlatformsApiPlatformsListRequest = {},
  opts: Pick<UseQueryOptions, "enabled"> = {},
) => {
  return useQuery({
    ...learningResources.platforms(params),
    ...opts,
  })
}

const useSchoolsList = () => {
  return useQuery(learningResources.schools())
}

const useSimilarLearningResources = (
  id: number,
  opts: Pick<UseQueryOptions, "enabled"> = {},
) => {
  return useQuery({
    ...learningResources.similar(id),
    ...opts,
  })
}

const useVectorSimilarLearningResources = (
  id: number,
  opts: Pick<UseQueryOptions, "enabled"> = {},
) => {
  return useQuery({
    ...learningResources.vectorSimilar(id),
    ...opts,
  })
}

export {
  useLearningResourcesList,
  useFeaturedLearningResourcesList,
  useLearningResourcesDetail,
  useLearningResourceDetailSetCache,
  useLearningResourceTopic,
  useLearningResourceTopics,
  useLearningResourcesSearch,
  useLearningResourceSetUserListRelationships,
  useLearningResourceSetLearningPathRelationships,
  useOfferorsList,
  usePlatformsList,
  useSchoolsList,
  useSimilarLearningResources,
  useVectorSimilarLearningResources,
  learningResources,
}
