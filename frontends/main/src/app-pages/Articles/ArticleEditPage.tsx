"use client"
import React, { useEffect, useState } from "react"
import { Permission } from "api/hooks/user"
import { useRouter } from "next-nprogress-bar"
import { useArticleDetail, useArticlePartialUpdate } from "api/hooks/articles"
import { Button, Alert } from "@mitodl/smoot-design"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import {
  Container,
  Typography,
  styled,
  LoadingSpinner,
  TiptapEditorContainer,
  JSONContent,
} from "ol-components"

import { notFound } from "next/navigation"
import { articlesView } from "@/common/urls"

const SaveButton = styled.div({
  textAlign: "right",
  margin: "10px",
})

const ClientContainer = styled.div({
  width: "100%",
  margin: "10px 0",
})

const ArticleEditPage = ({ articleId }: { articleId: string }) => {
  const router = useRouter()

  const id = Number(articleId)
  const { data: article, isLoading } = useArticleDetail(id)

  const [title, setTitle] = useState<string>("")
  const [json, setJson] = useState<JSONContent>({
    type: "doc",
    content: [{ type: "paragraph", content: [] }],
  })
  const [alertText, setAlertText] = useState("")

  const { mutate: updateArticle, isPending } = useArticlePartialUpdate()

  const handleSave = () => {
    const payload = {
      id: id,
      title: title.trim(),
      content: json,
    }

    updateArticle(payload, {
      onSuccess: (article) => {
        router.push(articlesView(article.id))
      },
      onError: (error) => {
        setAlertText(`❌ ${error.message}`)
      },
    })
  }

  useEffect(() => {
    if (article && !title) {
      setTitle(article.title)
      setJson(article.content)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article])

  if (isLoading) {
    return <LoadingSpinner color="inherit" loading={isLoading} size={32} />
  }
  if (!article) {
    return notFound()
  }

  const handleChange = (json: object) => {
    setJson(json)
  }

  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <Container>
        <Typography variant="h3" component="h1">
          Edit Article
        </Typography>
        {alertText && (
          <Alert
            key={alertText}
            severity="error"
            className="info-alert"
            closable
          >
            <Typography variant="body2" color="textPrimary">
              {alertText}
            </Typography>
          </Alert>
        )}

        <ClientContainer>
          <TiptapEditorContainer
            data-testid="editor"
            value={json}
            onChange={handleChange}
            title={title}
            setTitle={(e) => {
              setTitle(e.target.value)
              setAlertText("")
            }}
          />
        </ClientContainer>

        <SaveButton>
          <Button
            variant="primary"
            disabled={isPending || !title.trim()}
            onClick={handleSave}
          >
            {isPending ? "Saving..." : "Save Article"}
          </Button>
        </SaveButton>
      </Container>
    </RestrictedRoute>
  )
}

export { ArticleEditPage }
