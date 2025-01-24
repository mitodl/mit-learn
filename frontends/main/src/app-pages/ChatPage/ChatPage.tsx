"use client"
import React, { useMemo } from "react"
import { styled } from "@pigment-css/react"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import StyledContainer from "@/page-components/StyledContainer/StyledContainer"
import { NluxAiChat } from "@/page-components/Nlux-AiChat/AiChat"
import { makeSend } from "./send"

const StyledChat = styled(NluxAiChat)({
  maxHeight: "60vh",
  flex: 1,
})

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

const ChatPage = () => {
  const recommendationBotEnabled = useFeatureFlagEnabled(
    FeatureFlags.RecommendationBot,
  )
  const send = useMemo(() => {
    return makeSend({ url: "/api/v0/chat_agent/" })
  }, [])
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
        ) : (
          <></>
        )
      }
    </StyledContainer>
  )
}

export default ChatPage
