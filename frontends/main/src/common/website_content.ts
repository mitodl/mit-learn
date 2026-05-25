import type { JSONContent } from "@tiptap/react"
import type { WebsiteContent } from "api/v1"

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
