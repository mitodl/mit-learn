import React, { useCallback, useState } from "react"
import { styled } from "@pigment-css/react"
import {
  AiChat,
  AiChatProps,
  useAsStreamAdapter,
  useAiChatApi,
} from "@nlux/react"
import type { StreamSend } from "@nlux/react"
import { personas } from "./personas"

import "@nlux/themes/unstyled.css"
import "./nlux-theme.css"
import { Alert } from "ol-components"
import { extractJSONFromComment } from "ol-utilities"

type NluxAiChatProps = Pick<
  AiChatProps,
  "initialConversation" | "conversationOptions"
> & {
  send: StreamSend
}

const StyledDebugPre = styled("pre")({
  width: "80%",
  whiteSpace: "pre-wrap",
})

const NluxAiChat: React.FC<NluxAiChatProps> = (props) => {
  const adapter = useAsStreamAdapter(props.send, [])
  const [lastMessageReceived, setLastMessageReceived] = useState("")
  const onMessageReceived = useCallback(
    (payload: { message: React.SetStateAction<string> }) =>
      setLastMessageReceived(payload.message),
    [setLastMessageReceived],
  )
  const api = useAiChatApi()
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
