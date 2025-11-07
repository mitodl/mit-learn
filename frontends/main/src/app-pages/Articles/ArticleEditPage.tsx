"use client"
import React, { useEffect, useState, ChangeEvent } from "react"
import { Permission } from "api/hooks/user"
import { useRouter } from "next-nprogress-bar"
import { useArticleDetail, useArticlePartialUpdate } from "api/hooks/articles"
import { Button, Input, Alert } from "@mitodl/smoot-design"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { Container, Typography, styled, LoadingSpinner } from "ol-components"
import { notFound } from "next/navigation"

const SaveButton = styled.div({
  textAlign: "right",
  margin: "10px",
})

const ClientContainer = styled.div({
  width: "100%",
  margin: "10px 0",
})

const TitleInput = styled(Input)({
  width: "100%",
  margin: "10px 0",
})

const ArticleEditPage = ({ articleId }: { articleId: string }) => {
  const router = useRouter()

  const id = Number(articleId)
  const { data: article, isLoading } = useArticleDetail(id)

  const [title, setTitle] = useState<string>("")
  const [text, setText] = useState("")
  const [json, setJson] = useState({})
  const [alertText, setAlertText] = useState("")

  const { mutate: updateArticle, isPending } = useArticlePartialUpdate()

  const handleSave = () => {
    const payload = {
      id: id,
      title: title.trim(),
      json: json,
    }

    updateArticle(
      payload as {
        id: number
        json: string
        title: string
      },
      {
        onSuccess: (article) => {
          router.push(`/articles/${article.id}`)
        },
        onError: () => {
          setAlertText("❌ Failed to save article")
        },
      },
    )
  }

  useEffect(() => {
    if (article && !title) {
      setTitle(article.title)
      setText(article.json ? JSON.stringify(article.json, null, 2) : "")
      setJson(article.json)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article])

  if (isLoading) {
    return <LoadingSpinner color="inherit" loading={isLoading} size={32} />
  }
  if (!article) {
    return notFound()
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setText(value)

    try {
      const parsed = JSON.parse(value)
      setJson(parsed)
    } catch {
      setJson({})
    }
  }
  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <Container className="article-wrapper">
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
        <TitleInput
          type="text"
          value={title}
          onChange={(e) => {
            console.log("Title input changed:", e.target.value)
            setTitle(e.target.value)
            setAlertText("")
          }}
          placeholder="Enter article title"
          className="input-field"
        />

        <ClientContainer className="editor-box">
          <textarea
            data-testid="editor"
            value={text}
            onChange={handleChange}
            placeholder="Type or paste JSON here..."
            style={{ width: "100%", height: 150 }}
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
