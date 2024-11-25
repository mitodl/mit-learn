import { createQueryKeys } from "@lukemorales/query-key-factory"
import { learningPathsApi } from "../../clients"
import axiosInstance from "../../axios"
import type {
  LearningpathsApiLearningpathsItemsListRequest as ItemsListRequest,
  LearningpathsApiLearningpathsListRequest as ListRequest,
  PaginatedLearningPathRelationshipList,
} from "../../generated/v1"
import { clearListMemberships } from "../learningResources/keyFactory"

const learningPaths = createQueryKeys("learningPaths", {
  detail: (id: number) => ({
    queryKey: [id],
    queryFn: () => {
      return learningPathsApi
        .learningpathsRetrieve({ id })
        .then((res) => res.data)
    },
    contextQueries: {
      infiniteItems: (itemsP: ItemsListRequest) => ({
        queryKey: [itemsP],
        queryFn: async ({ pageParam }: { pageParam?: string } = {}) => {
          // Use generated API for first request, then use next parameter
          const request = pageParam
            ? axiosInstance.request<PaginatedLearningPathRelationshipList>({
                method: "get",
                url: pageParam,
              })
            : learningPathsApi.learningpathsItemsList(itemsP)
          const { data } = await request
          return {
            ...data,
            results: data.results.map((relation) => ({
              ...relation,
              resource: clearListMemberships(relation.resource),
            })),
          }
        },
      }),
    },
  }),
  list: (params: ListRequest) => ({
    queryKey: [params],
    queryFn: () => {
      return learningPathsApi.learningpathsList(params).then((res) => res.data)
    },
  }),
  membershipList: () => ({
    queryKey: ["membershipList"],
    queryFn: async () => {
      const { data } = await learningPathsApi.learningpathsMembershipList()
      return data
    },
  }),
})

export default learningPaths
