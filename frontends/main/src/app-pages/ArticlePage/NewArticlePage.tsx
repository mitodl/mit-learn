"use client"

import React, { useState, useRef } from "react"
import { theme, styled } from "ol-components"
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor"
import { EditorContext, useEditor } from "@tiptap/react"
import { Superscript } from "@tiptap/extension-superscript"
import { Subscript } from "@tiptap/extension-subscript"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { Image } from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TextAlign } from "@tiptap/extension-text-align"
import { Highlight } from "@tiptap/extension-highlight"
import { Placeholder, Selection } from "@tiptap/extensions"

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

import { Markdown } from "@tiptap/markdown"
import Document from "@tiptap/extension-document"
import { ResourceCardExtension } from "./ResourceCardExtension"
import { ResourceListCardExtension } from "./ResourceListCardExtension"
import { AskTimDrawerButtonExtension } from "./AskTimDrawerButtonExtension"
import { Description } from "./DescriptionExtension"

const PageContainer = styled.div({
  color: theme.custom.colors.darkGray2,
  display: "flex",
  height: "100%",
  // position: "fixed",
  // top: "72px",
  // left: 0,
  // right: 0,
  // bottom: "140px",
  overscrollBehavior: "contain",
  overflow: "hidden",
})

const EditorContainer = styled.div({
  flex: 7,
  overflow: "auto",
  minHeight: 0,
})

const PreviewContainer = styled.div({
  flex: 3,
  backgroundColor: "white",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  minHeight: 0,
})

const CodeTextarea = styled.textarea({
  flex: 1,
  fontFamily: "monospace",
  fontSize: "12px",
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
  width: "70vw",
  height: "100%",
  overscrollBehavior: "contain",
})

const CustomDocument = Document.extend({
  content:
    "heading description resourceListCard* (paragraph | taskList | bulletList | orderedList | codeBlock | horizontalRule | image | imageUpload | resourceCard | askTimDrawerButton)*",
})

const extensions = [
  CustomDocument,
  Description,
  Placeholder.configure({
    placeholder: ({ node }) => {
      if (node.type.name === "heading") {
        return "Add a title"
      }
      if (node.type.name === "description") {
        return "Add a description"
      }
      if (node.type.name === "paragraph") {
        return "Add a paragraph"
      }
      if (node.type.name === "resourceListCard") {
        return "Add a learning resource list card"
      }
      if (node.type.name === "resourceCard") {
        return "Add a learning resource card"
      }
      if (node.type.name === "askTimDrawerButton") {
        return "Add an AI assistant button"
      }

      return ""
    },
  }),
  Markdown,
  StarterKit.configure({
    document: false, // Disable default document to use our CustomDocument
    horizontalRule: false,
    heading: {
      levels: [1, 2, 3, 4, 5, 6],
    },
    blockquote: false, // Disable automatic blockquote creation
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
  ResourceListCardExtension,
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
  onChange: (json: string) => void
}

const Viewer: React.FC<ViewerProps> = ({ content, onChange }) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  return (
    <CodeTextarea
      value={content}
      onChange={handleChange}
      placeholder="Edit JSON here..."
      spellCheck={false}
    />
  )
}

const NewArticlePage: React.FC = () => {
  const [serializedContent, setSerializedContent] = useState("")
  const isUpdatingFromJSON = useRef(false)

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
    // @ts-expect-error - Type conflict between @tiptap/starter-kit bundled @tiptap/core and main @tiptap/core
    extensions,
    content,
    onUpdate: ({ editor: currentEditor }) => {
      // Only update JSON if we're not in the middle of updating from JSON
      if (!isUpdatingFromJSON.current) {
        const json = currentEditor.getJSON()
        setSerializedContent(JSON.stringify(json, null, 2))
      }
    },
  })

  const handleJSONChange = (jsonString: string) => {
    if (!editor) return

    // Set flag to prevent the editor's onUpdate from firing back
    isUpdatingFromJSON.current = true

    setSerializedContent(jsonString)

    // Update the editor content from JSON
    try {
      const json = JSON.parse(jsonString)
      editor.commands.setContent(json)
    } catch (error) {
      console.error("Error parsing JSON:", error)
    }

    // Reset flag after update completes
    // Use setTimeout to ensure all updates are processed
    setTimeout(() => {
      isUpdatingFromJSON.current = false
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
          <Viewer content={serializedContent} onChange={handleJSONChange} />
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
