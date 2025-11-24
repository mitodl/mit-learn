import React, { useState, useCallback } from "react"
import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import { TextField, Alert } from "@mitodl/smoot-design"
import { FormDialog } from "ol-components"

interface ImageAltTextInputProps {
  initialAlt?: string
}

const ImageAltTextInput = NiceModal.create(
  ({ initialAlt = "" }: ImageAltTextInputProps) => {
    const modal = NiceModal.useModal()
    const [altText, setAltText] = useState(initialAlt)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = (e?: any) => {
      e?.preventDefault()

      if (!altText.trim()) {
        setError("Alt text is required")
        return
      }
      modal.resolve(altText)
      modal.hide()
    }

    const handleReset = useCallback(() => {
      setAltText("")
      setError(null)
    }, [setAltText, setError])

    return (
      <FormDialog
        {...muiDialogV5(modal)}
        title="Image Alt Text"
        confirmText="Insert"
        onSubmit={handleSubmit}
        onReset={handleReset}
        noValidate
        fullWidth
      >
        <TextField
          name="altText"
          label="Alt Text"
          placeholder="Describe the image..."
          value={altText}
          error={!!error}
          errorText={error ?? ""}
          onChange={(e: any) => {
            setError(null)
            setAltText(e.target.value)
          }}
          fullWidth
        />

        {error && <Alert severity="error">{error}</Alert>}
      </FormDialog>
    )
  },
)

export default ImageAltTextInput
