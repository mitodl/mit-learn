"use client"

// Based on ./components/tiptap-templates/simple/simple-editor.tsx

import React, { useRef, useEffect, ChangeEventHandler } from "react"
import { EditorContext, useEditor } from "@tiptap/react"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { TaskItem, TaskList } from "@tiptap/extension-list"

import { Image } from "@tiptap/extension-image"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { Input } from "@mitodl/smoot-design"

import styled from "@emotion/styled"

import { Selection } from "@tiptap/extensions"

// --- UI Primitives ---
import { Toolbar } from "./components/tiptap-ui-primitive/toolbar"

import TiptapEditor, { MainToolbarContent } from "./TiptapEditor"

// --- Tiptap Node ---
import { ImageUploadNode } from "./components/tiptap-node/image-upload-node/image-upload-node-extension"
import { HorizontalRule } from "./components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"

import "./components/tiptap-node/blockquote-node/blockquote-node.scss"
import "./components/tiptap-node/code-block-node/code-block-node.scss"
import "./components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "./components/tiptap-node/list-node/list-node.scss"
import "./components/tiptap-node/image-node/image-node.scss"
import "./components/tiptap-node/heading-node/heading-node.scss"
import "./components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "./lib/tiptap-utils"

// --- Styles ---
import "./styles/_keyframe-animations.scss"
import "./styles/_variables.scss"
import "./components/tiptap-templates/simple/simple-editor.scss"

const TitleInput = styled(Input)({
  width: "100%",
  margin: "10px 0",
})

interface SimpleEditorProps {
  value?: object
  onChange?: (json: object) => void
  readOnly?: boolean
  title?: string
  setTitle?: ChangeEventHandler<HTMLTextAreaElement | HTMLInputElement>
  "data-testid"?: string
}
export default function SimpleEditor({
  value,
  onChange,
  readOnly,
  setTitle,
  title,
  "data-testid": testId,
}: SimpleEditorProps) {
  const toolbarRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    content: value || {
      type: "doc",
      content: [{ type: "paragraph", content: [] }],
    },
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (!readOnly) {
        const json = editor.getJSON()
        onChange?.(json)
      }
    },
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: "simple-editor",
      },
    },
    extensions: [
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
      Typography,
      Superscript,
      Subscript,
      Selection,
      Image,
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => console.error("Upload failed:", error),
      }),
    ],
  })

  // 👇 Important: update content when fetched JSON changes
  useEffect(() => {
    if (editor && value) {
      editor.commands.setContent(value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  return (
    <div className="simple-editor-wrapper" data-testid={testId}>
      <EditorContext.Provider value={{ editor }}>
        {!readOnly && (
          <Toolbar ref={toolbarRef}>
            <MainToolbarContent />
          </Toolbar>
        )}

        {!readOnly && (
          <TitleInput
            type="text"
            value={title}
            onChange={setTitle}
            placeholder="Enter article title"
            className="input-field"
          />
        )}

        <TiptapEditor editor={editor} readOnly={readOnly} />
      </EditorContext.Provider>
    </div>
  )
}
