import React from "react"
import {
  ReactNodeViewRenderer,
  Node,
  mergeAttributes,
  NodeViewWrapper,
  NodeViewContent,
} from "@tiptap/react"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { BannerBackground } from "../../../../Banner/Banner"
import Container from "@mui/material/Container"
import styled from "@emotion/styled"
import type { ExtendedNodeConfig } from "../types"

const FullWidthContainer = styled.div({
  position: "relative",
  left: "50%",
  right: "50%",
  marginLeft: "-50vw",
  marginRight: "-50vw",
  width: "100vw",
})

const InnerContainer = styled(Container)({
  "&&": {
    maxWidth: "890px",
  },
})

const StyledNodeViewContent = styled(NodeViewContent)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  "&&&&& h1": {
    marginTop: 0,
    marginBottom: "16px",
  },
  "&&&&& p": {
    position: "relative",
    marginBottom: 0,
  },
  ".is-empty:not(.with-slash)[data-placeholder]:has(> .ProseMirror-trailingBreak:only-child)::before":
    {
      color: theme.custom.colors.silverGrayLight,
      opacity: 0.4,
    },
}))

const StyledBannerBackground = styled(BannerBackground)(({ theme }) => ({
  padding: "64px 0",
  [theme.breakpoints.down("sm")]: {
    padding: "42px 0",
  },
}))

const BannerWrapper = () => {
  return (
    <NodeViewWrapper as="div">
      <FullWidthContainer>
        <StyledBannerBackground>
          <InnerContainer>
            <StyledNodeViewContent className="banner-content-editable" />
          </InnerContainer>
        </StyledBannerBackground>
      </FullWidthContainer>
    </NodeViewWrapper>
  )
}

const bannerNodeConfig: ExtendedNodeConfig = {
  name: "banner",

  selectable: false,

  // Enforce that the node must contain exactly a title (heading) and subheading (paragraph)
  content: "heading paragraph",

  isolating: false,

  parseHTML() {
    return [{ tag: "banner" }]
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ["banner", mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BannerWrapper)
  },

  getPlaceholders: (childNode: ProseMirrorNode) => {
    console.log("banner childNode", childNode)
    if (childNode.type.name === "heading") {
      return "Add a title"
    }
    if (childNode.type.name === "paragraph") {
      return "Add the subheading"
    }
    return null
  },
}

const BannerNode = Node.create(bannerNodeConfig)

export { BannerNode }
