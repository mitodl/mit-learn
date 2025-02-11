import React from "react"
import { styled } from "ol-components"
import { getCsrfToken } from "@/common/utils"
import { AiChat, AiChatProps } from "@mitodl/smoot-design/ai"
import type { AiChatMessage } from "@mitodl/smoot-design/ai"

const Container = styled.div(({ theme }) => ({
  width: "900px",
  height: "100vh",
  padding: "16px 24px 24px 24px",
  [theme.breakpoints.down("md")]: {
    width: "100%",
  },
}))

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

const AiRecommendationBot = ({
  onClose,
  ref,
}: {
  onClose?: () => void
  ref?: React.Ref<{ append: (message: Omit<AiChatMessage, "id">) => void }>
}) => {
  return (
    <Container>
      <AiChat
        askTimTitle="to recommend a course"
        initialMessages={INITIAL_MESSAGES}
        conversationStarters={STARTERS}
        onClose={onClose}
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
        ref={ref}
      />
    </Container>
  )
}

export default AiRecommendationBot
