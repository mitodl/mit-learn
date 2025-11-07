"use client"
import React, { useEffect } from "react"
import { Permission } from "api/hooks/user"
import { CKEditorClient } from "ol-ckeditor"
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

  const [title, setTitle] = React.useState<string>("")
  const [editorContent, setEditorContent] = React.useState<string>("")
  const [editorKey] = React.useState(0)
  const [alertText, setAlertText] = React.useState("")
  const [severity, setSeverity] = React.useState<"success" | "error">("success")

  const { mutate: updateArticle, isPending } = useArticlePartialUpdate()

  const handleSave = () => {
    setAlertText("")

    const payload = {
      id: id,
      title: title.trim(),
      html: editorContent,
    }

    updateArticle(
      payload as {
        id: number
        html: string
        title: string
      },
      {
        onSuccess: (article) => {
          router.push(`/articles/${article.id}`)
        },
        onError: () => {
          setAlertText("❌ Failed to save article")
          setSeverity("error")
        },
      },
    )
  }

  useEffect(() => {
    if (article && !title && !editorContent) {
      console.log("Article data:", article)
      setTitle(article.title)
      setEditorContent(article.html)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article])

  if (isLoading) {
    return <LoadingSpinner color="inherit" loading={isLoading} size={32} />
  }
  if (!article) {
    return notFound()
  }

  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <Container className="article-wrapper">
        <h1>Write Article</h1>
        {alertText && (
          <Alert
            key={alertText}
            severity={severity}
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
          <CKEditorClient
            key={editorKey}
            value={editorContent}
            onChange={(content) => setEditorContent(content)}
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
