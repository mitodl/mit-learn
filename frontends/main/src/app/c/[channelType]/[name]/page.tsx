import React from "react"
import ChannelPage from "@/app-pages/ChannelPage/ChannelPage"
import { channelsApi } from "api/clients"
import { ChannelTypeEnum } from "api/v0"
import { getMetadataAsync } from "@/common/metadata"
import handleNotFound from "@/common/handleNotFound"
import type { PageParams } from "@/app/types"

type RouteParams = {
  channelType: ChannelTypeEnum
  name: string
}

export async function generateMetadata({
  searchParams,
  params,
}: PageParams<never, RouteParams>) {
  const { channelType, name } = await params

  const { data } = await handleNotFound(
    channelsApi.channelsTypeRetrieve({ channel_type: channelType, name: name }),
  )

  return getMetadataAsync({
    searchParams,
    title: data.title,
    description: data.public_description,
  })
}

const Page: React.FC = () => {
  return <ChannelPage />
}

export default Page
