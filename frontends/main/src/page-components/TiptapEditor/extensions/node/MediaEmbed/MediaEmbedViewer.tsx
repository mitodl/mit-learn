import React from "react"
import styled from "@emotion/styled"

const StyledWrapper = styled.div<{ layout: string }>`
  position: relative;
  width: 100%;
  margin: 24px 0;
  text-align: center;

  .media-container {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;

    iframe {
      width: 100%;
      height: 100%;
      border-radius: 6px;
      display: block;
    }
  }

  .media-caption {
    max-width: 900px;
    margin: 8px auto 0;

    p {
      font-size: 14px;
      color: #555;
      text-align: center;
      font-style: italic;
    }
  }

  /* Layout sizes */
  &.default {
    width: 100%;
  }

  &.wide {
    width: 90vw;
    margin-left: calc(-45vw + 50%);
  }

  &.full {
    width: 100vw;
    margin-left: calc(-50vw + 50%);
  }
`

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
    <StyledWrapper layout={layout} className={`layout-${layout} media-embed`}>
      <div className="media-container">
        <iframe src={src} frameBorder="0" allowFullScreen title={caption} />
      </div>

      {caption && (
        <div className="media-caption">
          <p>{caption}</p>
        </div>
      )}
    </StyledWrapper>
  )
}
