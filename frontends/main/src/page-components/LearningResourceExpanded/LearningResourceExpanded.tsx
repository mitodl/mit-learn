import React, { useEffect, useRef, useState } from "react"
import styled from "@emotion/styled"
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
import AiSyllabusBotSlideDown, {
  AiChatSyllabusOpener,
  ChatTransitionState,
} from "./AiChatSyllabusSlideDown"
import { RESOURCE_DRAWER_PARAMS } from "@/common/urls"

const Outer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  width: "100%",
  [theme.breakpoints.down("md")]: {
    minWidth: "100%",
  },
  position: "relative",
}))

const ContentSection = styled.div<{
  chatTransitionState: ChatTransitionState
}>(({ chatTransitionState }) => ({
  display: chatTransitionState === ChatTransitionState.Open ? "none" : "flex",
  flexDirection: "column",
  flexGrow: 1,
  position: "relative",
}))

const TopContainer = styled.div<{ chatEnabled: boolean }>(
  ({ theme, chatEnabled }) => ({
    display: "flex",
    flexDirection: "column",
    padding: chatEnabled ? "28px 28px 24px" : "0 28px 24px",
    [theme.breakpoints.down("md")]: {
      width: "auto",
      padding: chatEnabled ? "30px 16px 24px" : "0 16px 24px",
    },
  }),
)

const BottomContainer = styled.div(({ theme }) => ({
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
    padding: "16px",
  },
}))

const ContentContainer = styled.div(({ theme }) => ({
  display: "flex",
  gap: "32px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column-reverse",
    gap: "16px",
  },
}))

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
  chatExpanded: boolean
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

const closeChat = () => {
  const params = new URLSearchParams(window.location.search)
  params.delete(RESOURCE_DRAWER_PARAMS.syllabus)
  window.history.replaceState({}, "", `?${params.toString()}`)
}

const openChat = () => {
  const params = new URLSearchParams(window.location.search)
  params.set(RESOURCE_DRAWER_PARAMS.syllabus, "")
  window.history.replaceState({}, "", `?${params.toString()}`)
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
  chatExpanded: initialChatExpanded,
}) => {
  const [chatTransitionState, setChatTransitionState] = useState(
    initialChatExpanded ? ChatTransitionState.Open : ChatTransitionState.Closed,
  )

  const learningResourceChatbotEnabled = useFeatureFlagEnabled(
    FeatureFlags.LrDrawerChatbot,
  )
  const programChatbotEnabled = useFeatureFlagEnabled(
    FeatureFlags.PrDrawerChatbot,
  )
  const chatEnabled =
    (learningResourceChatbotEnabled &&
      resource?.resource_type === ResourceTypeEnum.Course) ||
    (programChatbotEnabled &&
      resource?.resource_type === ResourceTypeEnum.Program)

  useEffect(() => {
    // If URL indicates syllabus open, but it's not enabled, update URL
    if (resource && !chatEnabled) {
      closeChat()
    }
  }, [resource, chatEnabled])

  const outerContainerRef = useRef<HTMLDivElement>(null)
  const titleSectionRef = useRef<HTMLDivElement>(null)
  const [titleSectionHeight, setTitleSectionHeight] = useState(0)
  const [scrollPosition, setScrollPosition] = useState(0)
  const scrollElementRef = useRef<HTMLElement | null>(null)
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)
  const [chatExpanded, setChatExpanded] = useToggle(initialChatExpanded)

  useEffect(() => {
    if (outerContainerRef?.current?.scrollTo) {
      outerContainerRef.current.scrollTo(0, 0)
    }
    if (scrollElementRef.current) {
      requestAnimationFrame(() => {
        scrollElementRef.current!.scrollTop = 0
      })
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

  useEffect(() => {
    if (outerContainerRef.current) {
      const drawerPaper = outerContainerRef.current?.closest(
        ".MuiDrawer-paper",
      ) as HTMLElement
      scrollElementRef.current = drawerPaper
      queueMicrotask(() => {
        setScrollElement(drawerPaper)
      })
    }
  }, [])

  useEffect(() => {
    if (
      scrollElementRef.current &&
      chatTransitionState === ChatTransitionState.Closing
    ) {
      scrollElementRef.current.scrollTop = scrollPosition
    }
  }, [chatTransitionState, scrollPosition])

  const onChatOpenerToggle = (open: boolean) => {
    if (open) {
      setChatTransitionState(ChatTransitionState.Opening)
      setScrollPosition(scrollElementRef.current?.scrollTop ?? 0)
      openChat()
    } else {
      setChatTransitionState(ChatTransitionState.Closing)
      closeChat()
    }
    setChatExpanded(open)
  }

  const onTransitionEnd = () => {
    if (chatTransitionState === ChatTransitionState.Opening) {
      setChatTransitionState(ChatTransitionState.Open)
    } else {
      setChatTransitionState(ChatTransitionState.Closed)
    }
  }

  return (
    <Outer ref={outerContainerRef}>
      <TitleSection
        ref={titleSectionRef}
        titleId={titleId}
        resource={resource}
        onClickClose={
          chatTransitionState === ChatTransitionState.Open
            ? () => onChatOpenerToggle(false)
            : closeDrawer
        }
      />
      {chatEnabled ? (
        <>
          {chatTransitionState !== ChatTransitionState.Open ? (
            <AiChatSyllabusOpener
              open={chatExpanded}
              onToggleOpen={onChatOpenerToggle}
            />
          ) : null}
          <AiSyllabusBotSlideDown
            resource={resource}
            open={chatExpanded}
            onTransitionEnd={onTransitionEnd}
            chatTransitionState={chatTransitionState}
            contentTopPosition={titleSectionHeight}
            scrollElement={scrollElement}
          />
        </>
      ) : null}
      <ContentSection chatTransitionState={chatTransitionState}>
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
