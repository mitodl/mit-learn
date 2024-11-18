import * as React from "react"
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

type NluxAiChatProps = Pick<
  AiChatProps,
  "initialConversation" | "conversationOptions"
> & {
  send: StreamSend
}

const NluxAiChat: React.FC<NluxAiChatProps> = (props) => {
  const adapter = useAsStreamAdapter(props.send, [])
  const api = useAiChatApi()
  console.log({
    personas,
  })
  return (
    <AiChat
      api={api}
      displayOptions={{
        themeId: "MyBrandName",
        colorScheme: "light",
      }}
      adapter={adapter}
      personaOptions={personas}
      {...props}
    />
  )
}

export { NluxAiChat }
export type { NluxAiChatProps }
