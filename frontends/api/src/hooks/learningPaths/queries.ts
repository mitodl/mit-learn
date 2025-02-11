import { learningPathsApi } from "../../clients"
import axiosInstance from "../../axios"
import type {
  LearningpathsApiLearningpathsItemsListRequest as ItemsListRequest,
  LearningpathsApiLearningpathsListRequest as ListRequest,
  PaginatedLearningPathRelationshipList,
} from "../../generated/v1"
import { clearListMemberships } from "../learningResources/queries"
import { QueryOptions, UseInfiniteQueryOptions } from "@tanstack/react-query"

const learningPathKeys = {
  root: ["learningPaths"],
  listRoot: () => [...learningPathKeys.root, "list"],
  list: (params: ListRequest) => [...learningPathKeys.listRoot(), params],
  detailRoot: () => [...learningPathKeys.root, "detail"],
  detail: (id: number) => [...learningPathKeys.detailRoot(), id],
  infiniteItemsRoot: (id: number) => [...learningPathKeys.detail(id), "items"],
  infiniteItems: (id: number, listingParams: ItemsListRequest) => [
    ...learningPathKeys.infiniteItemsRoot(id),
    listingParams,
  ],
  membershipList: () => [...learningPathKeys.root, "membershipList"],
}

const learningPathQueries = {
  list: (params: ListRequest) =>
    ({
      queryKey: learningPathKeys.list(params),
      queryFn: () =>
        learningPathsApi.learningpathsList(params).then((res) => res.data),
    }) satisfies QueryOptions,
  detail: (id: number) =>
    ({
      queryKey: learningPathKeys.detail(id),
      queryFn: () =>
        learningPathsApi.learningpathsRetrieve({ id }).then((res) => res.data),
    }) satisfies QueryOptions,
  infiniteItems: (id: number, listingParams: ItemsListRequest) =>
    ({
      queryKey: learningPathKeys.infiniteItems(id, listingParams),
      queryFn: async ({ pageParam }: { pageParam?: string } = {}) => {
        // Use generated API for first request, then use next parameter
        const request = pageParam
          ? axiosInstance.request<PaginatedLearningPathRelationshipList>({
              method: "get",
              url: pageParam,
            })
          : learningPathsApi.learningpathsItemsList(listingParams)
        const { data } = await request
        return {
          ...data,
          results: data.results.map((relation) => ({
            ...relation,
            resource: clearListMemberships(relation.resource),
          })),
        }
      },
    }) satisfies UseInfiniteQueryOptions,
  membershipList: () =>
    ({
      queryKey: learningPathKeys.membershipList(),
      queryFn: () =>
        learningPathsApi.learningpathsMembershipList().then((res) => res.data),
    }) satisfies QueryOptions,
}

export { learningPathQueries, learningPathKeys }
