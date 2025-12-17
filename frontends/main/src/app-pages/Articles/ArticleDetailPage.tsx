"use client"

import React from "react"
import { useArticleDetailRetrieve } from "api/hooks/articles"
import { LoadingSpinner, ArticleEditor, styled } from "ol-components"
import { notFound } from "next/navigation"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"

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

export const ArticleDetailPage = ({ articleId }: { articleId: string }) => {
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
      <ArticleEditor article={article} readOnly />
    </PageContainer>
  )
}
