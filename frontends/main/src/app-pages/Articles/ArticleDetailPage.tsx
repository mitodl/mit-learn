"use client"

import React from "react"
import { useArticleDetailRetrieve } from "api/hooks/articles"
import { LoadingSpinner, styled } from "ol-components"
import { ArticleEditor } from "@/page-components/TiptapEditor/ArticleEditor"
import { notFound } from "next/navigation"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { LearningResourceProvider } from "@/page-components/TiptapEditor/extensions/node/LearningResource/LearningResourceDataProvider"

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

export const ArticleDetailPage = ({
  articleId,
  learningResourceIds = [],
}: {
  articleId: string
  learningResourceIds?: number[]
}) => {
  const { data: article, isLoading } = useArticleDetailRetrieve(articleId)

  const showArticleDetail = useFeatureFlagEnabled(
    FeatureFlags.ArticleEditorView,
  )

  if (isLoading) {
    return <Spinner color="inherit" loading size={32} />
  }
  if (!article || !showArticleDetail) {
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
