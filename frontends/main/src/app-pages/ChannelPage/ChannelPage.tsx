"use client"

import React from "react"
import { useParams } from "next/navigation"
import { ChannelPageTemplate } from "./ChannelPageTemplate"
import { useChannelDetail } from "api/hooks/channels"
import ChannelSearch from "./ChannelSearch"
import { ChannelTypeEnum } from "api/v0"
import { LoadingSpinner, styled, Typography } from "ol-components"
import { getConstantSearchParams } from "./searchRequests"
import useChannelPageRedesign from "./useChannelPageRedesign"
import dynamic from "next/dynamic"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"

const LearningResourceDrawer = dynamic(
  () =>
    import("@/page-components/LearningResourceDrawer/LearningResourceDrawer"),
)

type RouteParams = {
  channelType: ChannelTypeEnum
  name: string
}

/**
 * The spinner while the flag loads, which stands in for the whole page.
 *
 * `LoadingSpinner` centres what is in it but is only as tall as the spinner,
 * so left alone it sits against the header with the rest of the page blank
 * below it. Filling the main element puts it in the middle of what the page
 * would have been -- the element is already sized to the viewport less the
 * header and the footer, so there is nothing here to keep in step with them.
 */
const PageLoadingSpinner = styled(LoadingSpinner)({
  position: "absolute",
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
})

const ChannelPage: React.FC = () => {
  const { channelType, name } = useParams<RouteParams>()
  const channelQuery = useChannelDetail(String(channelType), String(name))
  const publicDescription = channelQuery.data?.public_description

  const channelSearchFilter = channelQuery.data?.search_filter

  const searchParams = getConstantSearchParams(channelSearchFilter)
  const channelRedesign = useChannelPageRedesign(String(channelType))
  const flagsLoaded = useFeatureFlagsLoaded()

  // The whole page is behind the flag, so wait for the real value rather than
  // 403-ing on a bootstrapped `false` — same reasoning as ContractAdminPage.
  if (!flagsLoaded) {
    return <PageLoadingSpinner loading />
  }

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
