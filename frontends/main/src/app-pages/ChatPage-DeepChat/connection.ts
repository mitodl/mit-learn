import type { DeepChat } from "deep-chat-react"

type DeepChatProps = React.ComponentProps<typeof DeepChat>
type Message = { role: "user" | "ai"; text: string }

function getCookie(name: string) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift()
  }
}

const connect: NonNullable<DeepChatProps["connect"]> = {
  url: `${process.env.NEXT_PUBLIC_MITOL_API_BASE_URL}/api/v0/chat_agent`,
  method: "POST",
  stream: true,
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken":
      getCookie(process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME || "csrftoken") ?? "",
  },
  credentials: "include",
  handler: async (body, signals) => {
    const request = fetch(
      `${process.env.NEXT_PUBLIC_MITOL_API_BASE_URL}/api/v0/chat_agent`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken":
            getCookie(
              process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME || "csrftoken",
            ) ?? "",
        },
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          message: body.messages[body.messages.length - 1].text,
        }),
      },
    )
    try {
      const response = await request
      if (!response.body) return
      const reader = response.body.getReader()
      const textDecoder = new TextDecoder()
      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          break
        } else {
          const content = textDecoder.decode(value)
          signals.onResponse({ text: content })
        }
      }
    } catch (el) {
      signals.onResponse({ error: "Error" })
    } finally {
      signals.onClose()
    }
  },
}

const CONNECTION_PROPS: DeepChatProps = {
  // requestInterceptor,
  // responseInterceptor,
  connect,
}

export { CONNECTION_PROPS }
