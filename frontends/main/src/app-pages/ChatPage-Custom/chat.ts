import { useChat, UseChatOptions, Message } from "ai/react"

function getCookie(name: string) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift()
  }
}

const fetcher: typeof fetch = async (url, opts) => {
  if (typeof opts?.body !== "string") {
    console.warn("Unexpected body type", opts?.body)
    return fetch(url, opts)
  }
  const messages: Message[] = JSON.parse(opts?.body).messages
  const options: RequestInit = {
    ...opts,
    headers: {
      ...opts?.headers,
      "Content-Type": "application/json",
      "X-CSRFToken":
        getCookie(process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME || "csrftoken") ??
        "",
    },
    credentials: "include",
    body: JSON.stringify({
      message: messages[messages.length - 1].content,
    }),
  }
  return fetch(url, options)
}

const useLearnChat = (opts?: UseChatOptions) => {
  return useChat({
    api: `${process.env.NEXT_PUBLIC_MITOL_API_BASE_URL}/api/v0/chat_agent`,
    streamProtocol: "text",
    fetch: fetcher,
    ...opts,
  })
}

export { useLearnChat }
