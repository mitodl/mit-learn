"use client"

import { Extension } from "@tiptap/core"
import { ReactRenderer } from "@tiptap/react"
import Suggestion, { SuggestionOptions } from "@tiptap/suggestion"
import { Editor } from "@tiptap/react"
import { SlashCommandsList } from "./slash-commands-list"

export interface CommandItem {
  title: string
  description?: string
  icon?: string
  command: ({ editor, range }: { editor: Editor; range: any }) => void
  aliases?: string[]
}

export const SlashCommands = Extension.create({
  name: "slashCommands",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor
          range: any
          props: any
        }) => {
          props.command({ editor, range })
        },
      } as Partial<SuggestionOptions>,
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})

export const getSlashCommands = (): CommandItem[] => [
  {
    title: "Heading 1",
    description: "Large section heading",
    icon: "H1",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 1 })
        .run()
    },
    aliases: ["h1", "heading1"],
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: "H2",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 2 })
        .run()
    },
    aliases: ["h2", "heading2"],
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: "H3",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 3 })
        .run()
    },
    aliases: ["h3", "heading3"],
  },
  {
    title: "Bullet List",
    description: "Create a simple bullet list",
    icon: "•",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
    aliases: ["ul", "unordered"],
  },
  {
    title: "Numbered List",
    description: "Create a list with numbering",
    icon: "1.",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
    aliases: ["ol", "ordered"],
  },
  {
    title: "Task List",
    description: "Track tasks with checkboxes",
    icon: "☑",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run()
    },
    aliases: ["todo", "checkbox"],
  },
  {
    title: "Blockquote",
    description: "Capture a quote",
    icon: '"',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    },
    aliases: ["quote"],
  },
  {
    title: "Code Block",
    description: "Display code with syntax highlighting",
    icon: "</>",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
    },
    aliases: ["code", "codeblock"],
  },
  {
    title: "Horizontal Rule",
    description: "Insert a horizontal divider",
    icon: "―",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
    aliases: ["hr", "divider", "line"],
  },
  {
    title: "Resource Card",
    description: "Insert a learning resource card",
    icon: "📚",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent("<p></p>")
        .run()

      // Insert after a brief delay to ensure the deletion completes
      setTimeout(() => {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "resourceCard",
            attrs: { resourceId: "14731" },
          })
          .run()
      }, 0)
    },
    aliases: ["resource", "card"],
  },
  {
    title: "Ask TIM Button",
    description: "Insert Ask TIM AI button",
    icon: "🤖",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent("<p></p>")
        .run()

      // Insert after a brief delay to ensure the deletion completes
      setTimeout(() => {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "askTimDrawerButton",
          })
          .run()
      }, 0)
    },
    aliases: ["asktim", "ai", "tim"],
  },
]

export const getSuggestionItems = (query: string): CommandItem[] => {
  const commands = getSlashCommands()

  if (!query) {
    return commands
  }

  const searchQuery = query.toLowerCase()

  return commands.filter((item) => {
    const titleMatch = item.title.toLowerCase().includes(searchQuery)
    const descMatch = item.description?.toLowerCase().includes(searchQuery)
    const aliasMatch = item.aliases?.some((alias) =>
      alias.toLowerCase().includes(searchQuery),
    )

    return titleMatch || descMatch || aliasMatch
  })
}

export const renderSlashCommands = () => {
  let component: ReactRenderer | null = null
  let popup: HTMLDivElement | null = null

  return {
    onStart: (props: any) => {
      console.log("[SlashCommands] onStart", props)

      component = new ReactRenderer(SlashCommandsList, {
        props,
        editor: props.editor,
      })

      if (!props.clientRect) {
        console.log("[SlashCommands] no clientRect")
        return
      }

      // Create popup element
      popup = document.createElement("div")
      popup.style.position = "fixed"
      popup.style.zIndex = "1000"
      document.body.appendChild(popup)

      // Mount the React component
      if (component.element) {
        popup.appendChild(component.element)
        console.log("[SlashCommands] mounted element")
      }

      // Position the popup
      const rect = props.clientRect()
      if (rect) {
        popup.style.top = `${rect.bottom + window.scrollY}px`
        popup.style.left = `${rect.left + window.scrollX}px`
        console.log("[SlashCommands] positioned at", rect.bottom, rect.left)
      }
    },

    onUpdate(props: any) {
      component?.updateProps(props)

      if (!props.clientRect || !popup) {
        return
      }

      // Update position
      const rect = props.clientRect()
      if (rect) {
        popup.style.top = `${rect.bottom + window.scrollY}px`
        popup.style.left = `${rect.left + window.scrollX}px`
      }
    },

    onKeyDown(props: any) {
      if (props.event.key === "Escape") {
        return true
      }

      return component?.ref?.onKeyDown(props) || false
    },

    onExit() {
      if (popup && popup.parentNode) {
        popup.parentNode.removeChild(popup)
      }
      popup = null
      component?.destroy()
    },
  }
}
