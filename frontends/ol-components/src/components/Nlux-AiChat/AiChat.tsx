import * as React from "react"
import { useCallback, useState } from "react"
import { AiChat, AiChatProps, useAiChatApi } from "@nlux/react"
import type { StreamSend } from "@nlux/react"
import { ChatAdapter, StreamingAdapterObserver } from "@nlux/core"
import { personas } from "./personas"

import "@nlux/themes/unstyled.css"
import "./nlux-theme.css"
import { Alert, Button, MenuItem, styled } from "ol-components"
import { extractJSONFromComment } from "ol-utilities"
import { InputLabel, Select, Slider, TextareaAutosize } from "@mui/material"

type NluxAiChatProps = Pick<
  AiChatProps,
  "initialConversation" | "conversationOptions"
> & {
  send: StreamSend
  endpoint: string
}

const StyledDebugPre = styled.pre({
  width: "80%",
  "white-space": "pre-wrap",
})

const FormContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  paddingTop: "40px",
  gap: "40px",
  width: "800px",
  [theme.breakpoints.down("md")]: {
    paddingTop: "24px",
    gap: "32px",
  },
}))

const TextArea = styled(TextareaAutosize)(
  ({ theme }) => `
  box-sizing: border-box;
  width: 800px;
`,
)

const sleep = (seconds: number) => {
  return new Promise((resolve) => setTimeout(resolve, seconds))
}

const NluxAiChat: React.FC<NluxAiChatProps> = (props) => {
  const [lastMessageReceived, setLastMessageReceived] = useState("")
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [model, setModel] = useState("gpt-4o")
  const [temperature, setTemperature] = useState(0.1)
  const [systemPrompt, setSystemPrompt] = useState("")
  const [newChat, setNewChat] = useState(false)

  const onMessageReceived = useCallback(
    (payload: { message: React.SetStateAction<string> }) =>
      setLastMessageReceived(payload.message),
    [setLastMessageReceived],
  )
  const api = useAiChatApi()
  const WebSocketAdapter: ChatAdapter = {
    streamText: (message: string, observer: StreamingAdapterObserver): void => {
      if (socket) {
        // We register listeners for the WebSocket events here
        // and call the observer methods accordingly
        socket.onmessage = (event) => {
          // Hacky way to stop waiting for the next event
          if (event.data === "!endResponse") {
            observer.complete()
          } else {
            observer.next(event.data)
            setNewChat(false)
          }
        }
        socket.onclose = () => observer.complete()
        socket.onerror = (error) => observer.error(error)
        // while (socket.readyState !== WebSocket.OPEN) {
        //     // Wait for the WebSocket connection to be established
        //     sleep(2000)
        // }

        // This is where we send the user message to the API
        socket.send(
          JSON.stringify({
            message: message,
            model: model,
            temperature: temperature,
            instructions: systemPrompt,
          }),
        )
      }
    },
  }

  const adapter = WebSocketAdapter

  if (!socket) {
    setSocket(
      new WebSocket(
        `${process.env.NEXT_PUBLIC_AI_LEARN_BASE_WEBSOCKET_URL}${props.endpoint}/`,
      ),
    )
  }
  return (
    <>
      <AiChat
        api={api}
        displayOptions={{
          themeId: "MyBrandName",
          colorScheme: "light",
        }}
        adapter={adapter}
        personaOptions={personas}
        events={{ messageReceived: onMessageReceived }}
        {...props}
      />
      <form id="chat-form">
        <FormContainer>
          <div>
            <InputLabel>Model</InputLabel>
            <Select
              label="Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <MenuItem value="gpt-4-turbo">gpt-4-turbo</MenuItem>
              <MenuItem value="gpt-4o-mini">gpt-4o-mini</MenuItem>
              <MenuItem value="gpt-4o">gpt-4o</MenuItem>
              <MenuItem value="gpt-4">gpt-4</MenuItem>
              <MenuItem value="gpt-3.5-turbo">gpt-3.5-turbo</MenuItem>
              <MenuItem value="gpt-fake">Fake Model</MenuItem>
            </Select>
          </div>
          <div>
            <InputLabel>Temperature</InputLabel>
            <Slider
              value={temperature || 0.1}
              onChange={(event: Event, newValue: number | number[]) => {
                setTemperature(newValue as number)
              }}
              valueLabelDisplay="auto"
              min={0.1}
              max={1.0}
              step={0.1}
            />
          </div>
          <div>
            <InputLabel>System Prompt</InputLabel>
            <TextArea
              label="System Prompt"
              name="systemPrompt"
              fullWidth
              value={systemPrompt}
              minRows={5}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </div>
          <div>
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                setNewChat(true)
                setLastMessageReceived("")
                api.conversation.reset()
              }}
            >
              New Chat
            </Button>
          </div>
        </FormContainer>
      </form>
      {lastMessageReceived &&
        (lastMessageReceived.toString().includes('{"error":') ? (
          <Alert severity="error">
            {extractJSONFromComment(lastMessageReceived)?.error?.message ||
              "Sorry, an unexpected error occurred."}
          </Alert>
        ) : lastMessageReceived.toString().includes("<!--") ? (
          <div>
            <p>Debug Info:</p>
            <StyledDebugPre>
              {lastMessageReceived
                ? lastMessageReceived.toString()?.includes('{"error":')
                  ? JSON.stringify(extractJSONFromComment(lastMessageReceived))
                  : lastMessageReceived.toString().includes("<!--")
                    ? JSON.stringify(
                        extractJSONFromComment(lastMessageReceived),
                        null,
                        4,
                      )
                    : ""
                : ""}
            </StyledDebugPre>
          </div>
        ) : null)}
    </>
  )
}

export { NluxAiChat }
export type { NluxAiChatProps }
