import React, { useRef, useEffect } from "react"
import { Typography, styled } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import {
  RiSparkling2Line,
  RiArrowDownSLine,
  RiCloseLine,
} from "@remixicon/react"
import type { AiChatProps } from "@mitodl/smoot-design/ai"
import { LearningResource } from "api"
import { useUserMe } from "api/hooks/user"
import type { User } from "api/hooks/user"
import AiChatWithEntryScreen from "../AiChat/AiChatWithEntryScreen"
import { getCsrfToken } from "@/common/utils"

const SlideDown = styled.div<{ open: boolean }>(({ theme, open }) => ({
  position: "absolute",
  top: open ? 0 : "-100%",
  width: "100%",
  height: "100%",
  backgroundColor: theme.custom.colors.white,
  transition: "top 0.3s ease-in-out",
}))

const Opener = styled.div(({ theme }) => ({
  ":after": {
    content: "''",
    width: "100%",
    height: "50%",
    background: theme.custom.colors.white,
    display: "block",
    position: "absolute",
    top: 0,
    borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
    zIndex: 1,
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
  "svg:first-child": {
    fill: theme.custom.colors.lightRed,
    width: "20px",
    height: "20px",
  },
  "&&": {
    ":hover": {
      backgroundColor: theme.custom.colors.white,
      borderColor: open
        ? theme.custom.colors.darkGray1
        : theme.custom.colors.silverGray,
      "svg:last-child": {
        backgroundColor: open ? theme.custom.colors.darkGray1 : "transparent",
      },
    },
  },
}))

const OpenChevron = styled(RiArrowDownSLine)(({ theme }) => ({
  fill: theme.custom.colors.mitRed,
  position: "absolute",
  right: "9px",
}))

const CloseButton = styled(RiCloseLine)(({ theme }) => ({
  fill: theme.custom.colors.white,
  position: "absolute",
  right: "0",
  padding: "9px",
  boxSizing: "content-box",
  backgroundColor: theme.custom.colors.silverGray,
}))

const StyledAiChatWithEntryScreen = styled(AiChatWithEntryScreen)({
  ".MitAiChat--messagesContainer": {
    marginTop: "14px",
  },
})

const STARTERS: AiChatProps["conversationStarters"] = [
  { content: "What is this course about?" },
  { content: "What are the prerequisites for this course?" },
  { content: "How will this course be graded?" },
]

const getInitialMessage = (
  resource: LearningResource,
  user?: User,
): AiChatProps["initialMessages"] => {
  const greetings = user?.profile?.name
    ? `Hello ${user.profile.name}, `
    : "Hello and "
  return [
    {
      content: `${greetings} welcome to **${resource.title}**. How can I assist you today?`,
      role: "assistant",
    },
  ]
}

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
        {open ? <CloseButton /> : <OpenChevron />}
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
}: {
  resource?: LearningResource
  open: boolean
  onTransitionEnd: () => void
  scrollElement: HTMLElement | null
  contentTopPosition: number
}) => {
  const user = useUserMe()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    element.addEventListener("transitionend", onTransitionEnd)
    return () => {
      element.removeEventListener("transitionend", onTransitionEnd)
    }
  }, [open, onTransitionEnd])

  if (!resource) return null

  return (
    <SlideDown open={open} inert={!open} ref={ref}>
      <StyledAiChatWithEntryScreen
        entryTitle="What do you want to know about this course?"
        starters={STARTERS}
        initialMessages={getInitialMessage(resource, user.data)}
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
