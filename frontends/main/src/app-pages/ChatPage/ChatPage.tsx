"use client"
import React from "react"
import { NluxAiChat, Container, styled } from "ol-components"
import { send } from "./send"

const CONVERSATION_OPTTIONS = {
  conversationStarters: [
    { prompt: "I'm interested in quantum computing." },
    { prompt: "I want to learn about global warming." },
    { prompt: "I curious about AI applications for business." },
  ],
}

const StyledChat = styled(NluxAiChat)({
  height: "100%",
  maxHeight: "75vh",
})

const ChatPage = () => {
  return (
    <Container sx={{ height: "100%", padding: "24px 0" }}>
      <StyledChat send={send} conversationOptions={CONVERSATION_OPTTIONS} />
    </Container>
  )
}

export default ChatPage
