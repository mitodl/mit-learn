import * as React from "react"
import { styled, Input, ActionButton, Skeleton } from "ol-components"
import { RiSendPlaneFill } from "@remixicon/react"
import { useLearnChat } from "./chat"
import type { UseChatOptions } from "ai/react"

const ChatContainer = styled.div(({ theme }) => ({
  width: "100%",
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  backgroundColor: theme.custom.colors.lightGray1,
  display: "flex",
  flexDirection: "column",
}))

const MessagesContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  flex: 1,
  padding: "24px",
}))
const MessageRow = styled.div<{
  reverse?: boolean
}>(({ theme, reverse }) => [
  {
    margin: "12px 0",
    display: "flex",
    width: "100%",
    flexDirection: reverse ? "row-reverse" : "row",
  },
])
const Avatar = styled.div(({ theme }) => ({}))
const Message = styled.div(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  backgroundColor: theme.custom.colors.white,
  borderRadius: "24px",
  padding: "8px 24px",
  ...theme.typography.body2,
}))
const Controls = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "space-around",
  padding: "12px 24px",
  backgroundColor: theme.custom.colors.white,
}))
const Form = styled.form(({ theme }) => ({
  display: "flex",
  width: "80%",
  gap: "12px",
  alignItems: "center",
}))

const INITIAL_MESSAGES: UseChatOptions["initialMessages"] = [
  {
    id: "initial-0",
    content: "Hi! What are you interested in learning about?",
    role: "assistant",
  },
]

const DotsContainer = styled.span(({ theme }) => ({
  display: "inline-flex",
  gap: "4px",
  ".MuiSkeleton-root": {
    backgroundColor: theme.custom.colors.silverGray,
  },
}))
const Dots = () => {
  return (
    <DotsContainer>
      <Skeleton variant="circular" width="8px" height="8px" />
      <Skeleton variant="circular" width="8px" height="8px" />
      <Skeleton variant="circular" width="8px" height="8px" />
    </DotsContainer>
  )
}

const ChatBox = () => {
  const [waiting, setWaiting] = React.useState(false)
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useLearnChat({
      onResponse: () => {
        setWaiting(false)
      },
      initialMessages: INITIAL_MESSAGES,
    })

  return (
    <ChatContainer>
      <MessagesContainer>
        {messages.map((m) => (
          <MessageRow key={m.id} reverse={m.role === "user"}>
            <Avatar />
            <Message>{m.content}</Message>
          </MessageRow>
        ))}
        {waiting ? (
          <MessageRow key={"loading"}>
            <Avatar />
            <Message>
              <Dots />
            </Message>
          </MessageRow>
        ) : null}
      </MessagesContainer>
      <Controls>
        <Form
          onSubmit={(e) => {
            setWaiting(true)
            handleSubmit(e)
          }}
        >
          <Input fullWidth value={input} onChange={handleInputChange} />
          <ActionButton type="submit" disabled={isLoading}>
            <RiSendPlaneFill />
          </ActionButton>
        </Form>
      </Controls>
    </ChatContainer>
  )
}

export { ChatBox }
