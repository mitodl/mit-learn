import React from "react"
import { NodeViewWrapper } from "@tiptap/react"
import type { ReactNodeViewProps } from "@tiptap/react"
import styled from "@emotion/styled"
import Image from "next/image"
import { Avatar, ShareButton } from "./Icon"
import { useUserMe } from "api/hooks/user"

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

const BylineComponent = (props: ReactNodeViewProps) => {
  const {
    authorName,
    avatarUrl,
    readTime,
    publishedDate,
    editable: isEditable,
  } = props.node.attrs
  const { isFetching: isLoadingUser, data: user } = useUserMe()
  return (
    <StyledNodeViewWrapper
      className="byline-wrapper"
      style={{ display: isEditable ? "none" : "flex" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
          <span className="byline-name">
            By{" "}
            {isEditable && isLoadingUser
              ? "Loading name..."
              : authorName
                ? authorName
                : `${user?.first_name}  ${user?.last_name}`}
          </span>
          <span className="detail-summary">
            &nbsp;&nbsp;{readTime}&nbsp;&nbsp;
          </span>
          <span className="detail-summary">{"   -   "}</span>
          <span className="detail-summary">
            &nbsp;&nbsp;
            {publishedDate ? publishedDate : new Date().toLocaleDateString()}
          </span>
        </div>
      </div>
      <div className="share-button">
        <ShareButton size={30} />{" "}
      </div>
    </StyledNodeViewWrapper>
  )
}

export default BylineComponent
