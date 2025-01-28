import * as React from "react"
import { AiChat } from "@mitodl/smoot-design/ai"
import type { AiChatProps } from "@mitodl/smoot-design/ai"
import { getCsrfToken } from "@/common/utils"
import { LearningResource } from "api"
import { useUserMe } from "api/hooks/user"
import type { User } from "api/hooks/user"

const STARTERS: AiChatProps["conversationStarters"] = [
  { content: "What are the prerequisites for this course?" },
  { content: "What is this course about?" },
  { content: "How will this course be graded?" },
  { content: "What are the main objectives of this course?" },
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
      key={resource.id}
      conversationStarters={STARTERS}
      initialMessages={getInitialMessage(resource, user.data)}
      chatId={`chat-${resource?.readable_id}`}
      title="MIT Teaching Assistant"
      onClose={onClose}
      requestOpts={{
        apiUrl: `${process.env.NEXT_PUBLIC_MITOL_API_BASE_URL}/api/v0/syllabus_agent/`,
        headersOpts: {
          "X-CSRFToken": getCsrfToken(),
        },
        transformBody: (messages) => {
          return {
            message: messages[messages.length - 1].content,
            readable_id: resource?.readable_id,
          }
        },
      }}
      {...props}
    />
  )
}

export default AiChatSyllabus
