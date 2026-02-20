import React from "react"
import styled from "@emotion/styled"

const CaptionWrapper = styled.div(({ theme }) => ({
  maxWidth: "900px",
  margin: "8px auto 0",

  input: {
    width: "100%",
    border: "none",
    textAlign: "left",
    outline: "none",
    padding: "16px 0",
    fontSize: "14px",
    borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
    background: "transparent",
  },

  p: {
    color: "#626A73",
    textAlign: "left",
    fontSize: "14px !important",
    linHeight: "1rem",
    padding: "5px 0px 16px 0px",
    borderBottom: "1px solid #DDE1E6",
  },
}))

interface EditableCaptionProps {
  caption: string | null | undefined
  isEditable: boolean
  onCaptionChange: (caption: string) => void
  placeholder?: string
}

export const EditableCaption: React.FC<EditableCaptionProps> = ({
  caption,
  isEditable,
  onCaptionChange,
  placeholder = "Add caption…",
}) => {
  return (
    <CaptionWrapper>
      {isEditable ? (
        <input
          type="text"
          placeholder={placeholder}
          value={caption || ""}
          onChange={(e) => onCaptionChange(e.target.value)}
        />
      ) : (
        caption && <p>{caption}</p>
      )}
    </CaptionWrapper>
  )
}
