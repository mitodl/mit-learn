"use client"

import React from "react"
import type { WebsiteContent } from "api/v1"
import { useWebsiteContentDetailRetrieve } from "api/hooks/website_content"
import { LoadingSpinner, styled } from "ol-components"
import { NewsEditor } from "@/page-components/TiptapEditor/contentTypes/news/NewsEditor"
import { ArticleEditor } from "@/page-components/TiptapEditor/contentTypes/article/ArticleEditor"
import { LearningResourceProvider } from "@/page-components/TiptapEditor/extensions/node/LearningResource/LearningResourceDataProvider"
import { notFound } from "next/navigation"

const DETAIL_EDITORS: Record<
  string,
  React.ComponentType<{ contentItem: WebsiteContent }>
> = {
  article: ({ contentItem }) => (
    <ArticleEditor article={contentItem} readOnly />
  ),
  news: ({ contentItem }) => <NewsEditor newsItem={contentItem} readOnly />,
}

const PageContainer = styled.div({
  display: "flex",
  height: "100%",
})

const Spinner = styled(LoadingSpinner)({
  margin: "auto",
  position: "absolute",
  top: "40%",
  left: "50%",
  transform: "translate(-50%, -50%)",
})

const WebsiteContentDetail = ({
  contentId,
  learningResourceIds = [],
}: {
  contentId: string
  learningResourceIds?: number[]
}) => {
  const { data: contentItem, isLoading } =
    useWebsiteContentDetailRetrieve(contentId)

  if (isLoading) {
    return (
      <LearningResourceProvider resourceIds={learningResourceIds}>
        <Spinner color="inherit" loading size={32} />
      </LearningResourceProvider>
    )
  }
  if (!contentItem) {
    return notFound()
  }

  const contentType = contentItem.content_type ?? ""
  const Editor = DETAIL_EDITORS[contentType]
  if (!Editor) {
    return notFound()
  }

  return (
    <PageContainer>
      <LearningResourceProvider resourceIds={learningResourceIds}>
        {/*
          Keyed by id for the same reason as the edit page: the editor keeps its
          own state rather than syncing the prop in, so moving between items
          needs a fresh one even if this component is reused.
        */}
        <Editor key={contentItem.id} contentItem={contentItem} />
      </LearningResourceProvider>
    </PageContainer>
  )
}

export { WebsiteContentDetail }
