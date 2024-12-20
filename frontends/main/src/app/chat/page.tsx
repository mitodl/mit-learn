import React from "react"
import { Metadata } from "next"

import ChatPage from "@/app-pages/ChatPage/ChatPage"
import { standardizeMetadata } from "@/common/metadata"

export const metadata: Metadata = standardizeMetadata({
  title: "Chat Demo",
  robots: "noindex",
})

const Page: React.FC = () => {
  return <ChatPage />
}

export default Page
