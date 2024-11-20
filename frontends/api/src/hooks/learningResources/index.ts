import {
  UseQueryOptions,
  // useInfiniteQuery,
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
  PaginatedLearningResourceList,
  LearningResourcesApiLearningResourcesUserlistsPartialUpdateRequest,
  LearningResourcesApiLearningResourcesLearningPathsPartialUpdateRequest,
} from "../../generated/v1"
import learningResources, { updateListParents } from "./keyFactory"
import { invalidateResourceQueries } from "./invalidation"
import { invalidateUserListQueries } from "../userLists/invalidation"

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
    onSettled: (_response, _err, vars) => {
      invalidateResourceQueries(queryClient, vars.id, {
        skipFeatured: true,
      })
      vars.userlist_id?.forEach((userlistId) => {
        invalidateUserListQueries(queryClient, userlistId)
      })
    },
    onSuccess: (response, vars) => {
      queryClient.setQueriesData<PaginatedLearningResourceList>(
        learningResources.featured({}).queryKey,
        (featured) =>
          updateListParents(vars.id, featured, response.data, "userlist"),
      )
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
    onSettled: (_response, _err, vars) => {
      invalidateResourceQueries(queryClient, vars.id, {
        skipFeatured: true,
      })
      vars.learning_path_id?.forEach((learningPathId) => {
        invalidateResourceQueries(queryClient, learningPathId, {
          skipFeatured: true,
        })
      })
    },
    onSuccess: (response, vars) => {
      queryClient.setQueriesData<PaginatedLearningResourceList>(
        learningResources.featured({}).queryKey,
        (featured) =>
          updateListParents(vars.id, featured, response.data, "learningpath"),
      )
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
