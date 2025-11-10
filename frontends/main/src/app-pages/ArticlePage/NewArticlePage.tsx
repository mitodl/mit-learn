"use client"

import React from "react"
import { theme, styled, HEADER_HEIGHT } from "ol-components"

import { TiptapEditor } from "ol-components"

const PageContainer = styled.div({
  color: theme.custom.colors.darkGray2,
  display: "flex",
  height: `calc(100vh - ${HEADER_HEIGHT}px - 132px)`,
})

const EditorContainer = styled.div({
  minHeight: 0,
})

const StyledTiptapEditor = styled(TiptapEditor)({
  width: "70vw",
  height: `calc(100% - ${HEADER_HEIGHT}px - 132px)`,
  overscrollBehavior: "contain",
})

const NewArticlePage: React.FC = () => {
  return (
    <PageContainer>
      <EditorContainer>
        <StyledTiptapEditor />
      </EditorContainer>
    </PageContainer>
  )
}

export { NewArticlePage }
