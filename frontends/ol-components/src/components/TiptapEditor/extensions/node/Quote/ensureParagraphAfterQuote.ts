import { Plugin } from "@tiptap/pm/state"

export function ensureParagraphAfterQuotePlugin() {
  return new Plugin({
    appendTransaction(transactions, oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null

      const tr = newState.tr
      let modified = false

      newState.doc.descendants((node, pos) => {
        if (node.type.name === "quote") {
          const endPos = pos + node.nodeSize
          const nextNode = newState.doc.nodeAt(endPos)

          if (!nextNode || nextNode.type.name !== "paragraph") {
            tr.insert(endPos, newState.schema.nodes.paragraph.create())
            modified = true
          }
        }
      })

      return modified ? tr : null
    },
  })
}
