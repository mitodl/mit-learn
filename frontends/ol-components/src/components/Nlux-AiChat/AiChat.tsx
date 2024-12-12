import React, { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import { Alert, styled } from "ol-components"
import { extractJSONFromComment } from "ol-utilities"

const StyledDebugPre = styled.pre({
  width: "80%",
  "white-space": "pre-wrap",
})

const WebConnectionComponent = () => {
  const [messages, setMessages] = useState("")
  const [lastMessageReceived, setLastMessageReceived] = useState("")
  const [inputMessage, setInputMessage] = useState("")
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    const ws = new WebSocket(
      `${process.env.NEXT_PUBLIC_AI_LEARN_BASE_WEBSOCKET_URL}ws/chat_agent/`,
    )

    ws.onmessage = (event) => {
      setMessages((prev) => prev + event.data)
      setLastMessageReceived(event.data)
    }

    ws.onerror = (e) => {
      console.log(`WTF happened? Ignoring..${JSON.stringify(e)}`)
      //ws.close();
    }

    setSocket(ws)

    return () => {
      ws.close()
    }
  }, [])

  const sendMessage = () => {
    console.log(`sending message to ${socket}`)
    if (socket && inputMessage.trim() !== "") {
      console.log(`really sending message to ${socket}`)
      socket.send(JSON.stringify({ message: inputMessage }))
      setInputMessage("")
    }
  }

  const handleSubmit = (e) => {
    console.log("submitting")
    e.preventDefault()
    sendMessage()
  }

  return (
    <div>
      <h3>{`${process.env.NEXT_PUBLIC_AI_LEARN_BASE_WEBSOCKET_URL}ws/chat_agent/`}</h3>
      <ReactMarkdown>{messages}</ReactMarkdown>
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
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type your message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  )
}

export { WebConnectionComponent }
