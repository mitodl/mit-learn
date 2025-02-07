"use client"

import React from "react"
import { styled } from "ol-components"
import { getCsrfToken } from "@/common/utils"
import { AiChat, AiChatProps } from "@mitodl/smoot-design/ai"

const Container = styled.div({
  margin: "40px auto",
  width: "60%",
})

const INITIAL_MESSAGES: AiChatProps["initialMessages"] = [
  {
    content: "What do you want to learn about today?",
    role: "assistant",
  },
]

export const STARTERS = [
  {
    content:
      "I'm interested in courses on quantum computing that offer certificates.",
  },
  {
    content:
      "I want to learn about global warming, can you recommend any videos?",
  },
  {
    content:
      "I am curious about AI applications for business.  Do you have any free courses about that?",
  },
  {
    content:
      "I would like to learn about linear regression, preferably at no cost.",
  },
]

const ChatPage = () => {
  return (
    <Container>
      <AiChat
        askTimTitle="to recommend a course"
        initialMessages={INITIAL_MESSAGES}
        conversationStarters={STARTERS}
        requestOpts={{
          apiUrl: `${process.env.NEXT_PUBLIC_MITOL_API_BASE_URL}/api/v0/chat_agent/`,
          fetchOpts: {
            headers: {
              "X-CSRFToken": getCsrfToken(),
            },
          },
          transformBody: (messages) => ({
            message: messages[messages.length - 1].content,
          }),
        }}
      />
    </Container>
  )
}

export default ChatPage
