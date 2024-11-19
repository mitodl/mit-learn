import type { DeepChat } from "deep-chat-react"

type DeepChatProps = React.ComponentProps<typeof DeepChat>
type Message = { role: "user" | "ai"; text: string }
const requestInterceptor: NonNullable<DeepChatProps["requestInterceptor"]> = (
  request,
) => {
  const messages: Message[] = request.body.messages
  return {
    ...request,
    body: {
      message: messages[messages.length - 1].text,
    },
  }
}
const responseInterceptor: NonNullable<
  DeepChatProps["responseInterceptor"]
> = async (response) => {
  const blob: Blob = response
  const text = await blob.text()
  return {
    text: text,
    role: "ai",
  }
}

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
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken":
      getCookie(process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME || "csrftoken") ?? "",
  },
  credentials: "include",
}

const CONNECTION_PROPS: DeepChatProps = {
  requestInterceptor,
  responseInterceptor,
  connect,
}

export { CONNECTION_PROPS }
