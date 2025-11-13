"use client"
import React from "react"
import { Permission } from "api/hooks/user"
import { useArticleDetail } from "api/hooks/articles"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import {
  styled,
  LoadingSpinner,
  ArticleEditor,
  HEADER_HEIGHT,
} from "ol-components"

import { notFound } from "next/navigation"

const PageContainer = styled.div(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  display: "flex",
  height: `calc(100vh - ${HEADER_HEIGHT}px - 132px)`,
}))

const ArticleEditPage = ({ articleId }: { articleId: string }) => {
  const { data: article, isLoading } = useArticleDetail(Number(articleId))

  if (isLoading) {
    return <LoadingSpinner color="inherit" loading={isLoading} size={32} />
  }
  if (!article) {
    return notFound()
  }

  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <PageContainer>
        <ArticleEditor article={article} />
      </PageContainer>
    </RestrictedRoute>
  )
}

export { ArticleEditPage }
