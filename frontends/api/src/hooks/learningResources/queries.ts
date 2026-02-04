import {
  learningResourcesApi,
  learningResourcesSearchApi,
  topicsApi,
  offerorsApi,
  platformsApi,
  schoolsApi,
  featuredApi,
} from "../../clients"

import type {
  LearningResource,
  LearningResourcesApiLearningResourcesListRequest as LearningResourcesListRequest,
  TopicsApiTopicsListRequest as TopicsListRequest,
  LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as LearningResourcesSearchRetrieveRequest,
  OfferorsApiOfferorsListRequest,
  PlatformsApiPlatformsListRequest,
  FeaturedApiFeaturedListRequest as FeaturedListParams,
  LearningResourcesApiLearningResourcesItemsListRequest as ItemsListRequest,
  LearningResourcesSearchResponse,
  LearningResourcesApiLearningResourcesSummaryListRequest as LearningResourcesSummaryListRequest,
} from "../../generated/v1"
import { queryOptions } from "@tanstack/react-query"
import { hasPosition, randomizeGroups } from "./util"

/* List memberships were previously determined in the learningResourcesApi
 * from user_list_parents and learning_path_parents on each resource.
 * Resource endpoints are now treated as public so that they can be
 * server rendered and cached on public CDN. The membership endpoints on
 * learningPathsApi and userListsApi are now used to determine membership.
 * Removing here to ensure they are not depended on anywhere, though they can
 * be removed from the GET APIs TODO.
 */
export const clearListMemberships = (
  resource: LearningResource,
): LearningResource => ({
  ...resource,
})

const learningResourceKeys = {
  root: ["learning_resources"],
  // list
  listsRoot: () => [...learningResourceKeys.root, "listsAll"],
  list: (params: LearningResourcesListRequest) => [
    ...learningResourceKeys.listsRoot(),
    params,
  ],
  summaryListRoot: () => [...learningResourceKeys.root, "summaryList"],
  summaryList: (params: LearningResourcesSummaryListRequest) => [
    ...learningResourceKeys.summaryListRoot(),
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
    queryOptions({
      queryKey: learningResourceKeys.detail(id),
      queryFn: () =>
        learningResourcesApi
          .learningResourcesRetrieve({ id })
          .then((res) => clearListMemberships(res.data)),
    }),
  items: (id: number, params: ItemsListRequest) =>
    queryOptions({
      queryKey: learningResourceKeys.items(id, params),
      queryFn: () => {
        return learningResourcesApi
          .learningResourcesItemsList(params)
          .then((res) =>
            res.data.results.map((rel) => clearListMemberships(rel.resource)),
          )
      },
    }),
  similar: (id: number) =>
    queryOptions({
      queryKey: learningResourceKeys.similar(id),
      queryFn: () =>
        learningResourcesApi
          .learningResourcesSimilarList({ id })
          .then((res) => res.data.map(clearListMemberships)),
    }),
  vectorSimilar: (id: number) =>
    queryOptions({
      queryKey: learningResourceKeys.vectorSimilar(id),
      queryFn: () =>
        learningResourcesApi
          .learningResourcesVectorSimilarList({ id })
          .then((res) => res.data.map(clearListMemberships)),
    }),
  list: (params: LearningResourcesListRequest) =>
    queryOptions({
      queryKey: learningResourceKeys.list(params),
      queryFn: () =>
        learningResourcesApi.learningResourcesList(params).then((res) => ({
          ...res.data,
          results: res.data.results.map(clearListMemberships),
        })),
    }),
  summaryList: (params: LearningResourcesSummaryListRequest) =>
    queryOptions({
      queryKey: learningResourceKeys.summaryList(params),
      queryFn: () =>
        learningResourcesApi
          .learningResourcesSummaryList(params)
          .then((res) => res.data),
    }),
  featured: (params: FeaturedListParams = {}) =>
    queryOptions({
      queryKey: learningResourceKeys.featured(params),
      queryFn: () =>
        featuredApi.featuredList(params).then((res) => {
          const results = res.data.results
          const withPosition = results.filter(hasPosition)
          if (withPosition.length !== results.length) {
            // Should not happen. The featured API always sets position.
            console.warn(
              "Some featured results are missing position information.",
            )
          }
          return {
            ...res.data,
            results: randomizeGroups(withPosition),
          }
        }),
    }),
  search: (params: LearningResourcesSearchRetrieveRequest) =>
    queryOptions({
      queryKey: learningResourceKeys.search(params),
      queryFn: () =>
        learningResourcesSearchApi.learningResourcesSearchRetrieve(params).then(
          (res) =>
            ({
              ...res.data,
              results: res.data.results.map(clearListMemberships),
            }) as LearningResourcesSearchResponse,
        ),
    }),
}

const topicQueries = {
  list: (params: TopicsListRequest) =>
    queryOptions({
      queryKey: topicsKeys.list(params),
      queryFn: () => topicsApi.topicsList(params).then((res) => res.data),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: topicsKeys.detail(id),
      queryFn: () => topicsApi.topicsRetrieve({ id }).then((res) => res.data),
    }),
}

const platformsQueries = {
  list: (params: PlatformsApiPlatformsListRequest) => ({
    queryKey: platformsKeys.list(params),
    queryFn: () => platformsApi.platformsList(params).then((res) => res.data),
  }),
}

const schoolQueries = {
  list: () =>
    queryOptions({
      queryKey: schoolKeys.list(),
      queryFn: () => schoolsApi.schoolsList().then((res) => res.data),
    }),
}

const offerorQueries = {
  list: (params: OfferorsApiOfferorsListRequest) =>
    queryOptions({
      queryKey: offerorsKeys.list(params),
      queryFn: () => offerorsApi.offerorsList(params).then((res) => res.data),
    }),
}

export {
  learningResourceKeys,
  learningResourceQueries,
  topicQueries,
  platformsQueries,
  schoolQueries,
  offerorQueries,
}
