import { searchSubscriptionApi } from "../../clients"
import type { LearningResourcesUserSubscriptionApiLearningResourcesUserSubscriptionCheckListRequest as subscriptionCheckListRequest } from "../../generated/v1"
import { queryOptions } from "@tanstack/react-query"

const searchSubscriptionKeys = {
  root: ["searchSubscriptions"],
  list: (params: subscriptionCheckListRequest) => [
    ...searchSubscriptionKeys.root,
    "list",
    params,
  ],
}

const searchSubscriptionQueries = {
  list: (params: subscriptionCheckListRequest) =>
    queryOptions({
      queryKey: searchSubscriptionKeys.list(params),
      queryFn: () =>
        searchSubscriptionApi
          .learningResourcesUserSubscriptionCheckList(params)
          .then((res) => res.data),
    }),
}

export { searchSubscriptionQueries, searchSubscriptionKeys }
