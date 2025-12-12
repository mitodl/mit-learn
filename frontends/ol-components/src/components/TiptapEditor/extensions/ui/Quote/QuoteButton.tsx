import React, { forwardRef, useCallback } from "react"

// --- Tiptap UI ---
import type { UseQuoteConfig } from "./"
import { QUOTE_SHORTCUT_KEY, useQuote } from "./"

// --- Hooks ---
import { useTiptapEditor } from "../../../vendor/hooks/use-tiptap-editor"

// --- Lib ---
import { parseShortcutKeys } from "../../../vendor/lib/tiptap-utils"

// --- UI Primitives ---
import type { ButtonProps } from "../../../vendor/components/tiptap-ui-primitive/button"
import { Button } from "../../../vendor/components/tiptap-ui-primitive/button"
import { Badge } from "../../../vendor/components/tiptap-ui-primitive/badge"

export interface QuoteButtonProps
  extends Omit<ButtonProps, "type">,
    UseQuoteConfig {
  /**
   * Optional text to display alongside the icon.
   */
  text?: string
  /**
   * Optional show shortcut keys in the button.
   * @default false
   */
  showShortcut?: boolean
}

export function QuoteShortcutBadge({
  shortcutKeys = QUOTE_SHORTCUT_KEY,
}: {
  shortcutKeys?: string
}) {
  return <Badge>{parseShortcutKeys({ shortcutKeys })}</Badge>
}

/**
 * Button component for toggling blockquote in a Tiptap editor.
 *
 * For custom button implementations, use the `useQuote` hook instead.
 */
export const QuoteButton = forwardRef<HTMLButtonElement, QuoteButtonProps>(
  (
    {
      editor: providedEditor,
      text,
      hideWhenUnavailable = false,
      onToggled,
      showShortcut = false,
      onClick,
      children,
      ...buttonProps
    },
    ref,
  ) => {
    const { editor } = useTiptapEditor(providedEditor)
    const {
      isVisible,
      canToggle,
      isActive,
      handleToggle,
      label,
      shortcutKeys,
      Icon,
    } = useQuote({
      editor,
      hideWhenUnavailable,
      onToggled,
    })

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        handleToggle()
      },
      [handleToggle, onClick],
    )

    if (!isVisible) {
      return null
    }

    return (
      <Button
        type="button"
        data-style="ghost"
        data-active-state={isActive ? "on" : "off"}
        tabIndex={-1}
        disabled={!canToggle}
        data-disabled={!canToggle}
        aria-label={label}
        aria-pressed={isActive}
        tooltip="Quote"
        onClick={handleClick}
        {...buttonProps}
        ref={ref}
      >
        {children ?? (
          <>
            <Icon className="tiptap-button-icon" />
            {text && <span className="tiptap-button-text">{text}</span>}
            {showShortcut && <QuoteShortcutBadge shortcutKeys={shortcutKeys} />}
          </>
        )}
      </Button>
    )
  },
)

QuoteButton.displayName = "QuoteButton"
