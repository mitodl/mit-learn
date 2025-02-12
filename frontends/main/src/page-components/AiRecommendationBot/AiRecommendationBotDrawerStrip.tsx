import React, { useState, useRef, useEffect } from "react"
import { Typography, styled, Drawer, AdornmentButton } from "ol-components"
import { RiSparkling2Line, RiSendPlaneFill } from "@remixicon/react"
import { Input } from "@mitodl/smoot-design"
import type { AiChatMessage } from "@mitodl/smoot-design/ai"
import AskTIMButton from "./AskTimButton"
import AiRecommendationBot, { STARTERS } from "./AiRecommendationBot"
import Image from "next/image"
import timLogo from "@/public/images/icons/tim.svg"

const StripContainer = styled.div({
  padding: "16px 0",
  marginTop: "24px",
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "24px",
  width: "100%",
  whiteSpace: "nowrap",
})

const DecorativeLine = styled.div(({ theme }) => ({
  width: "100%",
  height: "1px",
  backgroundColor: theme.custom.colors.lightGray2,
  marginTop: "4px",
}))

const LeadingText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  ...theme.typography.body2,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
  },
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
}))

const SendIcon = styled(RiSendPlaneFill)(({ theme }) => ({
  fill: theme.custom.colors.red,
  "button:disabled &": {
    fill: theme.custom.colors.lightGray2,
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

const AiRecommendationBotDrawerStrip = () => {
  const [open, setOpen] = useState(false)
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

  const onDrawerClose = () => {
    setOpen(false)
    setShowEntryScreen(true)
  }

  return (
    <StripContainer>
      <DecorativeLine />
      <LeadingText>Do you require assistance?</LeadingText>
      <AskTIMButton onClick={() => setOpen(true)} />
      <Drawer open={open} anchor="right" onClose={onDrawerClose}>
        {showEntryScreen ? (
          <EntryScreen>
            <TimLogoBox>
              <RiSparkling2Line />
              <TimLogo src={timLogo.src} alt="" width={40} height={40} />
            </TimLogoBox>
            <Typography variant="h4">Welcome! I am TIM the Beaver.</Typography>
            <Typography>Need assistance getting started?</Typography>
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
            <Typography variant="h5">Let me know how I can help.</Typography>
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
          <AiRecommendationBot onClose={onDrawerClose} ref={aiChatRef} />
        )}
      </Drawer>
    </StripContainer>
  )
}

export default AiRecommendationBotDrawerStrip
