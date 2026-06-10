import type { WebsiteContent } from "api/v1"
type ProseMirrorMark = {
  type: string
  attrs?: Record<string, unknown>
}

type ProseMirrorNode = {
  type: string
  content?: ProseMirrorNode[]
  attrs?: Record<string, unknown>
  text?: string
  marks?: ProseMirrorMark[]
}

type ArticleContent = {
  type: string
  content?: ProseMirrorNode[]
}

type ArticleImage = {
  src: string
  alt: string | null
  caption: string | null
}

type ArticleSummary = {
  heading: string | null
  paragraph: string | null
  image: ArticleImage | null
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function extractText(nodes: ProseMirrorNode[] | undefined): string {
  if (!nodes) return ""
  return nodes
    .filter((n) => n.type === "text" && typeof n.text === "string")
    .map((n) => n.text as string)
    .join("")
}

function nodesToHtml(nodes: ProseMirrorNode[] | undefined): string {
  if (!nodes) return ""
  return nodes
    .filter((n) => n.type === "text" && typeof n.text === "string")
    .map((n) => {
      let html = escapeHtml(n.text as string)
      for (const mark of n.marks ?? []) {
        if (mark.type === "bold") {
          html = `<strong>${html}</strong>`
        } else if (mark.type === "italic") {
          html = `<em>${html}</em>`
        } else if (mark.type === "underline") {
          html = `<u>${html}</u>`
        } else if (mark.type === "strike") {
          html = `<s>${html}</s>`
        } else if (mark.type === "code") {
          html = `<code>${html}</code>`
        } else if (mark.type === "link") {
          const rawHref =
            typeof mark.attrs?.href === "string" ? mark.attrs.href : ""
          const href = /^https?:\/\//i.test(rawHref) ? rawHref : "#"
          const target =
            typeof mark.attrs?.target === "string"
              ? ` target="${escapeHtml(mark.attrs.target)}"`
              : ""
          const rel =
            typeof mark.attrs?.rel === "string"
              ? ` rel="${escapeHtml(mark.attrs.rel)}"`
              : ""
          html = `<a href="${escapeHtml(href)}"${target}${rel}>${html}</a>`
        }
      }
      return html
    })
    .join("")
}

/**
 * Extracts heading, paragraph (from banner), and first image from an article's content.
 */
export function extractArticleContent(
  article: WebsiteContent | null | undefined,
): ArticleSummary {
  const articleContent = article?.content as ArticleContent | undefined
  const topLevel = articleContent?.content ?? []

  const banner = topLevel.find((n) => n.type === "banner")
  const headingNode = banner?.content?.find((n) => n.type === "heading")
  const paragraphNode = banner?.content?.find((n) => n.type === "paragraph")
  let image = null
  if (article?.cover_image) {
    image = {
      src: article?.cover_image || "",
      alt: "",
      caption: "",
    }
  }
  if (image === null) {
    const imageNode = topLevel.find((n) => n.type === "imageWithCaption")
    const imageAttrs = imageNode?.attrs

    image =
      imageAttrs?.src && typeof imageAttrs.src === "string"
        ? {
            src: imageAttrs.src,
            alt: typeof imageAttrs.alt === "string" ? imageAttrs.alt : null,
            caption:
              typeof imageAttrs.caption === "string"
                ? imageAttrs.caption
                : null,
          }
        : null
  }
  return {
    heading: extractText(headingNode?.content) || null,
    paragraph: nodesToHtml(paragraphNode?.content) || null,
    image,
  }
}

/**
 * Recursively traverses a ProseMirror JSON content structure to find the first image.
 *
 * @param content - The ProseMirror JSON content object
 * @returns The URL of the first image found, or null if no image exists
 */
export function extractFirstImage(content: unknown): string | null {
  if (!content || typeof content !== "object") return null

  const node = content as Record<string, unknown>

  // Check if current node is an image
  if (node.type === "imageWithCaption" || node.type === "image") {
    const attrs = node.attrs as Record<string, unknown> | undefined
    const src = attrs?.src
    if (src && typeof src === "string") {
      return src
    }
  }

  // Recursively check content array
  if (Array.isArray(node.content)) {
    for (const childNode of node.content) {
      const imageUrl = extractFirstImage(childNode)
      if (imageUrl) {
        return imageUrl
      }
    }
  }

  return null
}
