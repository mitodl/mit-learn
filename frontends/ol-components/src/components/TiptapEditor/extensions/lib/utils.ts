import { JSONContent } from "@tiptap/react"

import type { Editor } from "@tiptap/core"

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

export function ensureByline(editor: Editor) {
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
          authorName: "",
          publishedDate: "",
          readTime: "5 min read",
          avatarUrl: "",
        },
      })
      .run()
  }
}
