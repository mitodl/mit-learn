"use client"
import React from "react"
import { Container, styled } from "ol-components"
import { ChatBox } from "./ChatBox"

const StyledContainer = styled(Container)({
  height: "100%",
  padding: "24px 0",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "16px",
})

const ChatPage = () => {
  return (
    <StyledContainer>
      <ChatBox />
    </StyledContainer>
  )
}

export default ChatPage
