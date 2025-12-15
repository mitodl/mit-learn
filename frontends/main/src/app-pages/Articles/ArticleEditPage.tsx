"use client"

import React from "react"
import { useRouter } from "next-nprogress-bar"
import { notFound } from "next/navigation"
import { Permission } from "api/hooks/user"
import { useArticleDetailRetrieve } from "api/hooks/articles"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { styled, LoadingSpinner, ArticleEditor } from "ol-components"
import { articlesView } from "@/common/urls"

const PageContainer = styled.div(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  display: "flex",
  height: "100%",
}))

const ArticleEditPage = ({ articleId }: { articleId: string }) => {
  const {
    data: article,
    isLoading,
    isFetching,
  } = useArticleDetailRetrieve(articleId)
  const router = useRouter()

  if (isLoading || isFetching) {
    return <LoadingSpinner color="inherit" loading={isLoading} size={32} />
  }
  if (!article) {
    return notFound()
  }

  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <PageContainer>
        <ArticleEditor
          article={article}
          onSave={(article) => {
            if (article.is_published)
              return router.push(articlesView(article.slug!))
            router.push(articlesView(String(article.id)))
          }}
        />
      </PageContainer>
    </RestrictedRoute>
  )
}

export { ArticleEditPage }
