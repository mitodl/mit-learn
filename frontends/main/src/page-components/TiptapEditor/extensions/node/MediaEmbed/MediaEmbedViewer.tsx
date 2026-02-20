import React from "react"
import styled from "@emotion/styled"
import { EditableCaption } from "../shared/EditableCaption"

const StyledWrapper = styled.div({
  position: "relative",
  width: "100%",
  margin: "24px 0",
  textAlign: "center",

  "&.layout-default": {
    width: "100%",
  },

  "&.layout-wide": {
    width: "90vw",
    marginLeft: "calc(-45vw + 50%)",
  },

  "&.layout-full": {
    width: "100vw",
    marginLeft: "calc(-50vw + 50%)",
  },
})

const MediaContainer = styled.div({
  position: "relative",
  width: "100%",
  aspectRatio: "16 / 9",
  overflow: "hidden",

  iframe: {
    width: "100%",
    height: "100%",
    borderRadius: "6px",
    display: "block",
  },
})

interface MediaEmbedNode {
  attrs: {
    src?: string
    caption?: string
    layout?: string
  }
}

export const MediaEmbedViewer = ({ node }: { node?: MediaEmbedNode }) => {
  const src = node?.attrs?.src || ""
  const caption = node?.attrs?.caption || ""
  const layout = node?.attrs?.layout || "default"

  return (
    <StyledWrapper className={`layout-${layout}`}>
      <MediaContainer>
        <iframe src={src} frameBorder="0" allowFullScreen title={caption} />
      </MediaContainer>

      <EditableCaption
        caption={caption}
        isEditable={false}
        onCaptionChange={() => {}}
      />
    </StyledWrapper>
  )
}
