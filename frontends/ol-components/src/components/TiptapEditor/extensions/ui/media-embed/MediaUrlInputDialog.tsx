import React, { useState, useCallback } from "react"
import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import { TextField, Alert } from "@mitodl/smoot-design"
import { FormDialog } from "ol-components"

const MediaUrlInputDialog = NiceModal.create(() => {
  const modal = NiceModal.useModal()
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e?: any) => {
    e?.preventDefault()

    if (!url.trim()) {
      setError("URL is required")
      return
    }
    modal.resolve(url)
    modal.hide()
  }

  const handleReset = useCallback(() => {
    setUrl("")
    setError(null)
  }, [setUrl, setError])

  return (
    <FormDialog
      {...muiDialogV5(modal)}
      title="Embed Media"
      confirmText="Insert"
      onSubmit={handleSubmit}
      onReset={handleReset}
      noValidate
      fullWidth
    >
      <TextField
        name="mediaUrl"
        label="Media URL"
        placeholder="https://youtube.com/..."
        value={url}
        error={!!error}
        errorText={error ?? ""}
        onChange={(e: any) => {
          setError(null)
          setUrl(e.target.value)
        }}
        fullWidth
      />

      {error && <Alert severity="error">{error}</Alert>}
    </FormDialog>
  )
})

export default MediaUrlInputDialog
