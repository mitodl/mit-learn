import {
  UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { channelsApi } from "../../clients"
import type {
  ChannelsApiChannelsListRequest,
  PatchedChannelWriteRequest,
} from "../../generated/v0"
import { channelKeys, channelQueries } from "./queries"

const useChannelsList = (
  params: ChannelsApiChannelsListRequest = {},
  opts: Pick<UseQueryOptions, "enabled"> = {},
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

const useChannelPartialUpdate = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (data: PatchedChannelWriteRequest & { id: number }) =>
      channelsApi
        .channelsPartialUpdate({
          id: data.id,
          PatchedChannelWriteRequest: data,
        })
        .then((response) => response.data),
    onSuccess: (_data) => {
      client.invalidateQueries(channelKeys.root)
    },
  })
}

export {
  useChannelDetail,
  useChannelsList,
  useChannelPartialUpdate,
  useChannelCounts,
  channelQueries,
}
