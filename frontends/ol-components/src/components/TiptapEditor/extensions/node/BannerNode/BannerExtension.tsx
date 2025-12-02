import React from "react"
import {
  ReactNodeViewRenderer,
  Node,
  mergeAttributes,
  NodeViewWrapper,
  NodeViewContent,
} from "@tiptap/react"
import { BannerBackground } from "../../../../Banner/Banner"
import Container from "@mui/material/Container"
import styled from "@emotion/styled"
import { pxToRem } from "../../../../ThemeProvider/typography"

const FullWidthContainer = styled.div({
  position: "relative",
  left: "50%",
  right: "50%",
  marginLeft: "-50vw",
  marginRight: "-50vw",
  width: "100vw",
})

const InnerContainer = styled(Container)({
  maxWidth: "890px",
  "@media (min-width: 1320px)": {
    maxWidth: "890px",
  },
})

const StyledNodeViewContent = styled(NodeViewContent)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  "&& h1": {
    ...theme.typography.h1,
  },
  "&&&& p": {
    fontSize: pxToRem(20),
    lineHeight: pxToRem(32),
    position: "relative",
  },
  ".is-empty:not(.with-slash)[data-placeholder]:has(> .ProseMirror-trailingBreak:only-child)::before":
    {
      color: theme.custom.colors.silverGrayLight,
      opacity: 0.4,
    },
}))

const BannerWrapper = () => {
  return (
    <NodeViewWrapper as="div">
      <FullWidthContainer>
        <BannerBackground>
          <InnerContainer>
            <StyledNodeViewContent className="banner-content-editable" />
          </InnerContainer>
        </BannerBackground>
      </FullWidthContainer>
    </NodeViewWrapper>
  )
}

const BannerExtension = Node.create({
  name: "banner",

  selectable: false,

  // Enforce that the node must contain exactly a title (heading) and subheading (paragraph)
  content: "heading paragraph",

  isolating: false,

  parseHTML() {
    return [{ tag: "banner" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["banner", mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BannerWrapper)
  },
})

export { BannerExtension }
