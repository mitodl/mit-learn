"use client"

import React from "react"
import { useArticleDetailRetrieve } from "api/hooks/articles"
import { LoadingSpinner, styled } from "ol-components"
import { ArticleEditor } from "@/page-components/TiptapEditor/ArticleEditor"
import { notFound } from "next/navigation"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
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

  const showArticleDetail = useFeatureFlagEnabled(FeatureFlags.ArticleViewer)
  const flagsLoaded = useFeatureFlagsLoaded()

  /* Ensure queries are accessed during loading/flag check.
   * This prevents React Query warnings about prefetched queries not being accessed.
   * We can remove the early LearningResourceProvider when we remove the feature flag.
   */
  if (isLoading || (!flagsLoaded && showArticleDetail === undefined)) {
    return (
      <LearningResourceProvider resourceIds={learningResourceIds}>
        <Spinner color="inherit" loading size={32} />
      </LearningResourceProvider>
    )
  }
  if (!showArticleDetail || !article) {
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
