import type { EditorView } from "@tiptap/pm/view"
import { NodeSelection } from "@tiptap/pm/state"

export interface URLToNodeConfig {
  inputNodeName: string
  outputNodeName: string
  extractValue: (text: string) => string | number | null
  createNodeAttrs: (
    value: string | number,
    text: string,
  ) => Record<string, unknown>
}

export function createURLToNodeHandler(config: URLToNodeConfig) {
  return (view: EditorView, event: KeyboardEvent): boolean => {
    if (event.key !== "Enter") return false

    const { state } = view
    const { $from } = state.selection
    const parent = $from.parent

    if (parent.type.name !== "paragraph") return false

    const text = parent.textContent.trim()
    const value = config.extractValue(text)
    if (!value) return false

    event.preventDefault()

    // Check if paragraph is inside input node
    const grandParent = $from.node($from.depth - 1)
    const isInsideInputNode = grandParent?.type.name === config.inputNodeName

    let startPos: number, endPos: number
    if (isInsideInputNode) {
      // Replace the entire input node
      startPos = $from.before($from.depth - 1)
      endPos = startPos + grandParent.nodeSize
    } else {
      // Replace just the paragraph
      startPos = $from.before()
      endPos = startPos + parent.nodeSize
    }

    const node = state.schema.nodes[config.outputNodeName].create(
      config.createNodeAttrs(value, text),
    )

    const tr = state.tr.replaceWith(startPos, endPos, node)
    tr.setSelection(NodeSelection.create(tr.doc, startPos))
    view.dispatch(tr)

    return true
  }
}
