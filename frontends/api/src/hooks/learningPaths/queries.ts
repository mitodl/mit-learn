import { learningPathsApi } from "../../clients"
import axiosInstance from "../../axios"
import type {
  LearningpathsApiLearningpathsItemsListRequest as ItemsListRequest,
  LearningpathsApiLearningpathsListRequest as ListRequest,
  PaginatedLearningPathRelationshipList,
} from "../../generated/v1"
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"

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
    queryOptions({
      queryKey: learningPathKeys.list(params),
      queryFn: () =>
        learningPathsApi.learningpathsList(params).then((res) => res.data),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: learningPathKeys.detail(id),
      queryFn: () =>
        learningPathsApi.learningpathsRetrieve({ id }).then((res) => res.data),
    }),
  infiniteItems: (id: number, listingParams: ItemsListRequest) =>
    infiniteQueryOptions({
      queryKey: learningPathKeys.infiniteItems(id, listingParams),
      queryFn: async ({ pageParam }) => {
        // Use generated API for first request, then use next parameter
        const request = pageParam
          ? axiosInstance.request<PaginatedLearningPathRelationshipList>({
              method: "get",
              url: pageParam,
            })
          : learningPathsApi.learningpathsItemsList(listingParams)
        const { data } = await request
        return data
      },
      // Casting is so infiniteQueryOptions can infer the correct type for initialPageParam
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage) => {
        return lastPage.next ?? undefined
      },
    }),
  membershipList: () =>
    queryOptions({
      queryKey: learningPathKeys.membershipList(),
      queryFn: () =>
        learningPathsApi.learningpathsMembershipList().then((res) => res.data),
    }),
}

export { learningPathQueries, learningPathKeys }
