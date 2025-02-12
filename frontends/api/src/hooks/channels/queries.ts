import { queryOptions } from "@tanstack/react-query"
import { channelsApi } from "../../clients"
import type { ChannelsApiChannelsListRequest as FieldsApiListRequest } from "../../generated/v0"

const channelKeys = {
  root: ["channel"],
  detailRoot: () => [...channelKeys.root, "detail"],
  detail: (id: number) => [...channelKeys.detailRoot(), id],
  detailByType: (channelType: string, name: string) => [
    ...channelKeys.detailRoot(),
    channelType,
    name,
  ],
  listRoot: () => [...channelKeys.root, "list"],
  list: (params: FieldsApiListRequest) => [...channelKeys.listRoot(), params],
  countsByType: (channelType: string) => [
    ...channelKeys.root,
    "counts",
    channelType,
  ],
}

const channelQueries = {
  list: (params: FieldsApiListRequest) =>
    queryOptions({
      queryKey: channelKeys.list(params),
      queryFn: () => channelsApi.channelsList(params).then((res) => res.data),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: channelKeys.detail(id),
      queryFn: () =>
        channelsApi.channelsRetrieve({ id }).then((res) => res.data),
    }),
  detailByType: (channelType: string, name: string) =>
    queryOptions({
      queryKey: channelKeys.detailByType(channelType, name),
      queryFn: () => {
        return channelsApi
          .channelsTypeRetrieve({ channel_type: channelType, name: name })
          .then((res) => res.data)
      },
    }),
  countsByType: (channelType: string) =>
    queryOptions({
      queryKey: channelKeys.countsByType(channelType),
      queryFn: () => {
        return channelsApi
          .channelsCountsList({ channel_type: channelType })
          .then((res) => res.data)
      },
    }),
}

export { channelQueries, channelKeys }
