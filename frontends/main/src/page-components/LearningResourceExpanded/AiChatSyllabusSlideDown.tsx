import { env } from "@/env"
import React, { useRef, useEffect } from "react"
import { Typography, styled } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import { RiSparkling2Line, RiArrowDownSLine } from "@remixicon/react"
import { LearningResource } from "api"
import { AiChat } from "@mitodl/smoot-design/ai"
import { usePostHog } from "posthog-js/react"
import { PostHogEvents } from "@/common/constants"
import { getSyllabusChatProps } from "@/page-components/AiChat/syllabusChatConfig"

export enum ChatTransitionState {
  Closed = "Closed",
  Opening = "Opening",
  Open = "Open",
  Closing = "Closing",
}

const SlideDown = styled.div<{
  open: boolean
  chatTransitionState: ChatTransitionState
}>(({ theme, open, chatTransitionState }) => ({
  top: open ? 0 : "-100%",
  right: 0,
  left: 0,
  height: chatTransitionState === ChatTransitionState.Open ? "auto" : "100%",
  overflow:
    chatTransitionState !== ChatTransitionState.Open ? "hidden" : "visible",
  position:
    chatTransitionState === ChatTransitionState.Open ? "static" : "absolute",
  visibility:
    chatTransitionState === ChatTransitionState.Closed ? "hidden" : "visible",
  backgroundColor: theme.custom.colors.white,
  zIndex: 1,
  transition: "top 0.3s ease-in-out",
}))

const Opener = styled.div(({ theme }) => ({
  position: "relative",
  margin: "0 24px",
  [theme.breakpoints.down("md")]: {
    margin: "0 16px",
  },
  ":after": {
    content: "''",
    width: "100%",
    height: "50%",
    background: theme.custom.colors.white,
    display: "block",
    position: "absolute",
    top: "-24px",
    borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
    zIndex: 1,
    paddingTop: "24px",
  },
}))

const StyledButton = styled(Button)<{ open: boolean }>(({ theme, open }) => ({
  pointerEvents: "auto",
  display: "flex",
  flexDirection: "row",
  gap: "8px",
  position: "relative",
  zIndex: 2,
  width: "360px",
  margin: "0 auto",
  color: theme.custom.colors.darkGray2,
  borderColor: open
    ? theme.custom.colors.silverGray
    : theme.custom.colors.lightGray2,
  overflow: "hidden",
  paddingRight: "26px",
  "svg:first-child": {
    fill: theme.custom.colors.lightRed,
    width: "20px",
    height: "20px",
  },
  "&&": {
    ":hover": {
      backgroundColor: theme.custom.colors.white,
      borderColor: theme.custom.colors.silverGray,
    },
  },
  "svg:last-child": {
    transform: open ? "rotate(-180deg)" : "rotate(0deg)",
    transition: "transform 0.3s ease-in-out",
  },
}))

const Chevron = styled(RiArrowDownSLine)(({ theme }) => ({
  fill: theme.custom.colors.mitRed,
  position: "absolute",
  right: "9px",
}))

const StyledAiChat = styled(AiChat)<{
  topPosition: number
}>(({ topPosition }) => ({
  ".MitAiChat--root": {
    minHeight: `calc(100vh - ${topPosition}px)`,
  },
  ".MitAiChat--entryScreenContainer": {
    top: topPosition,
    paddingTop: "130px",
  },
  ".MitAiChat--messagesContainer": {
    position: "static",
  },
  ".MitAiChat--chatScreenContainer": {
    position: "static",
    paddingTop: 0,
  },
}))

export { SYLLABUS_STARTERS as STARTERS } from "@/page-components/AiChat/syllabusChatConfig"

export const AiChatSyllabusOpener = ({
  open,
  className,
  onToggleOpen,
  resource,
}: {
  open: boolean
  className?: string
  onToggleOpen: (open: boolean) => void
  resource: LearningResource
}) => {
  const posthog = usePostHog()

  return (
    <Opener className={className}>
      <StyledButton
        variant="bordered"
        edge="rounded"
        aria-pressed={open}
        open={open}
        onClick={() => {
          if (env("NEXT_PUBLIC_POSTHOG_API_KEY")) {
            posthog.capture(PostHogEvents.AskTimClicked, {
              type: "syllabus_bot",
              resourceId: resource.id,
              readableId: resource.readable_id,
              resourceType: resource.resource_type,
              platformCode: resource.platform?.code,
            })
          }
          onToggleOpen(!open)
        }}
      >
        <RiSparkling2Line />
        <Typography variant="body1">
          Ask<strong>TIM</strong> about this{" "}
          {resource.resource_category.toLowerCase()}
        </Typography>
        <Chevron />
      </StyledButton>
    </Opener>
  )
}

const AiChatSyllabusSlideDown = ({
  resource,
  open,
  onTransitionEnd,
  scrollElement,
  contentTopPosition,
  chatTransitionState,
}: {
  resource?: LearningResource
  open: boolean
  onTransitionEnd: () => void
  scrollElement: HTMLElement | null
  contentTopPosition: number
  chatTransitionState: ChatTransitionState
}) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    const _onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === element && event.propertyName === "top") {
        onTransitionEnd()
      }
    }
    if (!element) return
    element.addEventListener("transitionend", _onTransitionEnd)
    return () => {
      element.removeEventListener("transitionend", _onTransitionEnd)
    }
  }, [onTransitionEnd])

  if (!resource) return null

  return (
    <SlideDown
      open={open}
      chatTransitionState={chatTransitionState}
      inert={!open}
      ref={ref}
    >
      <StyledAiChat
        key={resource.readable_id}
        {...getSyllabusChatProps(resource)}
        topPosition={contentTopPosition}
        scrollElement={scrollElement}
      />
    </SlideDown>
  )
}

export default AiChatSyllabusSlideDown
