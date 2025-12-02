// insert-divider-button.tsx
import React, { forwardRef } from "react"
import type { Editor } from "@tiptap/core"
import { Button } from "../../../vendor/components/tiptap-ui-primitive/button"
import { useTiptapEditor } from "../../../vendor/hooks/use-tiptap-editor"

export const InsertDividerButton = forwardRef<
  HTMLButtonElement,
  { editor?: Editor; text?: string }
>(({ editor: providedEditor, text }, ref) => {
  const { editor } = useTiptapEditor(providedEditor)
  if (!editor) return null

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    editor.chain().focus().insertDivider().run()
  }

  return (
    <Button type="button" data-style="ghost" onClick={handleClick} ref={ref}>
      {/* You can put an Icon here. For now: */}
      <span className="tiptap-button-icon">• •</span>
      {text && <span className="tiptap-button-text">{text}</span>}
    </Button>
  )
})

InsertDividerButton.displayName = "InsertDividerButton"
