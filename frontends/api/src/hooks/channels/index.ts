import { useQuery } from "@tanstack/react-query"

import type { ChannelsApiChannelsListRequest } from "../../generated/v0"
import { channelQueries } from "./queries"

const useChannelsList = (
  params: ChannelsApiChannelsListRequest = {},
  opts?: { enabled?: boolean },
) => {
  return useQuery({
    ...channelQueries.list(params),
    ...opts,
  })
}

const useChannelDetail = (channelType: string, channelName: string) => {
  return useQuery({
    ...channelQueries.detailByType(channelType, channelName),
  })
}

const useChannelCounts = (channelType: string) => {
  return useQuery({
    ...channelQueries.countsByType(channelType),
  })
}

export { useChannelDetail, useChannelsList, useChannelCounts, channelQueries }
