import { NluxAiChatProps } from "@/page-components/Nlux-AiChat/AiChat"

function getCookie(name: string) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift()
  }
}

type EndpointOpts = {
  url: "/api/v0/chat_agent/"
  extraBody?: Record<string, unknown>
}

const makeRequest = async (opts: EndpointOpts, message: string) =>
  fetch(`${process.env.NEXT_PUBLIC_MITOL_API_BASE_URL}${opts.url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken":
        getCookie(process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME || "csrftoken") ??
        "",
    },
    credentials: "include", // TODO Remove this, should be handled by same-origin
    body: JSON.stringify({ message, ...opts.extraBody }),
  })

const RESPONSE_DELAY = 500

// Function to send query to the server and receive a stream of chunks as response
const makeSend =
  (
    opts: EndpointOpts,
    processContent: (content: string) => string = (content) => content,
  ): NluxAiChatProps["send"] =>
  async (message, observer) => {
    const response = await makeRequest(opts, message)

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
         *
         * Maybe related to stream having only a single chunk?
         */
        await new Promise((res) => setTimeout(res, RESPONSE_DELAY))
        break
      }

      const content = textDecoder.decode(value)
      if (content) {
        observer.next(processContent(content))
      }
    }

    observer.complete()
  }

export { makeSend }
export type { EndpointOpts }
