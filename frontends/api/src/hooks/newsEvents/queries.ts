import { queryOptions } from "@tanstack/react-query"
import { newsEventsApi } from "../../clients"
import type { NewsEventsApiNewsEventsListRequest } from "../../generated/v0"

const newsEventsKeys = {
  root: ["newsEvents"],
  listRoot: () => [...newsEventsKeys.root, "list"],
  list: (params: NewsEventsApiNewsEventsListRequest) => [
    ...newsEventsKeys.listRoot(),
    params,
  ],
  detailRoot: () => [...newsEventsKeys.root, "detail"],
  detail: (id: number) => [...newsEventsKeys.detailRoot(), id],
}

const newsEventsQueries = {
  list: (params: NewsEventsApiNewsEventsListRequest) =>
    queryOptions({
      queryKey: newsEventsKeys.list(params),
      queryFn: () =>
        newsEventsApi.newsEventsList(params).then((res) => res.data),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: newsEventsKeys.detail(id),
      queryFn: () =>
        newsEventsApi.newsEventsRetrieve({ id }).then((res) => res.data),
    }),
}

export { newsEventsQueries, newsEventsKeys }
