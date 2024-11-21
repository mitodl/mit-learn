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
  // PaginatedLearningResourceList,
  LearningResourcesApiLearningResourcesUserlistsPartialUpdateRequest,
  LearningResourcesApiLearningResourcesLearningPathsPartialUpdateRequest,
  // MicroUserListRelationship,
} from "../../generated/v1"
import learningResources from "./keyFactory"
// import { invalidateResourceQueries } from "./invalidation"
// import { invalidateUserListQueries } from "../userLists/invalidation"
import userLists from "../userLists/keyFactory"
import learningPaths from "../learningPaths/keyFactory"

const useLearningResourcesList = (
  params: LRListRequest = {},
  opts: Pick<UseQueryOptions, "enabled"> = {},
) => {
  return useQuery({
    ...learningResources.list(params),
    ...opts,
  })
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

export {
  useLearningResourcesList,
  useFeaturedLearningResourcesList,
  useLearningResourcesDetail,
  useLearningResourceTopic,
  useLearningResourceTopics,
  useLearningResourcesSearch,
  useLearningResourceSetUserListRelationships,
  useLearningResourceSetLearningPathRelationships,
  useOfferorsList,
  usePlatformsList,
  useSchoolsList,
  learningResources as learningResourcesKeyFactory,
}
