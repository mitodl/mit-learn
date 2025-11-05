import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"

export interface NodeBackgroundOptions {
  /**
   * The types of nodes that can have background colors applied.
   * @default ["paragraph", "heading", "listItem"]
   */
  types: string[]
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    nodeBackground: {
      /**
       * Toggle a background color on the current node
       */
      toggleNodeBackgroundColor: (color: string) => ReturnType
      /**
       * Set a background color on the current node
       */
      setNodeBackgroundColor: (color: string) => ReturnType
      /**
       * Remove the background color from the current node
       */
      unsetNodeBackgroundColor: () => ReturnType
    }
  }
}

/**
 * A Tiptap extension that adds background color support to block nodes.
 * This extension allows setting background colors on paragraphs, headings, and list items.
 */
export const NodeBackground = Extension.create<NodeBackgroundOptions>({
  name: "nodeBackground",

  addOptions() {
    return {
      types: ["paragraph", "heading", "listItem"],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          backgroundColor: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute("data-background-color") || null,
            renderHTML: (attributes) => {
              if (!attributes.backgroundColor) {
                return {}
              }
              return {
                "data-background-color": attributes.backgroundColor,
                style: `background-color: ${attributes.backgroundColor}`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      toggleNodeBackgroundColor:
        (color: string) =>
        ({ commands, state }) => {
          const { selection } = state
          const { $from } = selection

          // Find the nearest node that can have background color
          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (this.options.types.includes(node.type.name)) {
              const currentBgColor = node.attrs.backgroundColor

              // If the node already has this color, remove it
              if (currentBgColor === color) {
                return commands.unsetNodeBackgroundColor()
              }

              // Otherwise, set the new color
              return commands.setNodeBackgroundColor(color)
            }
          }

          return false
        },

      setNodeBackgroundColor:
        (color: string) =>
        ({ commands, state, chain }) => {
          const { selection } = state
          const { $from, $to } = selection

          // Handle range selections by updating all nodes in the range
          if ($from.pos !== $to.pos) {
            return chain()
              .command(({ tr }) => {
                const { doc } = tr
                doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
                  if (this.options.types.includes(node.type.name)) {
                    tr.setNodeMarkup(pos, undefined, {
                      ...node.attrs,
                      backgroundColor: color,
                    })
                  }
                })
                return true
              })
              .run()
          }

          // Handle cursor position by finding the nearest applicable node
          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (this.options.types.includes(node.type.name)) {
              return commands.updateAttributes(node.type.name, {
                backgroundColor: color,
              })
            }
          }

          return false
        },

      unsetNodeBackgroundColor:
        () =>
        ({ commands, state, chain }) => {
          const { selection } = state
          const { $from, $to } = selection

          // Handle range selections
          if ($from.pos !== $to.pos) {
            return chain()
              .command(({ tr }) => {
                const { doc } = tr
                doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
                  if (
                    this.options.types.includes(node.type.name) &&
                    node.attrs.backgroundColor
                  ) {
                    tr.setNodeMarkup(pos, undefined, {
                      ...node.attrs,
                      backgroundColor: null,
                    })
                  }
                })
                return true
              })
              .run()
          }

          // Handle cursor position
          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (
              this.options.types.includes(node.type.name) &&
              node.attrs.backgroundColor
            ) {
              return commands.updateAttributes(node.type.name, {
                backgroundColor: null,
              })
            }
          }

          return false
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("nodeBackground"),
        props: {
          // Add any additional plugin properties if needed
        },
      }),
    ]
  },
})

export default NodeBackground
