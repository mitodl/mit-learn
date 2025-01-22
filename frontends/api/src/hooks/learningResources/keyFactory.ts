import { createQueryKeys } from "@lukemorales/query-key-factory"
import {
  learningResourcesApi,
  learningResourcesSearchApi,
  topicsApi,
  offerorsApi,
  platformsApi,
  schoolsApi,
  featuredApi,
} from "../../clients"
import axiosInstance from "../../axios"
import type {
  LearningResource,
  LearningResourcesApiLearningResourcesListRequest as LearningResourcesListRequest,
  TopicsApiTopicsListRequest as TopicsListRequest,
  LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as LearningResourcesSearchRetrieveRequest,
  OfferorsApiOfferorsListRequest,
  PlatformsApiPlatformsListRequest,
  FeaturedApiFeaturedListRequest as FeaturedListParams,
  LearningResourcesApiLearningResourcesItemsListRequest as ItemsListRequest,
  PaginatedLearningResourceRelationshipList,
} from "../../generated/v1"

const shuffle = ([...arr]) => {
  let m = arr.length
  while (m) {
    const i = Math.floor(Math.random() * m--)
    ;[arr[m], arr[i]] = [arr[i], arr[m]]
  }
  return arr
}

const randomizeResults = ([...results]) => {
  const resultsByPosition: {
    [position: string]: (LearningResource & { position?: string })[] | undefined
  } = {}
  const randomizedResults: LearningResource[] = []
  results.forEach((result) => {
    if (!resultsByPosition[result?.position]) {
      resultsByPosition[result?.position] = []
    }
    resultsByPosition[result?.position ?? ""]?.push(result)
  })
  Object.keys(resultsByPosition)
    .sort()
    .forEach((position) => {
      const shuffled = shuffle(resultsByPosition[position] ?? [])
      randomizedResults.push(...shuffled)
    })
  return randomizedResults
}

/* List memberships were previously determined in the learningResourcesApi
 * from user_list_parents and learning_path_parents on each resource.
 * Resource endpoints are now treated as public so that they can be
 * server rendered and cached on public CDN. The membership endpoints on
 * learningPathsApi and userListsApi are now used to determine membership.
 * Removing here to ensure they are not depended on anywhere, though they can
 * be removed from the GET APIs TODO.
 */
export const clearListMemberships = (resource: LearningResource) => ({
  ...resource,
  user_list_parents: [],
  learning_path_parents: [],
})

const learningResources = createQueryKeys("learningResources", {
  detail: (id: number) => ({
    queryKey: ["detail", id],
    queryFn: async () => {
      const { data } = await learningResourcesApi.learningResourcesRetrieve({
        id,
      })
      return clearListMemberships(data)
    },
    contextQueries: {
      items: (itemsP: ItemsListRequest) => ({
        queryKey: [itemsP],
        queryFn: async ({ pageParam }: { pageParam?: string } = {}) => {
          // Use generated API for first request, then use next parameter
          const request = pageParam
            ? axiosInstance.request<PaginatedLearningResourceRelationshipList>({
                method: "get",
                url: pageParam,
              })
            : learningResourcesApi.learningResourcesItemsList(itemsP)
          const { data } = await request
          return {
            ...data,
            results: data.results?.map((relation) => ({
              ...clearListMemberships(relation.resource),
            })),
          }
        },
      }),
    },
  }),
  list: (params: LearningResourcesListRequest) => ({
    queryKey: [params],
    queryFn: async () => {
      const { data } = await learningResourcesApi.learningResourcesList(params)
      return {
        ...data,
        results: data.results.map(clearListMemberships),
      }
    },
  }),
  featured: (params: FeaturedListParams = {}) => ({
    queryKey: [params],
    queryFn: async () => {
      const { data } = await featuredApi.featuredList(params)
      return {
        ...data,
        results: randomizeResults(data.results.map(clearListMemberships)),
      }
    },
  }),
  topic: (id: number | undefined) => ({
    queryKey: [id],
    queryFn: () =>
      id ? topicsApi.topicsRetrieve({ id }).then((res) => res.data) : null,
  }),
  topics: (params: TopicsListRequest) => ({
    queryKey: [params],
    queryFn: () => topicsApi.topicsList(params).then((res) => res.data),
  }),
  search: (params: LearningResourcesSearchRetrieveRequest) => ({
    queryKey: [params],
    queryFn: async () => {
      const { data } =
        await learningResourcesSearchApi.learningResourcesSearchRetrieve(params)
      return {
        ...data,
        results: data.results.map(clearListMemberships),
      }
    },
  }),
  offerors: (params: OfferorsApiOfferorsListRequest) => ({
    queryKey: [params],
    queryFn: () => offerorsApi.offerorsList(params).then((res) => res.data),
  }),
  platforms: (params: PlatformsApiPlatformsListRequest) => ({
    queryKey: [params],
    queryFn: () => platformsApi.platformsList(params).then((res) => res.data),
  }),
  schools: () => ({
    queryKey: ["schools"],
    queryFn: () => schoolsApi.schoolsList().then((res) => res.data),
  }),
  similar: (id: number) => ({
    queryKey: [`similar_resources-${id}`],
    queryFn: () =>
      learningResourcesApi
        .learningResourcesSimilarList({ id })
        .then((res) => res.data),
  }),
  vectorSimilar: (id: number) => ({
    queryKey: [`vector_similar_resources-${id}`],
    queryFn: () =>
      learningResourcesApi
        .learningResourcesVectorSimilarList({ id })
        .then((res) => res.data),
  }),
})

export default learningResources
