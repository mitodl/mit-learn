"use client"

import React from "react"
import { useArticleDetail } from "api/hooks/articles"
import { Container, LoadingSpinner, styled, Typography } from "ol-components"
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

const PreTag = styled.pre({
  background: "#f6f6f6",
  padding: "16px",
  borderRadius: "8px",
  fontSize: "14px",
  overflowX: "auto",
})

export const ArticleDetailPage = ({ articleId }: { articleId: number }) => {
  const id = Number(articleId)
  const { data, isLoading } = useArticleDetail(id)

  const editUrl = articlesEditView(id)

  if (isLoading) {
    return <LoadingSpinner color="inherit" loading={isLoading} size={32} />
  }
  if (!data) {
    return notFound()
  }
  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <Page>
        <WrapperContainer>
          <Typography variant="h3" component="h1">
            {data?.title}
          </Typography>

          <ControlsContainer>
            <ButtonLink href={editUrl} variant="primary">
              Edit
            </ButtonLink>
          </ControlsContainer>
        </WrapperContainer>
        <PreTag>{JSON.stringify(data.content, null, 2)}</PreTag>
      </Page>
    </RestrictedRoute>
  )
}
