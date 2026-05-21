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
import { Container, Breadcrumbs } from "ol-components"
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
})

const StyledNodeViewWrapper = styled(NodeViewWrapper)({
  "&&": {
    position: "relative",
    left: "50%",
    right: "50%",
    marginLeft: "-50vw",
    marginRight: "-50vw",
    width: "100vw",
    borderBottom: "1px solid #DDE1E6",
  },
})

const BreadcrumContainer = styled(Container)(({ theme }) => ({
  maxWidth: "1080px !important",
  padding: "0 !important",
  [theme.breakpoints.down("lg")]: {
    padding: "0 16px !important",
  },
  [theme.breakpoints.down("md")]: {
    padding: "0 16px !important",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "0 16px !important",
  },
}))

const BreadcrumbBar = styled.div(({ theme }) => ({
  position: "relative",
  left: "50%",
  right: "50%",
  marginLeft: "-50vw",
  marginRight: "-50vw",
  width: "100vw",
  padding: "18px 0 2px 0",
  backgroundColor: theme.custom.colors.white,
  borderBottom: `1px solid ${theme.custom.colors.red}`,
  textDecoration: "none",
  "&& .breadcrum span span a": {
    textDecoration: "none !important",
  },
  "&& .breadcrum span span a span": {
    textDecoration: "none !important",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "12px 0 0px 0",
  },
}))

const ArticleBannerSection = styled.div(({ theme }) => ({
  padding: "64px 0",
  backgroundColor: theme.custom.colors.white,
  [theme.breakpoints.down("sm")]: {
    padding: "32px 0",
  },
}))

const StyledNodeViewContent = styled(NodeViewContent)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  "&&&&& h1": {
    marginTop: 0,
    marginBottom: "0px",
    color: theme.custom.colors.darkGray2,
    [theme.breakpoints.down("sm")]: {
      ...theme.typography.h3,
    },
  },
  "&&&&& p": {
    position: "relative",
    marginBottom: 0,
    marginTop: "16px",
    color: theme.custom.colors.darkGray2,
    [theme.breakpoints.down("sm")]: {
      ...theme.typography.body2,
      marginTop: 0,
    },
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

import { ByLineInBannerViewer } from "../ByLineInfoBar/ByLineInfoBarViewer"

const ArticleBannerViewer = ({
  children,
  node,
}: {
  children?: React.ReactNode
  node?: ProseMirrorNode
}) => {
  return (
    <ReactNodeViewContentProvider content={children}>
      <StyledNodeViewWrapper as="div">
        <>
          <BreadcrumbBar>
            <BreadcrumContainer className="breadcrum">
              <Breadcrumbs
                variant="dark"
                ancestors={[
                  { href: "/", label: "Home" },
                  { href: "/articles", label: "MIT Learn Articles" },
                ]}
                current={getTitle(node || ({} as ProseMirrorNode))}
              />
            </BreadcrumContainer>
          </BreadcrumbBar>

          <FullWidthContainer>
            <ArticleBannerSection>
              <InnerContainer>
                <StyledNodeViewContent className="banner-content-editable" />
                <ByLineInBannerViewer />
              </InnerContainer>
            </ArticleBannerSection>
          </FullWidthContainer>
        </>
      </StyledNodeViewWrapper>
    </ReactNodeViewContentProvider>
  )
}

const ArticleBannerWrapper = (props?: { node?: ProseMirrorNode }) => {
  return (
    <NodeViewWrapper as="div">
      <FullWidthContainer>
        <ArticleBannerSection>
          <InnerContainer>
            <Breadcrumbs
              variant="dark"
              ancestors={[
                { href: "/", label: "Home" },
                { href: "/articles", label: "MIT Learn Articles" },
              ]}
              current={getTitle(props?.node || ({} as ProseMirrorNode))}
            />
            <StyledNodeViewContent className="banner-content-editable" />
          </InnerContainer>
        </ArticleBannerSection>
      </FullWidthContainer>
    </NodeViewWrapper>
  )
}

const articleBannerNodeConfig: ExtendedNodeConfig = {
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
    return ReactNodeViewRenderer(ArticleBannerWrapper)
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

const ArticleBannerNode = Node.create(articleBannerNodeConfig)

export { ArticleBannerNode, ArticleBannerViewer }
