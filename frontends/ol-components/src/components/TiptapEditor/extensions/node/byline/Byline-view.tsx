import React from "react"
import { NodeViewWrapper } from "@tiptap/react"
import type { ReactNodeViewProps } from "@tiptap/react"
import styled from "@emotion/styled"
import Image from "next/image"
import { Avatar } from "./Icon"
import { RiShareFill } from "@remixicon/react"

const StyledNodeViewWrapper = styled(NodeViewWrapper)`
  background: rgb(255 255 255);
  padding: 10px;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 6px rgb(230 230 230);
  border: 1px solid rgb(240 240 240);

  .share-button {
    margin-right: 40px;
    display: flex;
  }

  .byline-name {
    color: #000;
  }

  .detail-summary {
    color: #bdb2b2;
  }
`
const IconCircle = styled(NodeViewWrapper)`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease;
  &:hover: {
    background: #f5f5f5;
  }
`

const Container = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "8px",
})

const BylineComponent = (props: ReactNodeViewProps) => {
  const {
    authorName,
    avatarUrl,
    readTime,
    publishedDate,
    editable: isEditable,
  } = props.node.attrs

  return (
    <StyledNodeViewWrapper style={{ display: isEditable ? "none" : "flex" }}>
      <Container>
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
        ) : (
          <Avatar size={32} />
        )}

        <div style={{ display: "flex", gap: "8px", color: "#666" }}>
          <span className="byline-name">By {authorName}</span>
          <span className="detail-summary">
            &nbsp;&nbsp;{readTime}&nbsp;&nbsp;
          </span>
          <span className="detail-summary">{"   -   "}</span>
          <span className="detail-summary">
            &nbsp;&nbsp;
            {publishedDate ? publishedDate : new Date().toLocaleDateString()}
          </span>
        </div>
      </Container>
      <div className="share-button">
        <IconCircle>
          <RiShareFill
            size={20} // set custom `width` and `height`
            color="#9e9e9e" // set `fill` color
          />
        </IconCircle>
      </div>
    </StyledNodeViewWrapper>
  )
}

export default BylineComponent
