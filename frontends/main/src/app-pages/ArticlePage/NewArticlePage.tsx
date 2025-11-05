"use client"

import React, { useState, useRef } from "react"
import { theme, styled, LearningResourceCard } from "ol-components"
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor"
import {
  EditorContext,
  useEditor,
  ReactNodeViewRenderer,
  Node,
  mergeAttributes,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react"
import { Superscript } from "@tiptap/extension-superscript"
import { Subscript } from "@tiptap/extension-subscript"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { Image } from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography as TipTapTypography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Selection } from "@tiptap/extensions"

// --- Tiptap Node ---
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import {
  SlashCommands,
  renderSlashCommands,
  getSuggestionItems,
} from "@/components/tiptap-node/slash-commands/slash-commands-extension"

import content from "@/components/tiptap-templates/simple/data/content.json"

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils"

import { useLearningResourcesDetail } from "api/hooks/learningResources"
import AskTimDrawerButton from "@/page-components/AiChat/AskTimDrawerButton"

import { Markdown } from "@tiptap/markdown"

const PageContainer = styled.div({
  color: theme.custom.colors.darkGray2,
  display: "flex",
  // position: "fixed",
  // top: "72px",
  // left: 0,
  // right: 0,
  // bottom: "140px",
  overscrollBehavior: "contain",
  overflow: "hidden",
})

const EditorContainer = styled.div({
  flex: 6,
})

const PreviewContainer = styled.div({
  flex: 4,
  backgroundColor: "white",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
})

const MarkdownTextarea = styled.textarea({
  flex: 1,
  fontFamily: "monospace",
  fontSize: "14px",
  padding: "16px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "4px",
  resize: "none",
  whiteSpace: "pre",
  overflowWrap: "normal",
  overflowX: "auto",
  "&:focus": {
    outline: `2px solid ${theme.custom.colors.mitRed}`,
    outlineOffset: "2px",
  },
})

const StyledSimpleEditor = styled(SimpleEditor)({
  width: "60vw",
  height: "calc(100vh - 205px)",
  overscrollBehavior: "contain",
})

const Card = styled.div({
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  background: theme.custom.colors.white,
  display: "block",
  overflow: "hidden",
  minWidth: "300px",
  maxWidth: "300px",
  padding: "16px",
})

const ResourceCardWrapper = (props: NodeViewProps) => {
  const { node } = props

  const { data: resource, isLoading } = useLearningResourcesDetail(
    node.attrs.resourceId,
  )
  if (isLoading) {
    return <Card>Loading...</Card>
  }
  if (!resource) {
    return <Card>Resource not found</Card>
  }

  return (
    <NodeViewWrapper>
      <LearningResourceCard resource={resource} />
    </NodeViewWrapper>
  )
}

const ResourceCardExtension = Node.create({
  name: "resourceCard",

  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      resourceId: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [{ tag: "resource-card" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["resource-card", mergeAttributes(HTMLAttributes)]
  },

  markdownTokenizer: {
    name: "resourceCard",
    level: "block",

    start: (src) => {
      return src.indexOf("[[resource-card:")
    },

    tokenize: (src, _tokens, _lexer) => {
      // Match [[resource:resourceId]]
      const match = /^\[\[resource-card:(\d+)\]\]/.exec(src)

      if (!match) {
        return undefined
      }

      return {
        type: "resourceCard",
        raw: match[0],
        resourceId: match[1],
      }
    },
  },

  parseMarkdown: (token, _helpers) => {
    return {
      type: "resourceCard",
      attrs: {
        resourceId: token.resourceId || null,
      },
    }
  },

  renderMarkdown: (node, _helpers) => {
    const resourceId = node.attrs?.resourceId || ""
    return `[[resource-card:${resourceId}]]\n\n`
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResourceCardWrapper)
  },
})

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

const extensions = [
  Markdown,
  StarterKit.configure({
    horizontalRule: false,
    link: {
      openOnClick: false,
      enableClickSelection: true,
    },
  }),
  HorizontalRule,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Highlight.configure({ multicolor: true }),
  Image,
  TipTapTypography,
  Superscript,
  Subscript,
  Selection,
  ImageUploadNode.configure({
    accept: "image/*",
    maxSize: MAX_FILE_SIZE,
    limit: 3,
    upload: handleImageUpload,
    onError: (error) => console.error("Upload failed:", error),
  }),
  ResourceCardExtension,
  AskTimDrawerButtonExtension,
  SlashCommands.configure({
    suggestion: {
      items: ({ query }: { query: string }) => getSuggestionItems(query),
      render: renderSlashCommands,
    },
  }),
]

interface ViewerProps {
  content: string
  onChange: (markdown: string) => void
}

const Viewer: React.FC<ViewerProps> = ({ content, onChange }) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  return (
    <MarkdownTextarea
      value={content}
      onChange={handleChange}
      placeholder="Edit markdown here..."
      spellCheck={false}
    />
  )
}

const NewArticlePage: React.FC = () => {
  const [serializedContent, setSerializedContent] = useState("")
  const isUpdatingFromMarkdown = useRef(false)

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: "simple-editor",
      },
    },
    extensions,
    content,
    onUpdate: ({ editor: currentEditor }) => {
      // Only update markdown if we're not in the middle of updating from markdown
      if (!isUpdatingFromMarkdown.current) {
        setSerializedContent(currentEditor.getMarkdown())
      }
    },
  })

  const handleMarkdownChange = (markdown: string) => {
    if (!editor) return

    // Set flag to prevent the editor's onUpdate from firing back
    isUpdatingFromMarkdown.current = true

    setSerializedContent(markdown)

    // Update the editor content from markdown
    try {
      editor.commands.setContent(markdown, {
        contentType: "markdown",
      })
    } catch (error) {
      console.error("Error parsing markdown:", error)
    }

    // Reset flag after update completes
    // Use setTimeout to ensure all updates are processed
    setTimeout(() => {
      isUpdatingFromMarkdown.current = false
    }, 50)
  }

  if (!editor) {
    return <div>Loading...</div>
  }

  return (
    <PageContainer>
      <EditorContainer>
        <EditorContext.Provider value={{ editor }}>
          <StyledSimpleEditor editor={editor} />
        </EditorContext.Provider>
      </EditorContainer>
      <PreviewContainer>
        {editor && (
          <Viewer content={serializedContent} onChange={handleMarkdownChange} />
        )}
      </PreviewContainer>
    </PageContainer>
  )

  // return (
  //   <EditorContext.Provider value={{ editor }}>
  //     <MarkButton
  //       editor={editor}
  //       type="bold"
  //       text="Bold"
  //       hideWhenUnavailable={true}
  //       showShortcut={true}
  //       onToggled={() => console.log("Mark toggled!")}
  //     />
  //     <MarkButton type="italic" />
  //     <MarkButton type="strike" />
  //     <MarkButton type="code" />
  //     <MarkButton type="underline" />
  //     <MarkButton type="superscript" />
  //     <MarkButton type="subscript" />

  //     <EditorContent editor={editor} role="presentation" />
  //   </EditorContext.Provider>
  // )
}

export { NewArticlePage }
