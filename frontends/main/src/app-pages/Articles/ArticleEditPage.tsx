"use client"

import React from "react"
import { useRouter } from "next-nprogress-bar"
import { notFound } from "next/navigation"
import { Permission } from "api/hooks/user"
import { useArticleDetailRetrieve } from "api/hooks/articles"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { styled, LoadingSpinner } from "ol-components"
import { ArticleEditor } from "@/page-components/TiptapEditor/ArticleEditor"
import { articlesView, articlesDraftView } from "@/common/urls"
import invariant from "tiny-invariant"

const PageContainer = styled.div(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  display: "flex",
  height: "100%",
}))

const Spinner = styled(LoadingSpinner)({
  margin: "auto",
  position: "absolute",
  top: "40%",
  left: "50%",
  transform: "translate(-50%, -50%)",
})

const ArticleEditPage = ({ articleId }: { articleId: string }) => {
  const {
    data: article,
    isLoading,
    isFetching,
  } = useArticleDetailRetrieve(articleId)
  const router = useRouter()

  if (isLoading || isFetching) {
    return <Spinner color="inherit" loading={isLoading} size={32} />
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
            if (article.is_published) {
              invariant(article.slug, "Published article must have a slug")
              return router.push(articlesView(article.slug))
            } else {
              router.push(articlesDraftView(String(article.id)))
            }
          }}
        />
      </PageContainer>
    </RestrictedRoute>
  )
}

export { ArticleEditPage }
