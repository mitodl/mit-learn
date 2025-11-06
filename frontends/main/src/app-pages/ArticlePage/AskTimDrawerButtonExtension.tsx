import { ReactNodeViewRenderer, Node, NodeViewWrapper } from "@tiptap/react"
import AskTimDrawerButton from "@/page-components/AiChat/AskTimDrawerButton"

const AskTimDrawerButtonWrapper = () => {
  return (
    <NodeViewWrapper>
      <AskTimDrawerButton />
    </NodeViewWrapper>
  )
}

const AskTimDrawerButtonExtension = Node.create({
  name: "askTimDrawerButton",
  group: "block",
  atom: true,
  selectable: true,

  markdownTokenizer: {
    name: "askTimDrawerButton",
    level: "block",

    start: (src) => {
      return src.indexOf("[[asktim]]")
    },

    tokenize: (src, _tokens, _lexer) => {
      // Match [[asktim]]
      const match = /^\[\[asktim\]\]/.exec(src)

      if (!match) {
        return undefined
      }

      return {
        type: "askTimDrawerButton",
        raw: match[0],
      }
    },
  },

  parseMarkdown: (_token, _helpers) => {
    return {
      type: "askTimDrawerButton",
    }
  },

  renderMarkdown: (_node, _helpers) => {
    return "[[asktim]]\n\n"
  },

  addNodeView() {
    return ReactNodeViewRenderer(AskTimDrawerButtonWrapper)
  },
})
export { AskTimDrawerButtonExtension }
