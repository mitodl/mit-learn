"use client"

import React from "react"
import { useArticleDetail } from "api/hooks/articles"
import { LoadingSpinner, ArticleEditor, styled } from "ol-components"
import { notFound } from "next/navigation"
import { Permission } from "api/hooks/user"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"

const PageContainer = styled.div({
  display: "flex",
  height: "100%",
})

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
  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <PageContainer>
        <ArticleEditor article={article} readOnly />
      </PageContainer>
    </RestrictedRoute>
  )
}
