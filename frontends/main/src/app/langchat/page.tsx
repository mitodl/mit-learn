import React from "react"
import { Metadata } from "next"

import ChatPage from "@/app-pages/ChatPage/ChatPage"
import { standardizeMetadata } from "@/common/metadata"

export const metadata: Metadata = standardizeMetadata({
  title: "Chat Demo with LangGraph",
  robots: "noindex",
})

const Page: React.FC = () => {
  return <ChatPage apiUrl="/api/v0/chat_agent_langgraph/" />
}

export default Page
