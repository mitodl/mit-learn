import { useQuery } from "@tanstack/react-query"
import { newsEventsQueries, newsEventsKeys } from "./queries"
import {
  NewsEventsApiNewsEventsListRequest,
  NewsEventsListFeedTypeEnum,
} from "@mitodl/mit-learn-api-axios/v0"

const useNewsEventsList = (params: NewsEventsApiNewsEventsListRequest) => {
  return useQuery({
    ...newsEventsQueries.list(params),
  })
}

const useNewsEventsDetail = (id: number) => {
  return useQuery(newsEventsQueries.detail(id))
}

export {
  useNewsEventsList,
  useNewsEventsDetail,
  NewsEventsListFeedTypeEnum,
  newsEventsQueries,
  newsEventsKeys,
}
