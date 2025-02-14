import React, { useEffect, useRef } from "react"
import styled from "@emotion/styled"
import { theme } from "ol-components"
import type { ImageConfig, LearningResourceCardProps } from "ol-components"
import type { LearningResource } from "api"
import { useToggle } from "ol-utilities"
import InfoSection from "./InfoSection"
import type { User } from "api/hooks/user"
import TitleSection from "./TitleSection"
import CallToActionSection from "./CallToActionSection"
import ResourceDescription from "./ResourceDescription"

const DRAWER_WIDTH = "900px"

const Outer = styled.div({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  width: "100%",
  overflowX: "hidden",
  minWidth: DRAWER_WIDTH,
  [theme.breakpoints.down("md")]: {
    minWidth: "100%",
  },
})

// const CHAT_WIDTH = "400px"
// const CHAT_RIGHT = "0px"

const Layers = styled.div({
  paddingRight: 0,
  position: "relative",
})

const Layer = styled.div({
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
})

// const ChatLayer = styled(Layer)({
//   zIndex: 2,
// })

const TopContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  padding: "0 28px 24px",
  [theme.breakpoints.down("md")]: {
    width: "auto",
    padding: "0 16px 24px",
  },
  // [showChatSelector]: {
  //   padding: "0 16px 24px 28px",
  //   [theme.breakpoints.between("sm", "md")]: {
  //     padding: "0 0 16px 24px",
  //   },
  // },
})

const BottomContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "32px",
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  background: theme.custom.colors.lightGray1,
  "> div": {
    width: "100%",
  },
  padding: "32px 28px",
  [theme.breakpoints.down("md")]: {
    padding: "16px 0 16px 16px",
  },
  // [showChatSelector]: {
  //   [theme.breakpoints.up("md")]: {
  //     padding: "32px 16px 32px 28px",
  //   },
  // },
})

// const MainCol = styled.div({
//   /**
//    * Note:
//    * Without a width specified, the carousels will overflow up to 100vw
//    */
//   maxWidth: DRAWER_WIDTH,
//   flex: 1,
//   [theme.breakpoints.down("md")]: {
//     maxWidth: "100%",
//   },
// })

/**
 * Chat offset from top of drawer.
 * 48px + 3rem = height of 1-line title plus padding.
 * If title is two lines, the chat will overflow into title.
 */
// const CHAT_TOP = "calc(48px + 3rem)"

// const ChatCol = styled.div({
//   zIndex: 2,
//   position: "fixed",
//   top: CHAT_TOP,
//   right: CHAT_RIGHT,
//   height: `calc(100vh - ${CHAT_TOP})`,
//   flex: 1,
//   boxSizing: "border-box",
//   padding: "0 16px 16px 16px",
//   maxWidth: CHAT_WIDTH,
//   [theme.breakpoints.down("md")]: {
//     maxWidth: "100%",
//     position: "static",
//   },
//   [theme.breakpoints.down("sm")]: {
//     height: "100%",
//   },
//   ".MitAiChat--title": {
//     paddingTop: "0px",
//   },
// })

const ContentContainer = styled.div({
  display: "flex",
  gap: "32px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column-reverse",
    gap: "16px",
  },
  // [theme.breakpoints.up("md")]: {
  //   [showChatSelector]: {
  //     flexDirection: "column-reverse",
  //     gap: "16px",
  //   },
  // },
})

const ContentLeft = styled.div({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  alignItems: "flex-start",
  gap: "24px",
  maxWidth: "100%",
})

const ContentRight = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
})

const TopCarouselContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  paddingTop: "24px",
})

type LearningResourceExpandedProps = {
  resourceId: number
  titleId?: string
  resource?: LearningResource
  user?: User
  shareUrl?: string
  imgConfig: ImageConfig
  topCarousels?: React.ReactNode[]
  bottomCarousels?: React.ReactNode[]
  inLearningPath?: boolean
  inUserList?: boolean
  onAddToLearningPathClick?: LearningResourceCardProps["onAddToLearningPathClick"]
  onAddToUserListClick?: LearningResourceCardProps["onAddToUserListClick"]
  closeDrawer?: () => void
}

const LearningResourceExpanded: React.FC<LearningResourceExpandedProps> = ({
  resourceId,
  resource,
  imgConfig,
  user,
  shareUrl,
  topCarousels,
  bottomCarousels,
  inUserList,
  inLearningPath,
  titleId,
  onAddToLearningPathClick,
  onAddToUserListClick,
  closeDrawer,
}) => {
  const chatEnabled = true //
  // useFeatureFlagEnabled(FeatureFlags.LrDrawerChatbot) &&
  // resource?.resource_type === ResourceTypeEnum.Course

  const [chatExpanded, setChatExpanded] = useToggle(false)
  // const showChat = chatEnabled && chatExpanded

  const outerContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (outerContainerRef.current && outerContainerRef.current.scrollTo) {
      outerContainerRef.current.scrollTo(0, 0)
    }
  }, [resourceId])

  useEffect(() => {
    if (chatExpanded && resource && !chatEnabled) {
      setChatExpanded.off()
    }
  }, [chatExpanded, resource, chatEnabled, setChatExpanded])

  // const chatOpen = !!(resource && showChat)

  return (
    <Outer ref={outerContainerRef}>
      <TitleSection
        titleId={titleId}
        resource={resource}
        closeDrawer={closeDrawer ?? (() => {})}
      />
      <Layers>
        <Layer></Layer>
        <Layer>
          <TopContainer>
            <ContentContainer>
              <ContentLeft>
                <ResourceDescription resource={resource} />
                <InfoSection resource={resource} />
              </ContentLeft>
              <ContentRight>
                <CallToActionSection
                  imgConfig={imgConfig}
                  resource={resource}
                  user={user}
                  shareUrl={shareUrl}
                  inLearningPath={inLearningPath}
                  inUserList={inUserList}
                  onAddToLearningPathClick={onAddToLearningPathClick}
                  onAddToUserListClick={onAddToUserListClick}
                />
              </ContentRight>
            </ContentContainer>
            {topCarousels && (
              <TopCarouselContainer>
                {topCarousels?.map((carousel, index) => (
                  <div key={index}>{carousel}</div>
                ))}
              </TopCarouselContainer>
            )}
          </TopContainer>
          <BottomContainer>
            {bottomCarousels?.map((carousel, index) => (
              <div key={index}>{carousel}</div>
            ))}
          </BottomContainer>
        </Layer>
      </Layers>
    </Outer>
  )
}

export { LearningResourceExpanded }
export type { LearningResourceExpandedProps }
