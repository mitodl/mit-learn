import type { JSONContent } from "@tiptap/react"
import { WebsiteContentContentTypeEnum, type WebsiteContent } from "api/v1"

/**
 * Display labels for website content types.
 *
 * Keyed on the generated enum rather than `Record<string, string>` so that
 * adding a content type is a type error here until a label is supplied.
 *
 * Deliberately not the generated `WebsiteContentContentTypeEnumDescriptions`:
 * those values come from the `WebsiteContentType` labels in
 * `website_content/constants.py`, so a backend rename would quietly change UI
 * copy. Take the type from generated code, keep the strings here.
 */
export const CONTENT_TYPE_LABELS: Record<
  WebsiteContentContentTypeEnum,
  string
> = {
  [WebsiteContentContentTypeEnum.News]: "News",
  [WebsiteContentContentTypeEnum.Article]: "Article",
}

/**
 * Narrow an arbitrary query-param string to a known content type, or undefined
 * if it isn't one.
 */
export const toContentType = (
  value: string | undefined,
): WebsiteContentContentTypeEnum | undefined =>
  Object.values(WebsiteContentContentTypeEnum).find((type) => type === value)

export const extractWebsiteContentDescription = (
  content: WebsiteContent,
): string | undefined => {
  const banner = content.content?.content?.[0]
  const subheading = banner?.content?.[1]
  const textNode = subheading?.content?.[0]
  return textNode?.text
}

export const extractImageMetadata = (
  content: WebsiteContent,
): { src: string; alt: string } | null => {
  const imageWithCaption = content.content?.content?.find(
    (node: JSONContent) => node.type === "imageWithCaption",
  )

  const attrs = imageWithCaption?.attrs as
    | { src?: string; alt?: string; caption?: string }
    | undefined

  if (!attrs?.src) {
    return null
  }

  return {
    src: attrs.src,
    alt: attrs.caption || attrs.alt || "",
  }
}
