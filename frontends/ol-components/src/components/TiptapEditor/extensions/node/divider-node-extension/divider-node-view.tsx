"use client"

import React from "react"
import styled from "@emotion/styled"
import { NodeViewWrapper } from "@tiptap/react"

const StyledNodeViewWrapper = styled(NodeViewWrapper)`
  position: relative;
  margin: 1.5rem 0;
  display: block;
  width: 100%;
  text-align: center;
  outline: none;

  .tiptap-divider-line {
    background: none; /* remove line */
    height: auto; /* no height needed */
    width: 100%;
    margin: 0 auto;
    text-align: center;
  }

  .tiptap-divider-line::after {
    content: ". . ."; /* <=== THE DOTS */
    font-size: 50px;
    color: rgba(0, 0, 0, 0.6);
    letter-spacing: 6px; /* spacing between dots */
  }
`

export default function DividerNodeView() {
  return (
    <StyledNodeViewWrapper
      data-type="divider"
      tabIndex={0}
      role="separator"
      aria-orientation="horizontal"
    >
      <div className="tiptap-divider-line" />
    </StyledNodeViewWrapper>
  )
}
