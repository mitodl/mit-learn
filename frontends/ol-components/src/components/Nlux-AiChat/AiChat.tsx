import * as React from "react"
import { useCallback, useState } from "react"
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
import { styled } from "ol-components"

type NluxAiChatProps = Pick<
  AiChatProps,
  "initialConversation" | "conversationOptions"
> & {
  send: StreamSend
}

const StyledDebugPre = styled.pre({
  width: "80%",
  "white-space": "pre-wrap",
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
      {lastMessageReceived ? (
        <div>
          <p>Debug Info:</p>
          <StyledDebugPre>
            {lastMessageReceived
              ? lastMessageReceived.toString()?.includes('{"error":')
                ? JSON.stringify(
                    JSON.parse(lastMessageReceived.toString() || ""),
                    null,
                    4,
                  )
                : lastMessageReceived.toString().includes("<!--")
                  ? JSON.stringify(
                      JSON.parse(
                        lastMessageReceived
                          .toString()
                          .match(/<!-{2}(.*)-{2}>/)?.[1] || "",
                      ),
                      null,
                      4,
                    )
                  : ""
              : ""}
          </StyledDebugPre>
        </div>
      ) : null}
    </>
  )
}

export { NluxAiChat }
export type { NluxAiChatProps }
