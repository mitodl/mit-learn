import React from "react"
import styled from "@emotion/styled"
import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import { Dialog } from "ol-components"

/**
 * Confirmation for publishing or unpublishing a content item.
 *
 * Confirmation only: the editor owns the save, since it holds the title and
 * document state, so it passes `onConfirm` and this dialog never mutates
 * anything itself.
 */

/**
 * Three deltas from the shared Dialog that the design calls for here. Scoped to
 * this dialog rather than applied to `Dialog`, which every other dialog in the
 * app shares:
 *  - the footer splits the row equally between the two buttons instead of
 *    sizing each to its label, with a wider 12px gap than Dialog's 4px;
 *  - the body copy is the design's P1 (16/26); the theme's `body1` is 16/20.
 */
const ConfirmDialog = styled(Dialog)({
  ".MuiDialogActions-root": {
    gap: "12px",
    button: {
      flex: "1 0 0",
      minWidth: 0,
    },
  },
})

const CONTENT_CSS = {
  /* The design leaves 40px between the copy and the buttons, not Dialog's 28. */
  marginBottom: "40px",
  ".MuiTypography-root": {
    lineHeight: "26px",
  },
}

type PublishWebsiteContentDialogProps = {
  /** Display label for the content type being acted on, e.g. "Article". */
  contentLabel: string
  /** true confirms publishing, false confirms unpublishing. */
  publish: boolean
  /** Performs the save. The dialog closes once it resolves. */
  onConfirm: () => void | Promise<void>
}

const PublishWebsiteContentDialog = NiceModal.create(
  ({ contentLabel, publish, onConfirm }: PublishWebsiteContentDialogProps) => {
    const modal = NiceModal.useModal()
    // The design writes the noun in sentence case ("Publish article").
    const noun = contentLabel.toLowerCase()

    return (
      <ConfirmDialog
        {...muiDialogV5(modal)}
        // Closing is Dialog's job: it awaits onConfirm then calls the onClose
        // that muiDialogV5 wires to modal.hide(). See the longer note in
        // DeleteWebsiteContentDialog.
        onConfirm={onConfirm}
        title={publish ? `Publish ${noun}` : `Unpublish ${noun}`}
        confirmText={
          publish ? `Yes, Publish ${noun}` : `Yes, Unpublish ${noun}`
        }
        message={
          publish
            ? `Publishing this ${noun} will make it publicly available. You can unpublish it again at any time.`
            : `Unpublishing this ${noun} will remove it from public view. You can publish it again at any time.`
        }
        contentCss={CONTENT_CSS}
      />
    )
  },
)

/** Confirm publishing a content item, then run `onConfirm`. */
export const showPublishWebsiteContentDialog = (
  contentLabel: string,
  onConfirm: () => void | Promise<void>,
) =>
  NiceModal.show(PublishWebsiteContentDialog, {
    contentLabel,
    publish: true,
    onConfirm,
  })

/** Confirm unpublishing a content item, then run `onConfirm`. */
export const showUnpublishWebsiteContentDialog = (
  contentLabel: string,
  onConfirm: () => void | Promise<void>,
) =>
  NiceModal.show(PublishWebsiteContentDialog, {
    contentLabel,
    publish: false,
    onConfirm,
  })

export default PublishWebsiteContentDialog
