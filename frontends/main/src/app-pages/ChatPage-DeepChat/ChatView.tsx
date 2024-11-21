"use client"
import React from "react"
import { styled } from "ol-components"
import { DeepChat } from "deep-chat-react"
import { CONNECTION_PROPS } from "./connection"
import { insertStylesheet, STYLE_PROPS } from "./styles"

const HISTORY = [
  { role: "ai", text: "Hi! What are you interested in learning about?" },
  {
    role: "user",
    html: `
<div class="tim-suggestions deep-chat-temporary-message">
  <button class="tim-suggestion-button deep-chat-button deep-chat-suggestion-button">
  I'm interested in quantum computin
  </button>
  <button class="tim-suggestion-button deep-chat-button deep-chat-suggestion-button">
  I want to learn about global warming
  </button>
  <button class="tim-suggestion-button deep-chat-button deep-chat-suggestion-button">
  I am curious about AI applications for business
  </button>
</div>
    `,
  },
]

const ChatContainer = styled.div({
  width: "100%",
  height: "100%",
})

const ChatView = () => {
  return (
    <ChatContainer>
      <DeepChat
        ref={(el) => {
          if (!el) return
          insertStylesheet(el)
        }}
        {...CONNECTION_PROPS}
        {...STYLE_PROPS}
        history={HISTORY}
        // @ts-expect-error Webcomponents...
        submit
      ></DeepChat>
    </ChatContainer>
  )
}

export default ChatView
