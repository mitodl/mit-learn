import { Extension } from "@tiptap/core"
import { Plugin } from "prosemirror-state"
import { DOMParser as ProseMirrorDOMParser } from "prosemirror-model"

export const CleanPaste = Extension.create({
  name: "cleanPaste",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste(view, event) {
            // Only handle HTML / text paste
            const html = event.clipboardData?.getData("text/html")
            const text = event.clipboardData?.getData("text/plain")

            if (html || text) {
              event.preventDefault()
              event.stopPropagation() // stop DOMObserver

              let contentNode

              if (html) {
                // Strip invalid classes and problematic selectors
                const cleanHtml = html.replace(/class=".*?"/g, "")

                const parser = ProseMirrorDOMParser.fromSchema(view.state.schema)
                const doc = new DOMParser().parseFromString(cleanHtml, "text/html")
                contentNode = parser.parse(doc.body)
              } else {
                // fallback to plain text
                contentNode = view.state.schema.text(text || "")
              }

              const tr = view.state.tr.replaceSelectionWith(contentNode, false)
              view.dispatch(tr)
              return true
            }

            return false
          },
        },
      }),
    ]
  },
})
