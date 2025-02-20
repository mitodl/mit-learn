import React, { useState, useRef, useEffect } from "react"
import { Typography, styled, AdornmentButton } from "ol-components"
import { Button, Input } from "@mitodl/smoot-design"
import {
  RiSparkling2Line,
  RiSendPlaneFill,
  RiArrowDownSLine,
  RiCloseLine,
} from "@remixicon/react"
import type { AiChatMessage } from "@mitodl/smoot-design/ai"
import AiChatSyllabus from "./AiChatSyllabus"
import Image from "next/image"
import timLogo from "@/public/images/icons/tim.svg"
import { LearningResource } from "api"

const Container = styled.div()

const SlideDown = styled.div<{ open: boolean }>(({ theme, open }) => ({
  position: "absolute",
  top: open ? "0" : "-100%",
  width: "100%",
  height: "100%",
  backgroundColor: theme.custom.colors.white,
  transition: "top 0.3s ease-in-out",
}))

const Opener = styled.div(({ theme }) => ({
  pointerEvents: "auto",
  position: "relative",
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

const EntryScreen = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "16px",
  padding: "104px 32px",
})

const TimLogoBox = styled.div(({ theme }) => ({
  position: "relative",
  padding: "16px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  svg: {
    fill: theme.custom.colors.red,
    position: "absolute",
    top: "-10px",
    left: "-10px",
  },
}))

const TimLogo = styled(Image)({
  display: "block",
})

const StyledInput = styled(Input)(({ theme }) => ({
  backgroundColor: theme.custom.colors.lightGray1,
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  margin: "24px 0",
  width: "700px",
  [theme.breakpoints.down("md")]: {
    width: "100%",
  },
  "button:disabled": {
    backgroundColor: "inherit",
  },
}))

const SendIcon = styled(RiSendPlaneFill)(({ theme }) => ({
  fill: theme.custom.colors.red,
  "button:disabled &": {
    fill: theme.custom.colors.silverGray,
  },
}))

const Starters = styled.div(({ theme }) => ({
  display: "flex",
  gap: "16px",
  maxWidth: "836px",
  marginTop: "12px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
  },
}))

const Starter = styled.button(({ theme }) => ({
  flex: 1,
  display: "flex",
  alignItems: "center",
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  padding: "12px 16px",
  color: theme.custom.colors.darkGray2,
  backgroundColor: "transparent",
  textAlign: "left",
  [theme.breakpoints.down("md")]: {
    textAlign: "center",
    padding: "12px 36px",
  },
  ":hover": {
    cursor: "pointer",
    borderColor: "transparent",
    color: theme.custom.colors.white,
    backgroundColor: theme.custom.colors.darkGray1,
  },
}))

const ChatContainer = styled.div({
  padding: "40px 28px 16px",
  height: "100%",
})

const STARTERS = [
  {
    content: "What is this course about?",
  },
  {
    content: "What are the prerequisites for this course?",
  },
  {
    content: "How will this course be graded?",
  },
]

const AiChatSyllabusSlideDown = ({
  resource,
  onToggleOpen,
}: {
  resource?: LearningResource
  onToggleOpen: (open: boolean) => void
}) => {
  const [initialPrompt, setInitialPrompt] = useState("")
  const [open, setOpen] = useState(false)
  const [showEntryScreen, setShowEntryScreen] = useState(true)

  const aiChatRef = useRef<{
    append: (message: Omit<AiChatMessage, "id">) => void
  }>(null)

  useEffect(() => {
    if (!initialPrompt || showEntryScreen) return
    const timer = setTimeout(() => {
      aiChatRef.current?.append({
        content: initialPrompt,
        role: "user",
      })
      setInitialPrompt("")
    }, 0)

    return () => {
      clearTimeout(timer)
      setInitialPrompt("")
    }
  }, [initialPrompt, showEntryScreen])

  const onPromptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInitialPrompt(e.target.value)
  }

  const onPromptKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key !== "Enter") return
    setShowEntryScreen(false)
  }

  const onStarterClick = (content: string) => {
    setInitialPrompt(content)
    setShowEntryScreen(false)
  }

  const toggleOpen = () => {
    setOpen(!open)
    onToggleOpen(!open)
  }

  if (!resource) return null

  return (
    <Container>
      <Opener>
        <StyledButton
          variant="bordered"
          edge="rounded"
          open={open}
          onClick={toggleOpen}
        >
          <RiSparkling2Line />
          <Typography variant="body1">
            Ask<strong>TIM</strong> about this course
          </Typography>
          {open ? <CloseButton /> : <OpenChevron />}
        </StyledButton>
      </Opener>
      <SlideDown open={open}>
        {showEntryScreen ? (
          <EntryScreen>
            <TimLogoBox>
              <RiSparkling2Line />
              <TimLogo src={timLogo.src} alt="" width={40} height={40} />
            </TimLogoBox>
            <Typography variant="h4">
              What do you want to know about this course?
            </Typography>
            <StyledInput
              fullWidth
              size="chat"
              onChange={onPromptChange}
              onKeyDown={onPromptKeyDown}
              endAdornment={
                <AdornmentButton
                  aria-label="Send"
                  onClick={() => setShowEntryScreen(false)}
                  disabled={!initialPrompt}
                >
                  <SendIcon />
                </AdornmentButton>
              }
              responsive
            />
            <Starters>
              {STARTERS.map(({ content }, index) => (
                <Starter
                  key={index}
                  onClick={() => onStarterClick(content)}
                  tabIndex={index}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onStarterClick(content)
                    }
                  }}
                >
                  <Typography variant="body2">{content}</Typography>
                </Starter>
              ))}
            </Starters>
          </EntryScreen>
        ) : (
          <ChatContainer>
            <AiChatSyllabus resource={resource} ref={aiChatRef} />
          </ChatContainer>
        )}
      </SlideDown>
    </Container>
  )
}

export default AiChatSyllabusSlideDown
