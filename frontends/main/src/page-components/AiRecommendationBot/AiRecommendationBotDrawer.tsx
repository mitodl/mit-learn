import React, { useState, useRef, useEffect } from "react"
import { Typography, styled, Drawer, AdornmentButton } from "ol-components"
import {
  RiSparkling2Line,
  RiSendPlaneFill,
  RiCloseLine,
} from "@remixicon/react"
import { Input, ActionButton } from "@mitodl/smoot-design"
import type { AiChatMessage } from "@mitodl/smoot-design/ai"
import AiRecommendationBot, { STARTERS } from "./AiRecommendationBot"
import Image from "next/image"
import timLogo from "@/public/images/icons/tim.svg"

const EntryScreen = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "16px",
  padding: "136px 40px 24px 40px",
  [theme.breakpoints.down("md")]: {
    padding: "136px 24px 24px 24px",
  },
}))

const CloseButton = styled(ActionButton)(({ theme }) => ({
  position: "absolute",
  top: "24px",
  right: "40px",
  backgroundColor: theme.custom.colors.lightGray2,
  "&&:hover": {
    backgroundColor: theme.custom.colors.red,
    color: theme.custom.colors.white,
  },
  [theme.breakpoints.down("md")]: {
    right: "24px",
  },
}))

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

const Title = styled(Typography)({
  textAlign: "center",
  padding: "0 40px",
})

const StyledInput = styled(Input)(({ theme }) => ({
  backgroundColor: theme.custom.colors.lightGray1,
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  margin: "8px 0 24px 0",
  "button:disabled": {
    backgroundColor: "inherit",
  },
  [theme.breakpoints.down("sm")]: {
    ".Mit-AdornmentButton": {
      padding: 0,
    },
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
  [theme.breakpoints.down("sm")]: {
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

const AiRecommendationBotDrawer = ({
  open,
  setOpen,
}: {
  open: boolean
  setOpen: (open: boolean) => void
}) => {
  const [initialPrompt, setInitialPrompt] = useState("")
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

  const closeDrawer = () => {
    setOpen(false)
    setShowEntryScreen(true)
  }

  return (
    <Drawer
      open={open}
      anchor="right"
      onClose={closeDrawer}
      PaperProps={{
        sx: {
          minWidth: (theme) => ({
            [theme.breakpoints.down("md")]: {
              width: "100%",
            },
          }),
        },
      }}
    >
      <CloseButton
        variant="text"
        size="medium"
        onClick={closeDrawer}
        aria-label="Close"
      >
        <RiCloseLine />
      </CloseButton>
      {showEntryScreen ? (
        <EntryScreen>
          <TimLogoBox>
            <RiSparkling2Line />
            <TimLogo src={timLogo.src} alt="" width={40} height={40} />
          </TimLogoBox>
          <Title variant="h4">What do you want to learn from MIT?</Title>
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
        <AiRecommendationBot ref={aiChatRef} />
      )}
    </Drawer>
  )
}

export default AiRecommendationBotDrawer
