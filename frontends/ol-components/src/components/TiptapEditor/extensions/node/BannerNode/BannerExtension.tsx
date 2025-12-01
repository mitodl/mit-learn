import React from "react"
import {
  ReactNodeViewRenderer,
  Node,
  mergeAttributes,
  NodeViewWrapper,
  NodeViewContent,
} from "@tiptap/react"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Heading } from "@tiptap/extension-heading"
import { isNodeEmpty } from "@tiptap/core"
import { BannerBackground } from "../../../../Banner/Banner"
import Container from "@mui/material/Container"
import styled from "@emotion/styled"
import "./BannerExtension.scss"
import { pxToRem } from "../../../../ThemeProvider/typography"

// Export the Heading extension for use in banner nodes
// This ensures headings within banners use @tiptap/extension-heading
export { Heading as BannerHeading }

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    banner: {
      insertBanner: () => ReturnType
    }
  }
}

const InnerContainer = styled.div({
  // Container for banner content
})

const HeaderContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  "&& h1": {
    ...theme.typography.h1,
  },
  "&&&& p": {
    // fontFamily: "neue-haas-grotesk-text, sans-serif",
    // fontWeight: fontWeights.text.bold,
    // fontStyle: "normal",
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
      <BannerBackground>
        <Container>
          <InnerContainer>
            <HeaderContainer>
              <NodeViewContent className="banner-content-editable" />
            </HeaderContainer>
          </InnerContainer>
        </Container>
      </BannerBackground>
    </NodeViewWrapper>
  )
}

const BannerExtension = Node.create({
  name: "banner",

  group: "block",

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
