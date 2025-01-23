import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react"
import { styled } from "@pigment-css/react"
import { send } from "./mock-send"

import { NluxAiChat } from "./AiChat"

const Container = styled("div")({
  width: "388px",
  height: "600px",
})

const meta: Meta<typeof NluxAiChat> = {
  title: "smoot-design/AiChat (Nlux)",
  render: (args) => {
    return (
      <Container>
        <NluxAiChat {...args} send={send} />
      </Container>
    )
  },
}

export default meta

type Story = StoryObj<typeof NluxAiChat>

const InitialConversation: Story = {
  storyName: "AiChat",
  args: {
    initialConversation: [
      {
        role: "assistant",
        message: "Hello! What are you interested in learning about today?",
      },
    ],
  },
}
const ConversationStarters: Story = {
  storyName: "AiChat",
  args: {
    conversationOptions: {
      conversationStarters: [
        { prompt: "I'm interested in quantum computing." },
        { prompt: "I want to learn about global warming." },
        { prompt: "I curious about AI applications for business." },
      ],
    },
  },
}

export { InitialConversation, ConversationStarters }
