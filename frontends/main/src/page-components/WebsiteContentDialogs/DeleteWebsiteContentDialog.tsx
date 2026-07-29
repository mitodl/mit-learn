import React, { useCallback } from "react"
import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import { Dialog } from "ol-components"
import { useWebsiteContentDestroy } from "api/hooks/website_content"
import type { WebsiteContent } from "api/v1"

type DeletableContent = Pick<WebsiteContent, "id" | "title" | "content_type">

type DeleteWebsiteContentDialogProps = {
  contentItem: DeletableContent
  /** Called after the item is successfully deleted (e.g. to redirect). */
  onDestroy?: () => void
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  article: "Article",
  news: "News",
}

/**
 * Confirmation dialog for soft-deleting a draft article/news item. Only drafts
 * are deletable (enforced by the backend); this dialog is only surfaced on
 * draft-editing views.
 */
const DeleteWebsiteContentDialog = NiceModal.create(
  ({ contentItem, onDestroy }: DeleteWebsiteContentDialogProps) => {
    const modal = NiceModal.useModal()
    const destroy = useWebsiteContentDestroy()
    const label = CONTENT_TYPE_LABELS[contentItem.content_type ?? ""] ?? "Item"

    // Closing is Dialog's job: it awaits onConfirm and then calls the onClose
    // that muiDialogV5 wires to modal.hide(). Hiding here as well would drive
    // the same transition twice and race Dialog's own post-confirm state
    // update. On a rejected mutation Dialog skips onClose, so the dialog
    // correctly stays open for the user to retry.
    const handleConfirm = useCallback(async () => {
      await destroy.mutateAsync(contentItem.id)
      onDestroy?.()
    }, [destroy, contentItem, onDestroy])

    return (
      <Dialog
        {...muiDialogV5(modal)}
        onConfirm={handleConfirm}
        title={`Delete ${label}`}
        confirmText="Yes, delete"
      >
        Are you sure you want to delete &ldquo;{contentItem.title}&rdquo;?
      </Dialog>
    )
  },
)

/** Open the delete-confirmation dialog for a draft content item. */
export const showDeleteWebsiteContentDialog = (
  contentItem: DeletableContent,
  onDestroy?: () => void,
) => NiceModal.show(DeleteWebsiteContentDialog, { contentItem, onDestroy })

export default DeleteWebsiteContentDialog
