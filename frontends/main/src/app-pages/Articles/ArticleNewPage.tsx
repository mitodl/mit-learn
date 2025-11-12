"use client"
import React, { useState, ChangeEvent } from "react"
import { Permission } from "api/hooks/user"
import { useRouter } from "next-nprogress-bar"
import { useArticleCreate } from "api/hooks/articles"
import { Button, Input, Alert } from "@mitodl/smoot-design"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { Container, Typography, styled } from "ol-components"
import { articlesView } from "@/common/urls"

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

const ArticleNewPage: React.FC = () => {
  const router = useRouter()

  const [title, setTitle] = React.useState<string>("")
  const [text, setText] = useState("")
  const [json, setJson] = useState({})
  const [alertText, setAlertText] = React.useState("")

  const { mutate: createArticle, isPending } = useArticleCreate()

  const handleSave = () => {
    setAlertText("")

    const payload = {
      title: title.trim(),
      content: json,
    }

    createArticle(
      payload as {
        content: object
        title: string
      },
      {
        onSuccess: (article) => {
          articlesView(article.id)
          router.push(articlesView(article.id))
        },
        onError: (error) => {
          setAlertText(`❌ ${error?.message}`)
        },
      },
    )
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
        <h1>Write Article</h1>
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

export { ArticleNewPage }
