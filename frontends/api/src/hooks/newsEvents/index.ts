import { useQuery } from "@tanstack/react-query"
import { newsEventsQueries } from "./queries"
import {
  NewsEventsApiNewsEventsListRequest,
  NewsEventsListFeedTypeEnum,
} from "../../generated/v0/api"

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
}
