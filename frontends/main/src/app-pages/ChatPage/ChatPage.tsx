"use client"
import React from "react"
import { NluxAiChat, Container, styled, SimpleSelect } from "ol-components"
import { sends } from "./send"
import type { ChatEndpoint } from "./send"

const CONVERSATION_OPTTIONS = {
  conversationStarters: [
    { prompt: "I'm interested in quantum computing." },
    { prompt: "I want to learn about global warming." },
    { prompt: "I am curious about AI applications for business." },
  ],
}

const StyledChat = styled(NluxAiChat)({
  maxHeight: "60vh",
  flex: 1,
})

const CHAT_OPTIONS = [
  { value: "assistant", label: <code>api/v0/chat_assistant</code> },
  { value: "agent", label: <code>api/v0/chat_agent</code> },
]

const StyledContainer = styled(Container)({
  height: "100%",
  padding: "24px 0",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "16px",
})

const ChatPage = () => {
  const [endpoint, setEndpoint] = React.useState<ChatEndpoint>("agent")
  return (
    <StyledContainer>
      <SimpleSelect
        value={endpoint}
        options={CHAT_OPTIONS}
        onChange={(e) => setEndpoint(e.target.value as ChatEndpoint)}
      />
      <StyledChat
        key={endpoint}
        send={sends[endpoint]}
        conversationOptions={CONVERSATION_OPTTIONS}
      />
    </StyledContainer>
  )
}

export default ChatPage
