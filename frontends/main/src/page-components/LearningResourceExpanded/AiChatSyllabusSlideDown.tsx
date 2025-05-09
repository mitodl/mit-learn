import React, { useRef, useEffect } from "react"
import { Typography, styled } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import { RiSparkling2Line, RiArrowDownSLine } from "@remixicon/react"
import type { AiChatProps } from "@mitodl/smoot-design/ai"
import { LearningResource } from "api"
import { AiChat } from "@mitodl/smoot-design/ai"
import { getCsrfToken } from "@/common/utils"

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

const STARTERS: AiChatProps["conversationStarters"] = [
  { content: "What is this course about?" },
  { content: "What are the prerequisites for this course?" },
  { content: "How will this course be graded?" },
]

export const AiChatSyllabusOpener = ({
  open,
  className,
  onToggleOpen,
}: {
  open: boolean
  className?: string
  onToggleOpen: (open: boolean) => void
}) => {
  return (
    <Opener className={className}>
      <StyledButton
        variant="bordered"
        edge="rounded"
        aria-pressed={open}
        open={open}
        onClick={() => onToggleOpen(!open)}
      >
        <RiSparkling2Line />
        <Typography variant="body1">
          Ask<strong>TIM</strong> about this course
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
        chatId={resource.readable_id}
        entryScreenTitle="What do you want to know about this course?"
        conversationStarters={STARTERS}
        topPosition={contentTopPosition}
        scrollElement={scrollElement}
        requestOpts={{
          apiUrl: process.env.NEXT_PUBLIC_LEARN_AI_SYLLABUS_ENDPOINT!,
          fetchOpts: {
            headers: {
              "X-CSRFToken": getCsrfToken(),
            },
            credentials: "include",
          },
          transformBody: (messages) => ({
            collection_name: "content_files",
            message: messages[messages.length - 1].content,
            course_id: resource.readable_id,
          }),
        }}
      />
    </SlideDown>
  )
}

export default AiChatSyllabusSlideDown
