import { createQueryKeys } from "@lukemorales/query-key-factory"
import { learningPathsApi } from "../../clients"
import axiosInstance from "../../axios"
import type {
  LearningpathsApiLearningpathsItemsListRequest as ItemsListRequest,
  LearningpathsApiLearningpathsListRequest as ListRequest,
  PaginatedLearningPathRelationshipList,
} from "../../generated/v1"

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
        queryFn: ({ pageParam }: { pageParam?: string } = {}) => {
          // Use generated API for first request, then use next parameter
          const request = pageParam
            ? axiosInstance.request<PaginatedLearningPathRelationshipList>({
                method: "get",
                url: pageParam,
              })
            : learningPathsApi.learningpathsItemsList(itemsP)
          return request.then((res) => res.data)
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
})

export default learningPaths
