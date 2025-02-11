import { searchSubscriptionApi } from "../../clients"
import type { LearningResourcesUserSubscriptionApiLearningResourcesUserSubscriptionCheckListRequest as subscriptionCheckListRequest } from "../../generated/v1"
import { QueryOptions } from "@tanstack/react-query"

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
    ({
      queryKey: searchSubscriptionKeys.list(params),
      queryFn: () =>
        searchSubscriptionApi
          .learningResourcesUserSubscriptionCheckList(params)
          .then((res) => res.data),
    }) satisfies QueryOptions,
}

export { searchSubscriptionQueries, searchSubscriptionKeys }
