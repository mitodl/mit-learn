import * as React from "react"
import { styled, Input, ActionButton, Skeleton } from "ol-components"
import { RiSendPlaneFill } from "@remixicon/react"
import { useLearnChat } from "./chat"
import type { UseChatOptions } from "ai/react"
import Markdown from "react-markdown"

const ChatContainer = styled.div(({ theme }) => ({
  width: "100%",
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  backgroundColor: theme.custom.colors.lightGray1,
  display: "flex",
  flexDirection: "column",
}))

const distanceFromBottom = (el: HTMLElement) => {
  return el.scrollHeight - el.clientHeight - el.scrollTop
}
const scrollToBottom = (el: HTMLElement) => {
  el.scrollTop = el.scrollHeight - el.clientHeight
}
type ScrollSnapProps = {
  threshold?: number
  children: React.ReactNode
  className?: string
}
const ScrollSnap = React.forwardRef<HTMLDivElement, ScrollSnapProps>(
  ({ children, threshold = 1, className }, ref) => {
    const el = React.useRef<HTMLDivElement>()
    React.useEffect(() => {
      if (!el.current) return
      if (distanceFromBottom(el.current) < threshold) {
        scrollToBottom(el.current)
      }
    }, [children, threshold])

    return (
      <div
        className={className}
        ref={(r) => {
          el.current = r ?? undefined
          if (ref && typeof ref !== "function") {
            ref.current = r
          } else {
            ref?.(r)
          }
        }}
      >
        {children}
      </div>
    )
  },
)

const MessagesContainer = styled(ScrollSnap)({
  display: "flex",
  flexDirection: "column",
  flex: 1,
  padding: "24px",
  paddingBottom: "0px",
  overflow: "auto",
  scrollSnapType: "y proximity",
  "> *:last-child": {
    scrollSnapAlign: "end",
  },
})
const MessageRow = styled.div<{
  reverse?: boolean
}>(({ reverse }) => [
  {
    margin: "8px 0",
    display: "flex",
    width: "100%",
    flexDirection: reverse ? "row-reverse" : "row",
  },
])
const Avatar = styled.div({})
const Message = styled.div(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  backgroundColor: theme.custom.colors.white,
  borderRadius: "24px",
  padding: "4px 16px",
  ...theme.typography.body2,
  "p:first-child": {
    marginTop: 0,
  },
  "p:last-child": {
    marginBottom: 0,
  },
  a: {
    color: theme.custom.colors.mitRed,
    textDecoration: "none",
  },
  "a:hover": {
    color: theme.custom.colors.red,
    textDecoration: "underline",
  },
}))

const StarterContainer = styled.div({
  alignSelf: "flex-end",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
})
const Starter = styled.button(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  backgroundColor: theme.custom.colors.white,
  borderRadius: "24px",
  padding: "4px 16px",
  ...theme.typography.body2,
  cursor: "pointer",
  "&:hover": {
    backgroundColor: theme.custom.colors.lightGray1,
  },
}))

const Controls = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "space-around",
  padding: "12px 24px",
  backgroundColor: theme.custom.colors.white,
}))
const Form = styled.form(() => ({
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

interface ChatboxProps {
  className?: string
  conversationStarters?: { content: string }[]
}

const ChatBox: React.FC<ChatboxProps> = ({
  className,
  conversationStarters,
}) => {
  const [waiting, setWaiting] = React.useState(false)
  const [showStarters, setShowStarters] = React.useState(true)
  const messagesRef = React.useRef<HTMLDivElement>(null)
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    isLoading,
  } = useLearnChat({
    onResponse: () => {
      setWaiting(false)
    },
    initialMessages: INITIAL_MESSAGES,
  })

  return (
    <ChatContainer className={className}>
      <MessagesContainer ref={messagesRef}>
        {messages.map((m) => (
          <MessageRow key={m.id} reverse={m.role === "user"}>
            <Avatar />
            <Message>
              <Markdown>{m.content}</Markdown>
            </Message>
          </MessageRow>
        ))}
        {showStarters ? (
          <StarterContainer>
            {conversationStarters?.map((m) => (
              <Starter
                key={m.content}
                onClick={() => {
                  setWaiting(true)
                  setShowStarters(false)
                  append({ role: "user", content: m.content })
                  if (!messagesRef.current) return
                  scrollToBottom(messagesRef.current)
                }}
              >
                {m.content}
              </Starter>
            ))}
          </StarterContainer>
        ) : null}
        {waiting ? (
          <MessageRow key={"loading"}>
            <Avatar />
            <Message>
              <Dots />
            </Message>
          </MessageRow>
        ) : null}
        <div style={{ height: "24px", minHeight: "24px", width: "100%" }}></div>
      </MessagesContainer>
      <Controls>
        <Form
          onSubmit={(e) => {
            setWaiting(true)
            setShowStarters(false)
            handleSubmit(e)
            if (!messagesRef.current) return
            scrollToBottom(messagesRef.current)
          }}
        >
          <Input sx={{ flex: 1 }} value={input} onChange={handleInputChange} />
          <ActionButton type="submit" disabled={isLoading}>
            <RiSendPlaneFill />
          </ActionButton>
        </Form>
      </Controls>
    </ChatContainer>
  )
}

export { ChatBox }
