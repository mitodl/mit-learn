"use client"

import React from "react"
import { useArticleDetail } from "api/hooks/articles"
import {
  Container,
  LoadingSpinner,
  styled,
  Typography,
  ArticleEditor,
} from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { notFound } from "next/navigation"
import { Permission } from "api/hooks/user"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { articlesEditView } from "@/common/urls"

const Page = styled(Container)({
  marginTop: "40px",
  marginBottom: "40px",
})

const ControlsContainer = styled.div({
  display: "flex",
  justifyContent: "flex-end",
  margin: "10px",
})
const WrapperContainer = styled.div({
  borderBottom: "1px solid rgb(222, 208, 208)",
  paddingBottom: "10px",
})

export const ArticleDetailPage = ({ articleId }: { articleId: number }) => {
  const id = Number(articleId)
  const { data: article, isLoading } = useArticleDetail(id)

  const editUrl = articlesEditView(id)

  if (isLoading) {
    return <LoadingSpinner color="inherit" loading={isLoading} size={32} />
  }
  if (!article) {
    return notFound()
  }
  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <Page>
        <WrapperContainer>
          <Typography variant="h3" component="h1">
            {article?.title}
          </Typography>
          <ControlsContainer>
            <ButtonLink href={editUrl} variant="primary">
              Edit
            </ButtonLink>
          </ControlsContainer>
        </WrapperContainer>
        <ArticleEditor article={article} readOnly />
      </Page>
    </RestrictedRoute>
  )
}
