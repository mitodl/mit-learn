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
import type { QueryOptions } from "@tanstack/react-query"

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

const learningResourceKeys = {
  root: ["learning_resources"],
  // list
  listsRoot: () => [...learningResourceKeys.root, "listsAll"],
  list: (params: LearningResourcesListRequest) => [
    ...learningResourceKeys.listsRoot(),
    params,
  ],
  // detail
  detailsRoot: () => [...learningResourceKeys.root, "detail"],
  detail: (id: number) => [...learningResourceKeys.detailsRoot(), id],
  similar: (id: number) => [...learningResourceKeys.detail(id), "similar"],
  vectorSimilar: (id: number) => [
    ...learningResourceKeys.detail(id),
    "vector_similar",
  ],
  itemsRoot: (id: number) => [...learningResourceKeys.detail(id), "items"],
  items: (id: number, params: ItemsListRequest) => [
    ...learningResourceKeys.itemsRoot(id),
    params,
  ],
  // featured
  featuredRoot: () => [...learningResourceKeys.root, "featureds"],
  featured: (params: FeaturedListParams) => [
    ...learningResourceKeys.featuredRoot(),
    params,
  ],
  // searching
  searchRoot: () => [...learningResourceKeys.root, "search"],
  search: (params: LearningResourcesSearchRetrieveRequest) => [
    ...learningResourceKeys.searchRoot(),
    params,
  ],
}

const topicsKeys = {
  root: ["topics"],
  listRoot: () => [...topicsKeys.root, "list"],
  list: (params: TopicsListRequest) => [...topicsKeys.listRoot(), params],
  detailRoot: () => [...topicsKeys.root, "detail"],
  detail: (id: number) => [...topicsKeys.detailRoot(), id],
}

const platformsKeys = {
  root: ["platforms"],
  listRoot: () => [...platformsKeys.root, "list"],
  list: (params: PlatformsApiPlatformsListRequest) => [
    ...platformsKeys.listRoot(),
    params,
  ],
}

const schoolKeys = {
  root: ["schools"],
  listRoot: () => [...schoolKeys.root, "list"],
  list: () => [...schoolKeys.listRoot()],
}

const offerorsKeys = {
  root: ["offerors"],
  listRoot: () => [...offerorsKeys.root, "list"],
  list: (params: OfferorsApiOfferorsListRequest) => [
    ...offerorsKeys.listRoot(),
    params,
  ],
}

const learningResourceQueries = {
  detail: (id: number) =>
    ({
      queryKey: learningResourceKeys.detail(id),
      queryFn: () =>
        learningResourcesApi
          .learningResourcesRetrieve({ id })
          .then((res) => clearListMemberships(res.data)),
    }) satisfies QueryOptions,
  items: (id: number, params: ItemsListRequest) => {
    return {
      queryKey: learningResourceKeys.items(id, params),
      queryFn: ({ pageParam }: { pageParam?: string } = {}) => {
        // Use generated API for first request, then use next parameter
        const request = pageParam
          ? axiosInstance.request<PaginatedLearningResourceRelationshipList>({
              method: "get",
              url: pageParam,
            })
          : learningResourcesApi.learningResourcesItemsList(params)
        return request.then((res) =>
          res.data.results.map((rel) => clearListMemberships(rel.resource)),
        )
      },
    } satisfies QueryOptions
  },
  similar: (id: number) => {
    return {
      queryKey: learningResourceKeys.similar(id),
      queryFn: () =>
        learningResourcesApi
          .learningResourcesSimilarList({ id })
          .then((res) => res.data.map(clearListMemberships)),
    } satisfies QueryOptions
  },
  vectorSimilar: (id: number) => {
    return {
      queryKey: learningResourceKeys.vectorSimilar(id),
      queryFn: () =>
        learningResourcesApi
          .learningResourcesVectorSimilarList({ id })
          .then((res) => res.data.map(clearListMemberships)),
    } satisfies QueryOptions
  },
  list: (params: LearningResourcesListRequest) => {
    return {
      queryKey: learningResourceKeys.list(params),
      queryFn: () =>
        learningResourcesApi.learningResourcesList(params).then((res) => ({
          ...res.data,
          results: res.data.results.map(clearListMemberships),
        })),
    } satisfies QueryOptions
  },
  featured: (params: FeaturedListParams = {}) => {
    return {
      queryKey: learningResourceKeys.featured(params),
      queryFn: () =>
        featuredApi.featuredList(params).then((res) => {
          return {
            ...res.data,
            results: randomizeResults(
              res.data.results.map(clearListMemberships),
            ),
          }
        }),
    } satisfies QueryOptions
  },
  search: (params: LearningResourcesSearchRetrieveRequest) => {
    return {
      queryKey: learningResourceKeys.search(params),
      queryFn: () =>
        learningResourcesSearchApi
          .learningResourcesSearchRetrieve(params)
          .then((res) => ({
            ...res.data,
            results: res.data.results.map(clearListMemberships),
          })),
    } satisfies QueryOptions
  },
}

const topicQueries = {
  list: (params: TopicsListRequest) => {
    return {
      queryKey: topicsKeys.list(params),
      queryFn: () => topicsApi.topicsList(params).then((res) => res.data),
    } satisfies QueryOptions
  },
  detail: (id: number) => {
    return {
      queryKey: topicsKeys.detail(id),
      queryFn: () => topicsApi.topicsRetrieve({ id }).then((res) => res.data),
    } satisfies QueryOptions
  },
}

const platformsQueries = {
  list: (params: PlatformsApiPlatformsListRequest) => {
    return {
      queryKey: platformsKeys.list(params),
      queryFn: () => platformsApi.platformsList(params).then((res) => res.data),
    } satisfies QueryOptions
  },
}

const schoolQueries = {
  list: () => {
    return {
      queryKey: schoolKeys.list(),
      queryFn: () => schoolsApi.schoolsList().then((res) => res.data),
    } satisfies QueryOptions
  },
}

const offerorQueries = {
  list: (params: OfferorsApiOfferorsListRequest) => {
    return {
      queryKey: offerorsKeys.list(params),
      queryFn: () => offerorsApi.offerorsList(params).then((res) => res.data),
    } satisfies QueryOptions
  },
}

export {
  learningResourceKeys,
  learningResourceQueries,
  topicQueries,
  platformsQueries,
  schoolQueries,
  offerorQueries,
}
