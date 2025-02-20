import React, { useEffect, useRef, useState } from "react"
import styled from "@emotion/styled"
import { theme } from "ol-components"
import type { ImageConfig, LearningResourceCardProps } from "ol-components"
import { ResourceTypeEnum } from "api"
import type { LearningResource } from "api"
import { useToggle } from "ol-utilities"
import InfoSection from "./InfoSection"
import type { User } from "api/hooks/user"
import TitleSection from "./TitleSection"
import CallToActionSection from "./CallToActionSection"
import ResourceDescription from "./ResourceDescription"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagEnabled } from "posthog-js/react"
import AiSyllabusBotSlideDown from "./AiChatSyllabusSlideDown"

const DRAWER_WIDTH = "900px"

const Outer = styled.div<{ chatExpanded: boolean }>(({ chatExpanded }) => ({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  width: "100%",
  overflowX: "hidden",
  minWidth: DRAWER_WIDTH,
  [theme.breakpoints.down("md")]: {
    minWidth: "100%",
  },
  ...(chatExpanded && {
    "&::-webkit-scrollbar": {
      display: "none",
    },
    msOverflowStyle: "none",
    scrollbarWidth: "none",
  }),
}))

const ContentSection = styled.div({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  position: "relative",
})

const ChatLayer = styled("div")<{ top: number; chatExpanded: boolean }>(
  ({ top, chatExpanded }) => ({
    zIndex: 2,
    position: "absolute",
    top,
    bottom: 0,
    left: 0,
    right: 0,
    pointerEvents: chatExpanded ? "auto" : "none",
  }),
)

const TopContainer = styled.div<{ chatEnabled: boolean }>(
  ({ chatEnabled }) => ({
    display: "flex",
    flexDirection: "column",
    padding: chatEnabled ? "70px 28px 24px" : "0 28px 24px",
    [theme.breakpoints.down("md")]: {
      width: "auto",
      padding: chatEnabled ? "72px 16px 24px" : "0 16px 24px",
    },
  }),
)

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
})

const ContentContainer = styled.div({
  display: "flex",
  gap: "32px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column-reverse",
    gap: "16px",
  },
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
  const chatEnabled =
    useFeatureFlagEnabled(FeatureFlags.LrDrawerChatbot) &&
    resource?.resource_type === ResourceTypeEnum.Course

  const [chatExpanded, setChatExpanded] = useToggle(false)

  const outerContainerRef = useRef<HTMLDivElement>(null)
  const titleSectionRef = useRef<HTMLDivElement>(null)
  const [titleSectionHeight, setTitleSectionHeight] = useState(0)

  useEffect(() => {
    if (outerContainerRef.current && outerContainerRef.current.scrollTo) {
      outerContainerRef.current.scrollTo(0, 0)
    }
  }, [resourceId])

  useEffect(() => {
    const updateHeight = () => {
      if (titleSectionRef.current) {
        setTitleSectionHeight(titleSectionRef.current.offsetHeight)
      }
    }
    updateHeight()
    const resizeObserver = new ResizeObserver(updateHeight)

    if (titleSectionRef.current) {
      resizeObserver.observe(titleSectionRef.current)
    }
    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <Outer ref={outerContainerRef} chatExpanded={chatExpanded}>
      <TitleSection
        ref={titleSectionRef}
        titleId={titleId}
        resource={resource}
        closeDrawer={closeDrawer ?? (() => {})}
      />
      {chatEnabled ? (
        <ChatLayer top={titleSectionHeight} chatExpanded={chatExpanded}>
          <AiSyllabusBotSlideDown
            resource={resource}
            onToggleOpen={setChatExpanded}
          />
        </ChatLayer>
      ) : null}
      <ContentSection>
        <TopContainer chatEnabled={!!chatEnabled}>
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
      </ContentSection>
    </Outer>
  )
}

export { LearningResourceExpanded }
export type { LearningResourceExpandedProps }
