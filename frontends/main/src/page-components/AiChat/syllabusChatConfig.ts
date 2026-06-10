import { env } from "@/env"
import type { AiChatProps } from "@mitodl/smoot-design/ai"
import { LearningResource, ResourceTypeGroupEnum } from "api"

export const SYLLABUS_STARTERS: Partial<
  Record<ResourceTypeGroupEnum, AiChatProps["conversationStarters"]>
> = {
  [ResourceTypeGroupEnum.Course]: [
    { content: "What is this course about?" },
    { content: "What are the prerequisites for this course?" },
    { content: "How will this course be graded?" },
  ],
  [ResourceTypeGroupEnum.Program]: [
    { content: "What is this program about?" },
    { content: "What are the prerequisites for this program?" },
    { content: "How will this program be graded?" },
  ],
}

type SyllabusChatParams = {
  collection_name: string
  message: string
  course_id: string
  related_courses?: string[]
}

export const isSyllabusChatEnabled = (): boolean =>
  Boolean(env("NEXT_PUBLIC_LEARN_AI_SYLLABUS_ENDPOINT"))

export const getSyllabusEntryScreenTitle = (
  resource: LearningResource,
): string =>
  `What do you want to know about this ${resource.resource_category.toLocaleLowerCase()}?`

export const buildSyllabusChatRequestBody = (
  resource: LearningResource,
  messages: { content: string }[],
): SyllabusChatParams => {
  const params: SyllabusChatParams = {
    collection_name: "content_files",
    message: messages[messages.length - 1].content,
    course_id: resource.readable_id,
  }
  if (Array.isArray(resource.children)) {
    params.related_courses = resource.children.map(
      (child: { readable_id: string }) => child.readable_id,
    )
  }
  return params
}

export const getSyllabusChatRequestOpts = (
  resource: LearningResource,
): NonNullable<AiChatProps["requestOpts"]> => ({
  apiUrl: env("NEXT_PUBLIC_LEARN_AI_SYLLABUS_ENDPOINT")!,
  csrfCookieName: env("NEXT_PUBLIC_LEARN_AI_CSRF_COOKIE_NAME") || "csrftoken",
  csrfHeaderName: "X-CSRFToken",
  fetchOpts: {
    credentials: "include",
  },
  transformBody: (messages) => buildSyllabusChatRequestBody(resource, messages),
})

export const getSyllabusChatProps = (
  resource: LearningResource,
): Pick<
  AiChatProps,
  "chatId" | "entryScreenTitle" | "conversationStarters" | "requestOpts"
> => ({
  chatId: resource.readable_id,
  entryScreenTitle: getSyllabusEntryScreenTitle(resource),
  conversationStarters: SYLLABUS_STARTERS[resource.resource_type_group],
  requestOpts: getSyllabusChatRequestOpts(resource),
})
