"use client"

import React from "react"
import { useArticleDetail } from "api/hooks/articles"
import { LoadingSpinner, ArticleEditor } from "ol-components"
import { notFound } from "next/navigation"

export const ArticleDetailPage = ({ articleId }: { articleId: number }) => {
  const {
    data: article,
    isLoading,
    isFetching,
  } = useArticleDetail(Number(articleId))

  if (isLoading || isFetching) {
    return <LoadingSpinner color="inherit" loading size={32} />
  }
  if (!article) {
    return notFound()
  }
  return <ArticleEditor article={article} readOnly />
}
