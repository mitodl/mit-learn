import React from "react"
import { styled, Breadcrumbs, Banner } from "ol-components"
import { backgroundSrcSetCSS } from "ol-utilities"
import { SearchSubscriptionToggle } from "@/page-components/SearchSubscriptionToggle/SearchSubscriptionToggle"
import { useChannelDetail } from "api/hooks/channels"
import ChannelMenu from "@/components/ChannelMenu/ChannelMenu"
import ChannelAvatar from "@/components/ChannelAvatar/ChannelAvatar"
import { SourceTypeEnum } from "api"
import { HOME as HOME_URL } from "../../common/urls"
import {
  CHANNEL_TYPE_BREADCRUMB_TARGETS,
  ChannelControls,
} from "./ChannelPageTemplate"
import backgroundSteps from "@/public/images/backgrounds/background_steps.jpg"

const ChildrenContainer = styled.div(({ theme }) => ({
  paddingTop: "40px",
  [theme.breakpoints.down("sm")]: {
    paddingTop: "24px",
  },
}))

const ChannelControlsContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "end",
  flexGrow: 0,
  flexShrink: 0,
  [theme.breakpoints.down("xs")]: {
    width: "100%",
  },
  [theme.breakpoints.down("sm")]: {
    mt: "8px",
    mb: "48px",
  },
  [theme.breakpoints.up("md")]: {
    mt: "0px",
    mb: "48px",
    width: "15%",
  },
}))

interface DefaultChannelTemplateProps {
  children: React.ReactNode
  channelType: string
  name: string
}

/**
 * Common structure for channel-oriented pages.
 *
 * Renders the channel title and avatar in a banner.
 */
const DefaultChannelTemplate: React.FC<DefaultChannelTemplateProps> = ({
  children,
  channelType,
  name,
}) => {
  const channel = useChannelDetail(String(channelType), String(name))
  const urlParams = new URLSearchParams(channel.data?.search_filter)
  const displayConfiguration = channel.data?.configuration

  return (
    <>
      <Banner
        navText={
          <Breadcrumbs
            variant="dark"
            ancestors={[
              { href: HOME_URL, label: "Home" },
              {
                href: CHANNEL_TYPE_BREADCRUMB_TARGETS[channelType].href,
                label: CHANNEL_TYPE_BREADCRUMB_TARGETS[channelType].label,
              },
            ]}
            current={channel.data?.title}
          />
        }
        avatar={
          displayConfiguration?.logo &&
          channel.data && (
            <ChannelAvatar
              imageVariant="inverted"
              formImageUrl={displayConfiguration.logo}
              imageSize="medium"
              channel={channel.data}
            />
          )
        }
        title={channel.data?.title}
        header={displayConfiguration?.heading}
        subHeader={displayConfiguration?.sub_heading}
        backgroundUrl={
          displayConfiguration?.banner_background ??
          backgroundSrcSetCSS(backgroundSteps)
        }
        extraActions={
          <ChannelControlsContainer>
            <ChannelControls>
              {channel.data?.search_filter ? (
                <SearchSubscriptionToggle
                  itemName={channel.data?.title}
                  sourceType={SourceTypeEnum.ChannelSubscriptionType}
                  searchParams={urlParams}
                />
              ) : null}
              {channel.data?.is_moderator ? (
                <ChannelMenu
                  channelType={String(channelType)}
                  name={String(name)}
                />
              ) : null}
            </ChannelControls>
          </ChannelControlsContainer>
        }
      />
      <ChildrenContainer>{children}</ChildrenContainer>
    </>
  )
}

export default DefaultChannelTemplate
