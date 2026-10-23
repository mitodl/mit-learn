"use client"

import React from "react"
import { useParams } from "next/navigation"
import { ChannelPageTemplate } from "./ChannelPageTemplate"
import { useChannelDetail } from "api/hooks/channels"
import ChannelSearch from "./ChannelSearch"
import { ChannelTypeEnum } from "api/v0"
import { Typography } from "ol-components"
import { getConstantSearchParams } from "./searchRequests"
import useChannelPageRedesign from "./useChannelPageRedesign"
import dynamic from "next/dynamic"

const LearningResourceDrawer = dynamic(
  () =>
    import("@/page-components/LearningResourceDrawer/LearningResourceDrawer"),
)

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
  const channelRedesign = useChannelPageRedesign(String(channelType))

  return (
    name &&
    channelType && (
      <>
        <LearningResourceDrawer />
        <ChannelPageTemplate name={name} channelType={channelType}>
          {/* The redesigned topic page shows its description inside its own
              hero, beside the title -- see `TopicChannelTemplate`. Rendering
              it here as well would print it twice. */}
          {!channelRedesign && publicDescription && (
            <Typography variant="body1">{publicDescription}</Typography>
          )}
          {channelSearchFilter && (
            <ChannelSearch
              channelTitle={channelQuery.data!.title}
              constantSearchParams={searchParams}
              channelType={channelType}
              layout={channelRedesign ? "cards" : "default"}
            />
          )}
        </ChannelPageTemplate>
      </>
    )
  )
}

export default ChannelPage
