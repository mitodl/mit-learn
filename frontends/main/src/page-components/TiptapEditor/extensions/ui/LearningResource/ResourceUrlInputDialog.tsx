import React, { useState, useCallback } from "react"
import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import { TextField, Alert } from "@mitodl/smoot-design"
import { FormDialog } from "ol-components"

const CourseUrlInputDialog = NiceModal.create(() => {
  const modal = NiceModal.useModal()
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e?: React.FormEvent) => {
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
      title="Course Media"
      confirmText="Insert"
      onSubmit={handleSubmit}
      onReset={handleReset}
      noValidate
      fullWidth
    >
      <TextField
        name="courseUrl"
        label="Course URL"
        placeholder="learn.mit.edu/search?resource=297..."
        value={url}
        error={!!error}
        errorText={error ?? ""}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          setError(null)
          setUrl(e.target.value)
        }}
        fullWidth
      />

      {error && <Alert severity="error">{error}</Alert>}
    </FormDialog>
  )
})

export default CourseUrlInputDialog
