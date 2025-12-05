import React, { forwardRef, useCallback } from "react"
import type { Editor } from "@tiptap/core"
import { Button } from "../../../vendor/components/tiptap-ui-primitive/button"
import { Badge } from "../../../vendor/components/tiptap-ui-primitive/badge"
import { parseShortcutKeys } from "../../../vendor/lib/tiptap-utils"
import {
  useLearningResourceEmbed,
  LEARNING_RESOURCE_SHORTCUT_KEY,
} from "./useLearningResourceEmbed"
import { useTiptapEditor } from "../../../vendor/hooks/use-tiptap-editor"

export interface LearningResourceButtonProps {
  editor?: Editor
  text?: string
  showShortcut?: boolean
  icon?: React.FC<React.SVGProps<SVGSVGElement>>
  onClick?: (e: React.MouseEvent) => void
}

function LearningResourceShortcutBadge() {
  return (
    <Badge>
      {parseShortcutKeys({ shortcutKeys: LEARNING_RESOURCE_SHORTCUT_KEY })}
    </Badge>
  )
}

export const LearningResourceButton = forwardRef<
  HTMLButtonElement,
  LearningResourceButtonProps
>(
  (
    {
      editor: providedEditor,
      text,
      showShortcut,
      icon: CustomIcon,
      onClick,
      ...props
    },
    ref,
  ) => {
    const { editor } = useTiptapEditor(providedEditor)

    const {
      isVisible,
      canInsert,
      label,
      Icon: DefaultIcon,
      handleEmbed,
    } = useLearningResourceEmbed(editor)

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        handleEmbed()
      },
      [handleEmbed, onClick],
    )

    if (!isVisible) return null

    const RenderIcon = CustomIcon ?? DefaultIcon

    return (
      <Button
        type="button"
        data-style="ghost"
        disabled={!canInsert}
        aria-label={label}
        tooltip={label}
        onClick={handleClick}
        ref={ref}
        {...props}
      >
        <RenderIcon />
        {text && <span className="tiptap-button-text">{text}</span>}
        {showShortcut && <LearningResourceShortcutBadge />}
      </Button>
    )
  },
)

LearningResourceButton.displayName = "LearningResourceButton"
