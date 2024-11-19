"use client"
import React from "react"
import dynamic from "next/dynamic"

import { Container, styled } from "ol-components"

const ChatView = dynamic(() => import("./ChatView"), { ssr: false })

const Page = styled(Container)({
  height: "100%",
  padding: "24px 0",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "16px",
})

const ChatPage = () => {
  return (
    <Page>
      <ChatView />
    </Page>
  )
}

export default ChatPage
