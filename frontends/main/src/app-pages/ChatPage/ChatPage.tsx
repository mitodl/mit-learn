"use client"
import React from "react"
import { WebConnectionComponent, Container, styled } from "ol-components"

import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagEnabled } from "posthog-js/react"

const StyledChat = styled(WebConnectionComponent)({
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
        recommendationBotEnabled || true ? <StyledChat /> : <></>
      }
    </StyledContainer>
  )
}

export default ChatPage
