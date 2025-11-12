"use client"

// Based on ./components/tiptap-templates/simple/simple-editor.tsx

import React from "react"
import { EditorContent } from "@tiptap/react"

import { ImageUploadButton } from "./components/tiptap-ui/image-upload-button"

// --- UI Primitives ---
import { Spacer } from "./components/tiptap-ui-primitive/spacer"
import {
  ToolbarGroup,
  ToolbarSeparator,
} from "./components/tiptap-ui-primitive/toolbar"

// --- Tiptap Node ---
import "./components/tiptap-node/blockquote-node/blockquote-node.scss"
import "./components/tiptap-node/code-block-node/code-block-node.scss"
import "./components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "./components/tiptap-node/list-node/list-node.scss"
import "./components/tiptap-node/image-node/image-node.scss"
import "./components/tiptap-node/heading-node/heading-node.scss"
import "./components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "./components/tiptap-ui/heading-dropdown-menu"
import { ListDropdownMenu } from "./components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "./components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "./components/tiptap-ui/code-block-button"
import { ColorHighlightPopover } from "./components/tiptap-ui/color-highlight-popover"
import { LinkPopover } from "./components/tiptap-ui/link-popover"
import { MarkButton } from "./components/tiptap-ui/mark-button"
import { TextAlignButton } from "./components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "./components/tiptap-ui/undo-redo-button"

// --- Styles ---
import "./styles/_keyframe-animations.scss"
import "./styles/_variables.scss"
import "./components/tiptap-templates/simple/simple-editor.scss"

export const MainToolbarContent = () => {
  return (
    <>
      <Spacer />

      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu levels={[1, 2, 3, 4]} />
        <ListDropdownMenu types={["bulletList", "orderedList", "taskList"]} />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
        <MarkButton type="underline" />
        <ColorHighlightPopover />
        <LinkPopover />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="superscript" />
        <MarkButton type="subscript" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>

      <ToolbarGroup>
        <ImageUploadButton text="Add" />
      </ToolbarGroup>
      <Spacer />
    </>
  )
}

interface SimpleEditorProps {
  value?: object
  onChange?: (json: object) => void
  readOnly?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor?: any
}
export default function SimpleEditor({ readOnly, editor }: SimpleEditorProps) {
  return (
    <EditorContent
      editor={editor}
      role="presentation"
      className={`simple-editor-content ${!readOnly ? "simple-editor-content-background" : ""}`}
    />
  )
}
