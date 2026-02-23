import React from "react"
import {
  ReactNodeViewRenderer,
  Node,
  mergeAttributes,
  NodeViewWrapper,
  NodeViewContent,
  ReactNodeViewContentProvider,
} from "@tiptap/react"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { Container, BannerBackground, Breadcrumbs } from "ol-components"
import styled from "@emotion/styled"
import type { ExtendedNodeConfig } from "../types"
import { getTitle } from "../lib"

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

  "& span a, & span a:hover": {
    color: "#fff !important",
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
  '[contenteditable="true"] &': {
    caretColor: theme.custom.colors.red,
  },
}))

const StyledBannerBackground = styled(BannerBackground)(({ theme }) => ({
  padding: "64px 0",
  [theme.breakpoints.down("sm")]: {
    padding: "42px 0",
  },
}))

const BannerViewer = ({
  children,
  node,
}: {
  children?: React.ReactNode
  node?: ProseMirrorNode
}) => {
  return (
    <ReactNodeViewContentProvider content={children}>
      <BannerWrapper node={node} />
    </ReactNodeViewContentProvider>
  )
}

const BannerWrapper = (props?: { node?: ProseMirrorNode }) => {
  return (
    <NodeViewWrapper as="div">
      <FullWidthContainer>
        <StyledBannerBackground>
          <InnerContainer>
            <Breadcrumbs
              variant="dark"
              ancestors={[
                { href: "/", label: "Home" },
                { href: "/news", label: "MIT News" },
              ]}
              current={getTitle(props?.node || ({} as ProseMirrorNode))}
            />
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
    if (childNode.type.name === "heading") {
      return "Add a title"
    }
    if (childNode.type.name === "paragraph") {
      return "Add a subheading"
    }
    return null
  },
}

const BannerNode = Node.create(bannerNodeConfig)

export { BannerNode, BannerViewer }
