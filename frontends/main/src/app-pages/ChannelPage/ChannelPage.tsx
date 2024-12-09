"use client"

import React from "react"
import LearningResourceDrawer from "@/page-components/LearningResourceDrawer/LearningResourceDrawer"
import { useParams } from "next/navigation"
import { ChannelPageTemplate } from "./ChannelPageTemplate"
import { useChannelDetail } from "api/hooks/channels"
import ChannelSearch from "./ChannelSearch"
import { ChannelTypeEnum } from "api/v0"
import { Typography } from "ol-components"
import { getConstantSearchParams } from "./searchRequests"

type RouteParams = {
  channelType: ChannelTypeEnum
  name: string
}

const ChannelPage: React.FC = () => {
  const { channelType, name } = useParams<RouteParams>()
  const channelQuery = useChannelDetail(String(channelType), String(name))
  const publicDescription = channelQuery.data?.public_description

  const channelSearchFilter = channelQuery.data?.search_filter

  const searchParams = getConstantSearchParams(channelSearchFilter)

  return (
    name &&
    channelType && (
      <>
        <LearningResourceDrawer />
        <ChannelPageTemplate name={name} channelType={channelType}>
          {publicDescription && (
            <Typography variant="body1">{publicDescription}</Typography>
          )}
          {channelSearchFilter && (
            <ChannelSearch
              channelTitle={channelQuery.data!.title}
              constantSearchParams={searchParams}
              channelType={channelType}
            />
          )}
        </ChannelPageTemplate>
      </>
    )
  )
}

export default ChannelPage
