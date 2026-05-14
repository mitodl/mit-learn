"use client"

import React from "react"
import { useArticleDetailRetrieve } from "api/hooks/articles"
import { LoadingSpinner, styled } from "ol-components"
import { ArticleEditor } from "@/page-components/TiptapEditor/contentTypes/article/ArticleEditor"
import { LearningResourceProvider } from "@/page-components/TiptapEditor/extensions/node/LearningResource/LearningResourceDataProvider"
import { notFound } from "next/navigation"

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

const UserArticleDetailPage = ({
  articleId,
  learningResourceIds = [],
}: {
  articleId: string
  learningResourceIds?: number[]
}) => {
  const { data: article, isLoading } = useArticleDetailRetrieve(articleId)

  if (isLoading) {
    return (
      <LearningResourceProvider resourceIds={learningResourceIds}>
        <Spinner color="inherit" loading size={32} />
      </LearningResourceProvider>
    )
  }
  if (!article) {
    return notFound()
  }

  return (
    <PageContainer>
      <LearningResourceProvider resourceIds={learningResourceIds}>
        <ArticleEditor article={article} readOnly />
      </LearningResourceProvider>
    </PageContainer>
  )
}

export { UserArticleDetailPage }
