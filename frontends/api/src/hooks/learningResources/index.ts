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
  PaginatedLearningResourceList,
  LearningResourcesApiLearningResourcesUserlistsPartialUpdateRequest,
  LearningResourcesApiLearningResourcesLearningPathsPartialUpdateRequest,
  MicroUserListRelationship,
} from "../../generated/v1"
import learningResources from "./keyFactory"
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

/**
 * Given
 *  - a LearningResource ID
 *  - a paginated list of current resources
 *  - a list of new relationships
 *  - the type of list
 * Update the resources' user_list_parents field to include the new relationships
 */
const updateListParents = (
  resourceId: number,
  staleResources?: PaginatedLearningResourceList,
  newRelationships?: MicroUserListRelationship[],
  listType?: "userlist" | "learningpath",
) => {
  if (!resourceId || !staleResources || !newRelationships || !listType)
    return staleResources
  const matchIndex = staleResources.results.findIndex(
    (res) => res.id === resourceId,
  )
  if (matchIndex === -1) return staleResources
  const updatedResults = [...staleResources.results]
  const newResource = { ...updatedResults[matchIndex] }
  if (listType === "userlist") {
    newResource.user_list_parents = newRelationships
  }
  if (listType === "learningpath") {
    newResource.learning_path_parents = newRelationships
  }
  updatedResults[matchIndex] = newResource
  return {
    ...staleResources,
    results: updatedResults,
  }
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
  useLearningResourceTopic,
  useLearningResourceTopics,
  useLearningResourcesSearch,
  useLearningResourceSetUserListRelationships,
  useLearningResourceSetLearningPathRelationships,
  useOfferorsList,
  usePlatformsList,
  useSchoolsList,
  learningResources,
  useSimilarLearningResources,
  useVectorSimilarLearningResources,
}
