"use client"
import React from "react"
import { NluxAiChat, Container, styled } from "ol-components"

import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagEnabled } from "posthog-js/react"

const CONVERSATION_OPTTIONS = {
  conversationStarters: [
    {
      prompt: "Recommend some free courses about quantum information science.",
    },
    { prompt: "What are some podcast episodes about global warming?" },
    { prompt: "I am curious about AI applications for business." },
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
  const recommendationBotEnabled = useFeatureFlagEnabled(
    FeatureFlags.RecommendationBot,
  )
  return (
    <StyledContainer>
      {
        // eslint-disable-next-line no-constant-condition
        recommendationBotEnabled || true ? (
          <StyledChat
            key={"agent"}
            conversationOptions={CONVERSATION_OPTTIONS}
            endpoint="recommendation_agent"
          />
        ) : (
          <></>
        )
      }
    </StyledContainer>
  )
}

export default ChatPage
