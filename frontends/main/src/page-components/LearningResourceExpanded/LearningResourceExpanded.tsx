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
import AiSyllabusBotSlideDown, {
  AiChatSyllabusOpener,
} from "./AiChatSyllabusSlideDown"

const DRAWER_WIDTH = "900px"

enum ChatTransitionState {
  Closed = "Closed",
  Opening = "Opening",
  Open = "Open",
  Closing = "Closing",
}

const Outer = styled.div<{ chatExpanded: boolean }>(({ chatExpanded }) => ({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  width: "100%",
  // overflowX: "hidden",
  minWidth: DRAWER_WIDTH,
  scrollbarGutter: "stable",
  [theme.breakpoints.down("md")]: {
    minWidth: "100%",
  },
  position: "relative",
  // ...(chatExpanded && {
  //   overflow: "hidden",
  // }),
}))

const ScrollBlocker = styled.div<{
  chatTransitionState: ChatTransitionState
  titleSectionHeight: number
  scrollPosition: number
}>(({ chatTransitionState, titleSectionHeight, scrollPosition }) => {
  // if (
  //   [
  //     ChatTransitionState.Opening,
  //     ChatTransitionState.Closing,
  //     ChatTransitionState.Open,
  //   ].includes(chatTransitionState)
  // ) {
  //   return {
  //     overflow: "hidden",
  //     position: "absolute",
  //     top: 0,
  //     bottom: 0,
  //     width: "100%",
  //     "> div": {
  //       marginTop: titleSectionHeight - scrollPosition - 1,
  //     },
  //   }
  // }
  return chatTransitionState === ChatTransitionState.Open
    ? {
        // overflow: "hidden",
        // position: "absolute",
        // top: titleSectionHeight,
        // bottom: 0,
        // "> div": {
        //   marginTop: titleSectionHeight - scrollPosition - 1,
        // },
        display: "none",
      }
    : null
})

const ContentSection = styled.div<{ chatTransitionState: ChatTransitionState }>(
  ({ chatTransitionState }) => ({
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    position: "relative",
    // ...(chatTransitionState === ChatTransitionState.Opening && {
    //   position: "absolute",
    //   top: 0,
    //   bottom: 0,
    //   overflow: "hidden",
    // }),
  }),
)

// const ChatLayer = styled("div")<{ top: number; chatExpanded: boolean }>(
//   ({ top, chatExpanded }) => ({
//     zIndex: 2,
//     position: "absolute",
//     top,
//     bottom: 0,
//     left: 0,
//     right: 0,
//     pointerEvents: chatExpanded ? "auto" : "none",
//     overflow: "visible",
//     scrollbarGutter: chatExpanded ? "auto" : "stable",
//   }),
// )

const StyledAiChatSyllabusOpener = styled(AiChatSyllabusOpener)<{
  top: number
}>(({ top }) => ({
  position: "sticky",
  top,
  zIndex: 2,
}))

const TopContainer = styled.div<{ chatEnabled: boolean }>(
  ({ chatEnabled }) => ({
    display: "flex",
    flexDirection: "column",
    padding: chatEnabled ? "28px 28px 24px" : "0 28px 24px",
    [theme.breakpoints.down("md")]: {
      width: "auto",
      padding: chatEnabled ? "30px 16px 24px" : "0 16px 24px",
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
  // drawerRef: React.RefObject<HTMLDivElement>
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
  // drawerRef,
}) => {
  const [chatTransitionState, setChatTransitionState] = useState(
    ChatTransitionState.Closed,
  )

  const chatEnabled = true
  // useFeatureFlagEnabled(FeatureFlags.LrDrawerChatbot) &&
  // resource?.resource_type === ResourceTypeEnum.Course

  const [chatExpanded, setChatExpanded] = useToggle(false)
  // const [chatFullyExpanded, setChatFullyExpanded] = useToggle(false)

  const outerContainerRef = useRef<HTMLDivElement>(null)
  const titleSectionRef = useRef<HTMLDivElement>(null)
  const [titleSectionHeight, setTitleSectionHeight] = useState(0)
  // const [contentWindowHeight, setContentWindowHeight] = useState(0)
  const [scrollPosition, setScrollPosition] = useState(0)
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)

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
      // if (outerContainerRef.current) {
      //   setContentWindowHeight(
      //     outerContainerRef.current.offsetHeight - titleSectionHeight,
      //   )
      //   console.log(
      //     "contentWindowHeight",
      //     outerContainerRef.current.offsetHeight - titleSectionHeight,
      //   )
      // }
    }
    updateHeight()
    const resizeObserver = new ResizeObserver(updateHeight)

    if (titleSectionRef.current) {
      resizeObserver.observe(titleSectionRef.current)
    }
    // if (outerContainerRef.current) {
    //   resizeObserver.observe(outerContainerRef.current)
    // }
    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  // useEffect(() => {
  //   const container = outerContainerRef.current
  //   if (!container) return

  //   const handleScroll = () => {
  //     const scrollTop = container.scrollTop
  //     console.log("scrollPosition", scrollTop)
  //     setScrollPosition(scrollTop)
  //   }

  //   // Initial log
  //   handleScroll()

  //   container.addEventListener("scroll", handleScroll, { passive: false })
  //   return () => {
  //     container.removeEventListener("scroll", handleScroll)
  //   }
  // }, [])

  const onChatOpenerToggle = (open: boolean) => {
    const drawerPaper = outerContainerRef.current?.closest(
      ".MuiDrawer-paper",
    ) as HTMLElement
    setScrollElement(drawerPaper || null)

    if (open) {
      // setContentWindowHeight(window.innerHeight - titleSectionHeight)
      setChatTransitionState(ChatTransitionState.Opening)
      setScrollPosition(drawerPaper?.scrollTop ?? 0)
    } else {
      setChatTransitionState(ChatTransitionState.Closing)
      setTimeout(() => {
        console.log("setting scrollPosition", scrollPosition)
        drawerPaper!.scrollTop = scrollPosition
      }, 0)
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
    <Outer ref={outerContainerRef} chatExpanded={chatExpanded}>
      <TitleSection
        ref={titleSectionRef}
        titleId={titleId}
        resource={resource}
        closeDrawer={closeDrawer ?? (() => {})}
      />
      {chatEnabled ? (
        <>
          <StyledAiChatSyllabusOpener
            open={chatExpanded}
            top={titleSectionHeight}
            onToggleOpen={onChatOpenerToggle}
          />
          <AiSyllabusBotSlideDown
            resource={resource}
            open={chatExpanded}
            onTransitionEnd={onTransitionEnd}
            // contentWindowHeight={contentWindowHeight}
            contentTopPosition={titleSectionHeight}
            scrollElement={scrollElement}
          />
        </>
      ) : // <ChatLayer top={titleSectionHeight} chatExpanded={chatExpanded}>
      //   <AiSyllabusBotSlideDown
      //     resource={resource}
      //     onToggleOpen={setChatExpanded}
      //   />
      // </ChatLayer>
      null}
      <ScrollBlocker
        chatTransitionState={chatTransitionState}
        titleSectionHeight={titleSectionHeight}
        scrollPosition={scrollPosition}
      >
        <ContentSection
          chatTransitionState={chatTransitionState}
          inert={chatExpanded}
        >
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
      </ScrollBlocker>
    </Outer>
  )
}

export { LearningResourceExpanded }
export type { LearningResourceExpandedProps }
