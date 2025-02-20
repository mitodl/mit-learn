import * as React from "react"
import type { AiChatMessage, AiChatProps } from "@mitodl/smoot-design/ai"
import { getCsrfToken } from "@/common/utils"
import { LearningResource } from "api"
import { useUserMe } from "api/hooks/user"
import type { User } from "api/hooks/user"
import dynamic from "next/dynamic"

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
  const greetings = user?.profile?.name
    ? `Hello ${user.profile.name}, `
    : "Hello and "
  return [
    {
      content: `${greetings} welcome to **${resource.title}**. How can I assist you today?`,
      role: "assistant",
    },
  ]
}

type AiChatSyllabusProps = {
  // onClose: () => void
  resource?: LearningResource
  className?: string
  ref?: React.Ref<{ append: (message: Omit<AiChatMessage, "id">) => void }>
}

const AiChatSyllabus: React.FC<AiChatSyllabusProps> = ({
  // onClose,
  resource,
  ref,
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
      // askTimTitle="about this course"
      // onClose={onClose}
      requestOpts={{
        apiUrl: process.env.NEXT_PUBLIC_LEARN_AI_SYLLABUS_ENDPOINT!,
        fetchOpts: {
          headers: {
            "X-CSRFToken": getCsrfToken(),
          },
        },
        transformBody: (messages) => ({
          collection_name: "content_files",
          message: messages[messages.length - 1].content,
          course_id: resource?.readable_id,
        }),
      }}
      ref={ref}
      {...props}
    />
  )
}

export default AiChatSyllabus
