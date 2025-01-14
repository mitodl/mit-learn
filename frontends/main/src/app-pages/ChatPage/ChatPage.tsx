"use client"
import React, { useMemo } from "react"
import { Container, styled } from "ol-components"
import { makeSend } from "./send"
import { NluxAiChat } from "@/page-components/Nlux-AiChat/AiChat"

import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagEnabled } from "posthog-js/react"

const CONVERSATION_OPTIONS = {
  conversationStarters: [
    {
      prompt:
        "I'm interested in courses on quantum computing that offer certificates.",
    },
    {
      prompt:
        "I want to learn about global warming, can you recommend any videos?",
    },
    {
      prompt:
        "I am curious about AI applications for business.  Do you have any free courses about that?",
    },
    {
      prompt:
        "I would like to learn about linear regression, preferably at no cost.",
    },
  ],
}

const StyledChat = styled(NluxAiChat)({
  maxHeight: "60vh",
  flex: 1,
})

const StyledContainer = styled(Container)({
  height: "100%",
  padding: "24px 0",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "16px",
})

const ChatPage = () => {
  const send = useMemo(() => {
    return makeSend({ url: "/api/v0/chat_agent/" })
  }, [])
  const recommendationBotEnabled = useFeatureFlagEnabled(
    FeatureFlags.RecommendationBot,
  )
  return (
    <StyledContainer>
      {
        // eslint-disable-next-line no-constant-condition
        recommendationBotEnabled ? (
          <StyledChat
            key={"agent"}
            send={send}
            conversationOptions={CONVERSATION_OPTIONS}
          />
        ) : null
      }
    </StyledContainer>
  )
}

export default ChatPage
