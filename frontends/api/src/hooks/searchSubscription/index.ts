import {
  useMutation,
  UseQueryOptions,
  useQueryClient,
  useQuery,
} from "@tanstack/react-query"
import { searchSubscriptionQueries, searchSubscriptionKeys } from "./keyFactory"
import type { LearningResourcesUserSubscriptionApiLearningResourcesUserSubscriptionSubscribeCreateRequest as subscriptionCreateRequest } from "../../generated/v1"
import { searchSubscriptionApi } from "../../clients"

const useSearchSubscriptionCreate = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: subscriptionCreateRequest = {}) =>
      searchSubscriptionApi
        .learningResourcesUserSubscriptionSubscribeCreate(params)
        .then((res) => res.data),
    onSuccess: (_data) => {
      queryClient.invalidateQueries(searchSubscriptionKeys.root)
    },
  })
}

const useSearchSubscriptionList = (
  params = {},
  opts: Pick<UseQueryOptions, "enabled"> = {},
) => {
  return useQuery({
    ...searchSubscriptionQueries.list(params),
    ...opts,
  })
}

const useSearchSubscriptionDelete = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => {
      return searchSubscriptionApi
        .learningResourcesUserSubscriptionUnsubscribeDestroy({ id })
        .then((res) => res.data)
    },
    onSuccess: (_data) => {
      queryClient.invalidateQueries(searchSubscriptionKeys.root)
    },
  })
}

export {
  useSearchSubscriptionList,
  useSearchSubscriptionCreate,
  useSearchSubscriptionDelete,
}
