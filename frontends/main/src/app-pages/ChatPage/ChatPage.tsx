"use client"

import React from "react"
import { styled } from "ol-components"
import AiRecommendationBot from "@/page-components/AiRecommendationBot/AiRecommendationBot"

const Container = styled.div({
  height: "100%",
  padding: "24px 0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
})

const ChatPage = () => {
  return (
    <Container>
      <AiRecommendationBot />
    </Container>
  )
}

export default ChatPage
