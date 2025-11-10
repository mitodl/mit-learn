"use client"

import React from "react"
import { theme, styled, HEADER_HEIGHT } from "ol-components"
import { TiptapEditor } from "ol-components"
import { Permission } from "api/hooks/user"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"

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
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <PageContainer>
        <EditorContainer>
          <StyledTiptapEditor />
        </EditorContainer>
      </PageContainer>
    </RestrictedRoute>
  )
}

export { NewArticlePage }
