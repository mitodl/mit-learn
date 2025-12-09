import { JSONContent } from "@tiptap/react"

import type { Editor } from "@tiptap/core"

export const extractFirstH1Title = (
  json: JSONContent,
  level: number,
): string | null => {
  if (!json || !Array.isArray(json.content)) return null

  for (const node of json.content) {
    if (node.type === "heading" && node.attrs?.level === level) {
      const text =
        node.content
          ?.map((child) => child.text || "")
          .join("")
          .trim() || ""

      // Only return if text is not empty
      if (text.length > 0) {
        return text
      }
    }
  }

  // No non-empty H1 found
  return null
}

export function ensureHeadings(editor: Editor) {
  const { state } = editor
  let hasH1 = false,
    hasH2 = false

  state.doc.forEach((node) => {
    if (node.type.name === "heading" && node.attrs.level === 1) hasH1 = true
    if (node.type.name === "heading" && node.attrs.level === 4) hasH2 = true
  })

  // Insert empty H1
  if (!hasH1) {
    editor
      .chain()
      .insertContentAt(0, {
        type: "heading",
        attrs: { level: 1 },
      })
      .run()
  }

  // Insert empty H2 immediately after H1
  if (!hasH2) {
    const first = editor.state.doc.firstChild
    const pos = first ? first.nodeSize : 0

    editor
      .chain()
      .insertContentAt(pos, {
        type: "heading",
        attrs: { level: 4 },
      })
      .run()
  }
}

export function ensureByline(
  editor: Editor,
  userName?: string,
  publishedDate?: string,
) {
  const doc = editor.state.doc
  let hasByline = false

  doc.forEach((node) => {
    if (node.type.name === "byline") hasByline = true
  })
  if (!hasByline) {
    const first = doc.firstChild
    const second = doc.child(1)

    // Insert after H2
    const pos = (first?.nodeSize ?? 0) + (second?.nodeSize ?? 0)

    editor
      .chain()
      .insertContentAt(pos, {
        type: "byline",
        attrs: {
          authorName: userName || "",
          publishedDate: publishedDate || new Date().toLocaleDateString(),
          readTime: "5 min read",
          avatarUrl: "",
        },
      })
      .run()
  }
}

export const slugify = (title: string) => {
  return title
    .toLowerCase()
    .trim()
    .normalize("NFKD") // remove accents
    .replace(/[^\w\s-]/g, "") // remove special chars
    .replace(/\s+/g, "-") // spaces → hyphens
    .replace(/-+/g, "-") // collapse multiple hyphens
    .substring(0, 60) // truncate to 50/60 chars
    .replace(/^-+|-+$/g, "") // trim hyphens
}
