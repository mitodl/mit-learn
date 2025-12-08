"use client"

import React from "react"
import { useArticleDetail } from "api/hooks/articles"
import { LoadingSpinner, ArticleEditor } from "ol-components"
import { notFound } from "next/navigation"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"

export const ArticleDetailPage = ({ articleId }: { articleId: number }) => {
  const {
    data: article,
    isLoading,
    isFetching,
  } = useArticleDetail(Number(articleId))

  const showArticleDetail = useFeatureFlagEnabled(
    FeatureFlags.ArticleEditorView,
  )

  if (isLoading || isFetching) {
    return <LoadingSpinner color="inherit" loading size={32} />
  }
  if (!article || !showArticleDetail) {
    return notFound()
  }
  return <ArticleEditor article={article} readOnly />
}
