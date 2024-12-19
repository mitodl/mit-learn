import * as React from "react"
import { useCallback, useState } from "react"
import { AiChat, AiChatProps, useAiChatApi } from "@nlux/react"
import { ChatAdapter, StreamingAdapterObserver } from "@nlux/core"
import { personas } from "./personas"

import "@nlux/themes/unstyled.css"
import "./nlux-theme.css"
import Alert from "@mui/material/Alert"
import { Button } from "../Button/Button"
import { SimpleSelectField } from "../SimpleSelect/SimpleSelect"
import styled from "@emotion/styled"
import Slider from "@mui/material/Slider"
import { extractJSONFromComment } from "ol-utilities"
import TextareaAutosize from "@mui/material/TextareaAutosize"
import InputLabel from "@mui/material/InputLabel"

type NluxAiChatProps = Pick<
  AiChatProps,
  "initialConversation" | "conversationOptions"
> & {
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

const TextArea = styled(TextareaAutosize)`
  box-sizing: border-box;
  width: 800px;
`

const NluxAiChat: React.FC<NluxAiChatProps> = (props) => {
  const [lastMessageReceived, setLastMessageReceived] = useState("")
  const [model, setModel] = useState("gpt-4o")
  const [connecting, setConnecting] = useState(true)
  const [temperature, setTemperature] = useState(0.1)
  const [systemPrompt, setSystemPrompt] = useState("")
  const [_newChat, setNewChat] = useState(false)

  const onMessageReceived = useCallback(
    (payload: { message: React.SetStateAction<string> }) =>
      setLastMessageReceived(payload.message),
    [setLastMessageReceived],
  )
  const api = useAiChatApi()
  const socket = React.useMemo(() => {
    const socket = new WebSocket(
      `${process.env.NEXT_PUBLIC_AI_LEARN_BASE_WEBSOCKET_URL}${props.endpoint}/`,
    )
    /**
     * May not work well if endpoint changes.
     * Maybe should just use an 200ms interval check or something
     */
    socket.onopen = () => {
      setConnecting(false)
    }
    return socket
  }, [props.endpoint])
  const adapter = React.useMemo(() => {
    const adapter: ChatAdapter = {
      streamText: (
        message: string,
        observer: StreamingAdapterObserver,
      ): void => {
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
        socket.onerror = (error) =>
          observer.error(
            // @ts-expect-error This is what nlux docs show? Maybe their TS is wrong. (or their docs)
            error,
          )

        // This is where we send the user message to the API
        socket.send(
          JSON.stringify({
            message: message,
            model: model,
            temperature: temperature,
            instructions: systemPrompt,
          }),
        )
      },
    }
    return adapter
  }, [model, temperature, systemPrompt, socket])

  // If still connecting, return nothing. A little clunky.
  return connecting ? null : (
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
            <SimpleSelectField
              label="Model"
              value={model}
              onChange={(e) => setModel(e.target.value as string)}
              options={[
                { label: "gpt-4-turbo", value: "gpt-4-turbo" },
                { label: "gpt-4o-mini", value: "gpt-4o-mini" },
                { label: "gpt-4o", value: "gpt-4o" },
                { label: "gpt-4", value: "gpt-4" },
                { label: "gpt-3.5-turbo", value: "gpt-3.5-turbo" },
                { label: "gpt-fake", value: "gpt-fake" },
              ]}
            />
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
              name="systemPrompt"
              value={systemPrompt}
              minRows={5}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </div>
          <div>
            <Button
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
