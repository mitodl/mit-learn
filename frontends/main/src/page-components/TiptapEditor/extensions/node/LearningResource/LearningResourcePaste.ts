import { Extension } from "@tiptap/core"
import { NodeSelection, Plugin } from "@tiptap/pm/state"

function extractResourceId(url: string): number | null {
  const match = url.match(/resource=(\d+)/)
  if (!match) return null
  return Number(match[1])
}

export const LearningResourceURLHandler = Extension.create({
  name: "learningResourceURLHandler",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleKeyDown(view, event) {
            if (event.key !== "Enter") return false

            const { state } = view
            const { $from } = state.selection
            const parent = $from.parent

            if (parent.type.name !== "paragraph") return false

            const text = parent.textContent.trim()
            const resourceId = extractResourceId(text)
            if (!resourceId) return false

            event.preventDefault()

            // Check if paragraph is inside learningResourceInput node
            const grandParent = $from.node($from.depth - 1)
            const isInsideLearningResourceInput =
              grandParent?.type.name === "learningResourceInput"

            let startPos, endPos
            if (isInsideLearningResourceInput) {
              // Replace the entire learningResourceInput node
              startPos = $from.before($from.depth - 1)
              endPos = startPos + grandParent.nodeSize
            } else {
              // Replace just the paragraph
              startPos = $from.before()
              endPos = startPos + parent.nodeSize
            }

            const node = state.schema.nodes.learningResource.create({
              resourceId,
              href: text,
            })

            const tr = state.tr.replaceWith(startPos, endPos, node)
            tr.setSelection(NodeSelection.create(tr.doc, startPos))
            view.dispatch(tr)

            return true
          },
        },

        /**
         * 🔥 This part disables the Link toolbar button
         * ONLY for auto-converted resource URLs (where text === URL)
         * Allows user-created links (where text !== URL)
         */
        appendTransaction(transactions, oldState, newState) {
          const tr = newState.tr
          let modified = false

          newState.doc.descendants((node, pos) => {
            if (!node.isText || !node.marks.length) return

            const linkMark = node.marks.find(
              (mark) => mark.type.name === "link",
            )
            if (!linkMark) return

            const href = linkMark.attrs.href
            if (!extractResourceId(href)) return

            // Only remove the link mark if the text is the same as the URL
            // This allows user-created links (where text !== URL) to remain
            const nodeText = node.text || ""
            if (nodeText.trim() !== href.trim()) return

            tr.removeMark(pos, pos + node.nodeSize, linkMark.type)
            modified = true
          })

          return modified ? tr : null
        },
      }),
    ]
  },
})
