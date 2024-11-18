import type { NluxAiChatProps } from "ol-components"

const CHAT_ENDPOINT = `${process.env.NEXT_PUBLIC_MITOL_API_BASE_URL}/api/v0/chat_agent`

function getCookie(name: string) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift()
  }
}

const makeRequest = async (message: string) =>
  fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken":
        getCookie(process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME || "csrftoken") ??
        "",
    },
    credentials: "include", // TODO Remove this, should be handled by same-origin
    body: JSON.stringify({ message }),
  })

const RESPONSE_DELAY = 500

// Function to send query to the server and receive a stream of chunks as response
export const send: NluxAiChatProps["send"] = async (message, observer) => {
  const response = await makeRequest(message)

  if (response.status !== 200) {
    observer.error(new Error("Failed to connect to the server"))
    return
  }

  if (!response.body) {
    return
  }

  // Read a stream of server-sent events
  // and feed them to the observer as they are being generated
  const reader = response.body.getReader()
  const textDecoder = new TextDecoder()

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read()
    if (done) {
      /**
       * Without the pause here, some messages were getting displayed completely
       * empty. Unsure why.
       */
      await new Promise((res) => setTimeout(res, RESPONSE_DELAY))
      break
    }

    const content = textDecoder.decode(value)
    if (content) {
      observer.next(content)
    }
  }

  observer.complete()
}
