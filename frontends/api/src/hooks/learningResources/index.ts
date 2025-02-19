import {
  keepPreviousData,
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
// import learningResources from "./keyFactory"
import {
  learningResourceQueries,
  offerorQueries,
  topicQueries,
  schoolQueries,
  platformsQueries,
} from "./queries"
import { userlistKeys } from "../userLists/queries"
import { learningPathKeys } from "../learningPaths/queries"
import { useCallback } from "react"

const useLearningResourcesList = (
  params: LRListRequest = {},
  opts?: { enabled?: boolean },
) => {
  return useQuery({
    ...learningResourceQueries.list(params),
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
        learningResourceQueries.detail(resource.id).queryKey,
        resource,
      )
    }
  }, [resource, queryClient])
  return onClick
}

const useLearningResourcesDetail = (id: number) => {
  return useQuery(learningResourceQueries.detail(id))
}

const useFeaturedLearningResourcesList = (params: FeaturedListParams = {}) => {
  return useQuery(learningResourceQueries.featured(params))
}

const useLearningResourceTopic = (id: number, opts?: { enabled?: boolean }) => {
  return useQuery({
    ...topicQueries.detail(id),
    ...opts,
  })
}

const useLearningResourceTopics = (
  params: TopicsListRequest = {},
  opts?: { enabled?: boolean },
) => {
  return useQuery({
    ...topicQueries.list(params),
    ...opts,
  })
}

const useLearningResourcesSearch = (
  params: LRSearchRequest,
  opts?: {
    keepPreviousData?: boolean
  },
) => {
  return useQuery({
    ...learningResourceQueries.search(params),
    placeholderData: opts?.keepPreviousData ? keepPreviousData : undefined,
  })
}

const useLearningResourceSetUserListRelationships = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      params: LearningResourcesApiLearningResourcesUserlistsPartialUpdateRequest,
    ) => learningResourcesApi.learningResourcesUserlistsPartialUpdate(params),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userlistKeys.membershipList() })
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
      queryClient.invalidateQueries({
        queryKey: learningPathKeys.membershipList(),
      })
    },
  })
}

const useOfferorsList = (
  params: OfferorsApiOfferorsListRequest = {},
  opts?: { enabled?: boolean },
) => {
  return useQuery({
    ...offerorQueries.list(params),
    ...opts,
  })
}

const usePlatformsList = (
  params: PlatformsApiPlatformsListRequest = {},
  opts?: { enabled?: boolean },
) => {
  return useQuery({
    ...platformsQueries.list(params),
    ...opts,
  })
}

const useSchoolsList = () => {
  return useQuery(schoolQueries.list())
}

const useSimilarLearningResources = (
  id: number,
  opts?: { enabled?: boolean },
) => {
  return useQuery({
    ...learningResourceQueries.similar(id),
    ...opts,
  })
}

const useVectorSimilarLearningResources = (
  id: number,
  opts?: { enabled?: boolean },
) => {
  return useQuery({
    ...learningResourceQueries.vectorSimilar(id),
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
  learningResourceQueries,
  offerorQueries,
  schoolQueries,
  platformsQueries,
  topicQueries,
}
