"use client"

import React from "react"
import { useParams } from "next/navigation"
import { ChannelPageTemplate } from "./ChannelPageTemplate"
import { useChannelDetail } from "api/hooks/channels"
import ChannelSearch from "./ChannelSearch"
import { ChannelTypeEnum } from "api/v0"
import {
  HEADER_HEIGHT,
  HEADER_HEIGHT_MD,
  LoadingSpinner,
  styled,
  Typography,
} from "ol-components"
import { getConstantSearchParams } from "./searchRequests"
import useChannelPageRedesign, {
  channelTypeUsesRedesignFlag,
} from "./useChannelPageRedesign"
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
 * `LoadingSpinner` centres what it holds but is only as tall as the spinner,
 * so it needs to be given something to centre within. It is pinned to the
 * page below the header instead of being centred by halves: `absolute` has
 * nothing to resolve against here -- neither wrapper around `main` is
 * positioned -- so it would answer to the initial containing block, and land
 * wherever that happens to put it rather than anywhere meant.
 *
 * Out of flow costs nothing: `main` is a flex child set to fill, so it keeps
 * its height with the spinner lifted off it and the footer stays put.
 */
const PageLoadingSpinner = styled(LoadingSpinner)(({ theme }) => ({
  position: "fixed",
  left: 0,
  right: 0,
  top: HEADER_HEIGHT,
  bottom: 0,
  [theme.breakpoints.down("md")]: {
    top: HEADER_HEIGHT_MD,
  },
}))

const ChannelPage: React.FC = () => {
  const { channelType, name } = useParams<RouteParams>()
  const channelQuery = useChannelDetail(String(channelType), String(name))
  const publicDescription = channelQuery.data?.public_description

  const channelSearchFilter = channelQuery.data?.search_filter

  const searchParams = getConstantSearchParams(channelSearchFilter)
  const channelRedesign = useChannelPageRedesign(String(channelType))
  const flagsLoaded = useFeatureFlagsLoaded()

  /**
   * The whole page is behind the flag, so wait for the real value rather than
   * deciding on a bootstrapped `false` — which reads the same as the page
   * being switched off. Same reasoning as ContractAdminPage.
   *
   * Only where there is something to wait for: only the department page is
   * still behind a flag. Every other one draws the
   * page it has always drawn whatever the flags come back saying, so waiting
   * on them buys a topic, unit or pathway page nothing but the spinner.
   */
  const awaitingFlags =
    channelTypeUsesRedesignFlag(String(channelType)) && !flagsLoaded
  if (awaitingFlags) {
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
