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
  platform?: string
  related_courses?: string[]
}

export const isSyllabusChatEnabled = (): boolean =>
  Boolean(env("NEXT_PUBLIC_LEARN_AI_SYLLABUS_ENDPOINT"))

export const getSyllabusEntryScreenTitle = (
  resource: LearningResource,
): string =>
  `What do you want to know about this ${resource.resource_category.toLocaleLowerCase()}?`

/**
 * A readable_id alone does not identify a resource: the same course can be
 * published on more than one platform (e.g. mitxonline and xpro) with the same
 * readable_id but different content. Platform code + readable_id is the unique
 * key, so send the platform code along to keep the chat's content file search
 * scoped to the course the user is actually looking at. learn-ai passes it
 * through as the `platform` filter on the contentfile search.
 */
export const buildSyllabusChatRequestBody = (
  resource: LearningResource,
  messages: { content: string }[],
): SyllabusChatParams => {
  const params: SyllabusChatParams = {
    collection_name: "content_files",
    message: messages[messages.length - 1].content,
    course_id: resource.readable_id,
  }
  if (resource.platform?.code) {
    params.platform = resource.platform.code
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

/**
 * Key for the chat session. Keyed by platform code as well as readable_id so
 * that same-readable_id courses on different platforms do not share a
 * conversation.
 */
const getSyllabusChatId = (resource: LearningResource): string =>
  resource.platform?.code
    ? `${resource.platform.code}-${resource.readable_id}`
    : resource.readable_id

export const getSyllabusChatProps = (
  resource: LearningResource,
): Pick<
  AiChatProps,
  "chatId" | "entryScreenTitle" | "conversationStarters" | "requestOpts"
> => ({
  chatId: getSyllabusChatId(resource),
  entryScreenTitle: getSyllabusEntryScreenTitle(resource),
  conversationStarters: SYLLABUS_STARTERS[resource.resource_type_group],
  requestOpts: getSyllabusChatRequestOpts(resource),
})
