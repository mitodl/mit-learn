import React, { forwardRef, useCallback } from "react"

// --- Tiptap UI ---
import type { UseCalloutConfig } from "./"
import { CALLOUT_SHORTCUT_KEY, useCallout } from "./"

// --- Hooks ---
import { useTiptapEditor } from "../../../vendor/hooks/use-tiptap-editor"

// --- Lib ---
import { parseShortcutKeys } from "../../../vendor/lib/tiptap-utils"

// --- UI Primitives ---
import type { ButtonProps } from "../../../vendor/components/tiptap-ui-primitive/button"
import { Button } from "../../../vendor/components/tiptap-ui-primitive/button"
import { Badge } from "../../../vendor/components/tiptap-ui-primitive/badge"
import { RiInformationFill } from "@remixicon/react"

export interface CalloutButtonProps
  extends Omit<ButtonProps, "type">,
    UseCalloutConfig {
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

export function CalloutShortcutBadge({
  shortcutKeys = CALLOUT_SHORTCUT_KEY,
}: {
  shortcutKeys?: string
}) {
  return <Badge>{parseShortcutKeys({ shortcutKeys })}</Badge>
}

/**
 * Button component for toggling blockquote in a Tiptap editor.
 *
 * For custom button implementations, use the `useCallout` hook instead.
 */
export const CalloutButton = forwardRef<HTMLButtonElement, CalloutButtonProps>(
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
    } = useCallout({
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
        tooltip="Callout"
        onClick={handleClick}
        {...buttonProps}
        ref={ref}
      >
        {children ?? (
          <>
            <RiInformationFill size={24} />
            {text && <span className="tiptap-button-text">{text}</span>}
            {showShortcut && (
              <CalloutShortcutBadge shortcutKeys={shortcutKeys} />
            )}
          </>
        )}
      </Button>
    )
  },
)

CalloutButton.displayName = "CalloutButton"
