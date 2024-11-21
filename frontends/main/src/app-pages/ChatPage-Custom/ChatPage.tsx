"use client"
import React from "react"
import { Container, styled } from "ol-components"
import { ChatBox } from "./ChatBox"

const StyledContainer = styled(Container)({
  height: "100%",
  padding: "24px 0",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "16px",
  maxHeight: "60vh",
})

const Chat = styled(ChatBox)({
  height: "100%",
})

const STARTERS = [
  { content: "I'm interested in quantum computing" },
  { content: "I want to understand global warming. " },
  { content: "I am curious about AI applications for business" },
]

const ChatPage = () => {
  return (
    <StyledContainer>
      <Chat conversationStarters={STARTERS} />
    </StyledContainer>
  )
}

export default ChatPage
