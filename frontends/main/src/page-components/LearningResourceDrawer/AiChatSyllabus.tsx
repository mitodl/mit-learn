import * as React from "react"
import type { AiChatProps } from "@mitodl/smoot-design/ai"
import { getCsrfToken } from "@/common/utils"
import { LearningResource } from "api"
import { useUserMe } from "api/hooks/user"
import type { User } from "api/hooks/user"
import dynamic from "next/dynamic"
import type { SyllabusChatRequestRequest } from "api/v0"

const AiChat = dynamic(
  () => import("@mitodl/smoot-design/ai").then((mod) => mod.AiChat),
  { ssr: false },
)

const STARTERS: AiChatProps["conversationStarters"] = [
  { content: "What is this course about?" },
  { content: "What are the prerequisites for this course?" },
  { content: "How will this course be graded?" },
]

const getInitialMessage = (
  resource: LearningResource,
  user?: User,
): AiChatProps["initialMessages"] => {
  const grettings = user?.profile?.name
    ? `Hello ${user.profile.name}, `
    : "Hello and "
  return [
    {
      content: `${grettings} welcome to **${resource.title}**. How can I assist you today?`,
      role: "assistant",
    },
  ]
}

type AiChatSyllabusProps = {
  onClose: () => void
  resource?: LearningResource
  className?: string
}

const AiChatSyllabus: React.FC<AiChatSyllabusProps> = ({
  onClose,
  resource,
  ...props
}) => {
  const user = useUserMe()
  if (!resource) return null

  return (
    <AiChat
      data-testid="ai-chat-syllabus"
      conversationStarters={STARTERS}
      initialMessages={getInitialMessage(resource, user.data)}
      chatId={`chat-${resource?.readable_id}`}
      title="Ask Tim about this course"
      onClose={onClose}
      requestOpts={{
        apiUrl: `${process.env.NEXT_PUBLIC_MITOL_API_BASE_URL}/api/v0/syllabus_agent/`,
        fetchOpts: {
          headers: {
            "X-CSRFToken": getCsrfToken(),
          },
        },
        transformBody: (messages) => {
          const body: SyllabusChatRequestRequest = {
            collection_name: "content_files",
            message: messages[messages.length - 1].content,
            readable_id: resource?.readable_id,
          }
          return body
        },
      }}
      {...props}
    />
  )
}

export default AiChatSyllabus
